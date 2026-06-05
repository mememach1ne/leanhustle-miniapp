import type {
  CheckoutOrderResponse,
  CreateManualOrderRequest,
  ManualOrderClientLookupResponse,
  OrderDetailsDto,
  OrderListItemDto,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
} from '@lean-poizon/shared';
import { OrderStatus as SharedOrderStatus } from '@lean-poizon/shared';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  OrderStatus,
  Prisma,
  type StaffAccount,
  StaffRole,
  type User,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { SettingsService } from '../settings/settings.service';
import { mapUserToProfile } from '../users/mappers/user-profile.mapper';
import { UsersService } from '../users/users.service';
import {
  mapOrderToDetailsDto,
  mapOrderToListItemDto,
  mapOrderToStaffDetailsDto,
  mapOrderToStaffListItemDto,
} from './mappers/order-response.mapper';
import { OrderNotificationsService } from './services/order-notifications.service';
import { OrderNumberService } from './services/order-number.service';
import { SubscriberBenefitService } from './services/subscriber-benefit.service';

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.PAYMENT_PENDING],
  [OrderStatus.PAYMENT_PENDING]: [OrderStatus.PAID_AWAITING_PURCHASE],
  [OrderStatus.PAID_AWAITING_PURCHASE]: [OrderStatus.PURCHASED],
  // After purchase, manager enters actual delivery -> DELIVERY_PAYMENT_PENDING
  [OrderStatus.PURCHASED]: [],
  [OrderStatus.DELIVERY_PAYMENT_PENDING]: [OrderStatus.DELIVERY_PAID],
  // From DELIVERY_PAID manager either enters duty cost or proceeds to
  // track code directly.
  [OrderStatus.DELIVERY_PAID]: [],
  [OrderStatus.DUTY_PAYMENT_PENDING]: [OrderStatus.DUTY_PAID],
  [OrderStatus.DUTY_PAID]: [],
  // Track code is entered AFTER delivery (and duty if any) are paid,
  // because the track code belongs to the last-mile shipment to Russia.
  [OrderStatus.TRACK_CODE_RECEIVED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  // CANCELLED is reached via dedicated endpoints, not generic
  // updateStatus, and is terminal.
  [OrderStatus.CANCELLED]: [],
};

const STAFF_NEW_ORDER_STATUSES: OrderStatus[] = [OrderStatus.CREATED];
const STAFF_ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAID_AWAITING_PURCHASE,
  OrderStatus.PURCHASED,
  OrderStatus.TRACK_CODE_RECEIVED,
  OrderStatus.DELIVERY_PAYMENT_PENDING,
  OrderStatus.DELIVERY_PAID,
  OrderStatus.DUTY_PAYMENT_PENDING,
  OrderStatus.DUTY_PAID,
];

const STAFF_ORDER_LIST_LIMIT = 10;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly prisma: PrismaService;
  private readonly settingsService: SettingsService;
  private readonly usersService: UsersService;
  private readonly pricingService: PricingService;
  private readonly orderNumberService: OrderNumberService;
  private readonly orderNotificationsService: OrderNotificationsService;
  private readonly subscriberBenefitService: SubscriberBenefitService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(SettingsService) settingsService: SettingsService,
    @Inject(UsersService) usersService: UsersService,
    @Inject(PricingService) pricingService: PricingService,
    @Inject(OrderNumberService) orderNumberService: OrderNumberService,
    @Inject(OrderNotificationsService)
    orderNotificationsService: OrderNotificationsService,
    @Inject(SubscriberBenefitService)
    subscriberBenefitService: SubscriberBenefitService,
  ) {
    this.prisma = prisma;
    this.settingsService = settingsService;
    this.usersService = usersService;
    this.pricingService = pricingService;
    this.orderNumberService = orderNumberService;
    this.orderNotificationsService = orderNotificationsService;
    this.subscriberBenefitService = subscriberBenefitService;
  }

  async checkout(user: User, deliveryAddressId: string): Promise<CheckoutOrderResponse> {
    const deliveryAddress = await this.prisma.deliveryAddress.findFirst({
      where: { id: deliveryAddressId, userId: user.id },
    });

    if (!deliveryAddress) {
      throw new BadRequestException('Адрес доставки не найден. Заполните данные в разделе «Мои данные».');
    }

    const settings = await this.settingsService.getCurrentSettings();

    const createdOrderId = await this.prisma.$transaction(
      async (tx) => {
        const cart = await tx.cart.findUnique({
          where: { userId: user.id },
          include: {
            items: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });

        if (!cart || cart.items.length === 0) {
          throw new BadRequestException(
            'Корзина пуста. Добавьте товары перед оформлением заявки.',
          );
        }

        const orderNumber = await this.orderNumberService.generate(
          tx,
          user.isChannelSubscriber,
        );

        // Recalculate prices server-side to prevent client-side price manipulation
        const recalculatedItems = cart.items.map((item) => {
          const result = this.pricingService.recalculateFromYuan(
            item.priceYuan,
            item.deliveryCategory ?? 'OTHER',
            settings,
          );
          return {
            ...item,
            totalUsd: result.totalUsd,
            deliveryRub: result.deliveryRub,
            dutyRub: result.dutyRub,
          };
        });

        const itemsCount = recalculatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalUsd = recalculatedItems.reduce(
          (sum, item) => sum.add(item.totalUsd.mul(item.quantity)),
          new Prisma.Decimal(0),
        );
        const deliveryRub = recalculatedItems.reduce(
          (sum, item) => sum.add(new Prisma.Decimal(item.deliveryRub).mul(item.quantity)),
          new Prisma.Decimal(0),
        );
        const dutyRub = recalculatedItems.reduce(
          (sum, item) => sum.add(new Prisma.Decimal(item.dutyRub).mul(item.quantity)),
          new Prisma.Decimal(0),
        );

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: user.id,
            status: OrderStatus.CREATED,
            isChannelSubscriberAtCheckout: user.isChannelSubscriber,
            subscriberBenefitApplied: false,
            subscriberBenefitAmountRub: new Prisma.Decimal(0),
            itemsCount,
            originalTotalUsd: totalUsd,
            benefitDiscountUsd: new Prisma.Decimal(0),
            totalUsd,
            deliveryRub,
            dutyRub,
            pricingCnyToUsd: settings.cnyToUsd,
            pricingCnyToRub: settings.cnyToRub,
            pricingCommissionPercent: settings.commissionPercent,
            deliveryAddressId: deliveryAddress.id,
            deliveryFullName: deliveryAddress.fullName,
            deliveryCdekAddress: deliveryAddress.cdekAddress,
            deliveryPhone: deliveryAddress.phone,
          },
        });

        await tx.orderItem.createMany({
          data: recalculatedItems.map((item) => ({
            orderId: order.id,
            dewuLink: item.dewuLink,
            dwSpuId: item.dwSpuId,
            dwSkuId: item.dwSkuId,
            productTitle: item.productTitle,
            productImage: item.productImage,
            categoryL1: item.categoryL1,
            categoryL2: item.categoryL2,
            categoryL3: item.categoryL3,
            sizeLabel: item.sizeLabel,
            versionLabel: item.versionLabel,
            quantity: item.quantity,
            priceYuan: item.priceYuan,
            originalTotalUsd: item.totalUsd,
            totalUsd: item.totalUsd,
            deliveryRub: new Prisma.Decimal(item.deliveryRub),
            dutyRub: new Prisma.Decimal(item.dutyRub),
            categoryGroup: item.categoryGroup,
            deliveryCategory: item.deliveryCategory,
            estimatedWeightKg: item.estimatedWeightKg,
          })),
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: null,
            toStatus: OrderStatus.CREATED,
            comment: 'Заявка создана из корзины пользователя.',
          },
        });

        await tx.cartItem.deleteMany({
          where: {
            cartId: cart.id,
          },
        });

        return order.id;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    const order = await this.getOwnedOrderOrThrow(user.id, createdOrderId);
    const profile = await this.usersService.findById(user.id);

    if (profile) {
      try {
        await this.orderNotificationsService.notifyManagersAboutCreatedOrder(
          mapOrderToStaffDetailsDto({
            ...order,
            user: {
              id: profile.id,
              telegramId: profile.telegramId,
              username: profile.username,
              firstName: profile.firstName,
              lastName: profile.lastName,
            },
          }),
          mapUserToProfile(profile),
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify managers about order ${order.orderNumber}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      order: mapOrderToDetailsDto(order),
    };
  }

  /**
   * Look up an existing client by @username for the manual order flow.
   * Returns saved delivery addresses (default first) and subscriber status
   * so the bot/miniapp can pre-fill the manual order form.
   */
  async lookupManualOrderClient(
    staff: StaffAccount | undefined,
    rawUsername: string,
  ): Promise<ManualOrderClientLookupResponse> {
    if (!staff || (staff.role !== StaffRole.ADMIN && staff.role !== StaffRole.MANAGER)) {
      throw new ForbiddenException('Поиск клиента доступен только сотрудникам.');
    }

    const normalizedUsername = (rawUsername ?? '').trim().replace(/^@+/, '');
    if (!normalizedUsername) {
      throw new BadRequestException('Укажите username клиента.');
    }

    const client = await this.prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
      include: {
        deliveryAddresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!client) {
      throw new BadRequestException(
        `Клиент @${normalizedUsername} не найден. Попроси клиента запустить бота, чтобы он появился в базе.`,
      );
    }

    return {
      client: {
        id: client.id,
        telegramId: client.telegramId,
        username: client.username,
        firstName: client.firstName,
        lastName: client.lastName,
      },
      addresses: client.deliveryAddresses.map((address) => ({
        id: address.id,
        fullName: address.fullName,
        cdekAddress: address.cdekAddress,
        phone: address.phone,
        isDefault: address.isDefault,
        createdAt: address.createdAt.toISOString(),
      })),
      subscription: {
        isChannelSubscriber: client.isChannelSubscriber,
        hasUsedSubscriberBenefit: client.hasUsedSubscriberBenefit,
      },
    };
  }

  /**
   * Staff/admin manually creates an order on behalf of a client. Used when the
   * product API can't resolve a product and the client agreed on a price with
   * the manager directly. Admin-only. Starts at CREATED, so it then enters the
   * normal flow (client pays, manager buys, etc.).
   */
  async createManualOrderByStaff(
    staff: StaffAccount | undefined,
    dto: CreateManualOrderRequest,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff || (staff.role !== StaffRole.ADMIN && staff.role !== StaffRole.MANAGER)) {
      throw new ForbiddenException('Ручное создание заказа доступно только сотрудникам.');
    }

    const normalizedUsername = dto.username.trim().replace(/^@+/, '');
    if (!normalizedUsername) {
      throw new BadRequestException('Укажите username клиента.');
    }

    const client = await this.prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
    });

    if (!client) {
      throw new BadRequestException(
        `Клиент @${normalizedUsername} не найден. Попроси клиента запустить бота, чтобы он появился в базе.`,
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Добавьте хотя бы один товар в заказ.');
    }

    const settings = await this.settingsService.getCurrentSettings();

    // Compute pricing for each item using the existing manual-pricing logic.
    const pricedItems = await Promise.all(
      dto.items.map(async (item) => {
        const pricing = await this.pricingService.calculateManual({
          priceYuan: item.priceYuan,
          deliveryCategory: item.deliveryCategory,
        });
        return { input: item, pricing };
      }),
    );

    const itemsCount = dto.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalUsd = pricedItems.reduce(
      (sum, { input, pricing }) =>
        sum.add(new Prisma.Decimal(pricing.totalUsd).mul(input.quantity)),
      new Prisma.Decimal(0),
    );
    const deliveryRub = pricedItems.reduce(
      (sum, { input, pricing }) =>
        sum.add(new Prisma.Decimal(pricing.deliveryRub).mul(input.quantity)),
      new Prisma.Decimal(0),
    );
    const dutyRub = pricedItems.reduce(
      (sum, { input, pricing }) =>
        sum.add(new Prisma.Decimal(pricing.dutyRub).mul(input.quantity)),
      new Prisma.Decimal(0),
    );

    const staffLabel = staff.username
      ? `@${staff.username}`
      : [staff.firstName, staff.lastName].filter(Boolean).join(' ') || 'администратором';

    const createdOrderId = await this.prisma.$transaction(
      async (tx) => {
        const orderNumber = await this.orderNumberService.generate(
          tx,
          client.isChannelSubscriber,
        );

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: client.id,
            status: OrderStatus.CREATED,
            isChannelSubscriberAtCheckout: client.isChannelSubscriber,
            subscriberBenefitApplied: false,
            subscriberBenefitAmountRub: new Prisma.Decimal(0),
            itemsCount,
            originalTotalUsd: totalUsd,
            benefitDiscountUsd: new Prisma.Decimal(0),
            totalUsd,
            deliveryRub,
            dutyRub,
            pricingCnyToUsd: settings.cnyToUsd,
            pricingCnyToRub: settings.cnyToRub,
            pricingCommissionPercent: settings.commissionPercent,
            deliveryAddressId: null,
            deliveryFullName: dto.delivery.fullName,
            deliveryCdekAddress: dto.delivery.cdekAddress,
            deliveryPhone: dto.delivery.phone,
            customerComment: dto.delivery.comment ?? null,
          },
        });

        await tx.orderItem.createMany({
          data: pricedItems.map(({ input, pricing }) => ({
            orderId: order.id,
            dewuLink: input.dewuLink?.trim() || '',
            dwSpuId: 'manual',
            dwSkuId: 'manual',
            productTitle: input.productTitle.trim(),
            productImage: null,
            categoryL1: null,
            categoryL2: null,
            categoryL3: null,
            sizeLabel: input.sizeLabel?.trim() || '—',
            versionLabel: input.versionLabel?.trim() || null,
            quantity: input.quantity,
            priceYuan: new Prisma.Decimal(pricing.priceYuan),
            originalTotalUsd: new Prisma.Decimal(pricing.totalUsd),
            totalUsd: new Prisma.Decimal(pricing.totalUsd),
            deliveryRub: new Prisma.Decimal(pricing.deliveryRub),
            dutyRub: new Prisma.Decimal(pricing.dutyRub),
            categoryGroup: pricing.categoryGroup,
            deliveryCategory: pricing.deliveryCategory,
            estimatedWeightKg: new Prisma.Decimal(pricing.estimatedWeightKg),
          })),
        });

        // Subscriber benefit handling for manual orders. The intent comes
        // from the staff toggle in the bot/miniapp:
        //   - true  -> force-apply the discount now (bypass hasUsed guard);
        //   - false -> explicitly skip (mark applied=true with zero amount so
        //              the standard PAID-transition logic does not re-apply);
        //   - undefined -> leave default behavior (auto-apply at PAID stage).
        let benefitNote: string | null = null;

        if (dto.applySubscriberBenefit === true) {
          // Ensure the BenefitService eligibility checks pass.
          if (client.hasUsedSubscriberBenefit) {
            await tx.user.update({
              where: { id: client.id },
              data: { hasUsedSubscriberBenefit: false },
            });
          }
          if (!client.isChannelSubscriber) {
            await tx.order.update({
              where: { id: order.id },
              data: { isChannelSubscriberAtCheckout: true },
            });
          }

          const benefitOrder = await tx.order.findUniqueOrThrow({
            where: { id: order.id },
            include: {
              user: {
                select: {
                  id: true,
                  isChannelSubscriber: true,
                  hasUsedSubscriberBenefit: true,
                },
              },
              items: {
                select: {
                  id: true,
                  priceYuan: true,
                  originalTotalUsd: true,
                  totalUsd: true,
                },
              },
            },
          });

          const benefitResult = await this.subscriberBenefitService.applyIfEligible(
            tx,
            benefitOrder,
          );

          if (benefitResult.applied) {
            benefitNote = `Льгота подписчика применена вручную ${staffLabel}. Скидка: ₽${benefitResult.benefitDiscountRub
              .toDecimalPlaces(2)
              .toString()}.`;
          }
        } else if (dto.applySubscriberBenefit === false) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              subscriberBenefitApplied: true,
              subscriberBenefitAmountRub: new Prisma.Decimal(0),
              isChannelSubscriberAtCheckout: false,
            },
          });
          benefitNote = `Льгота подписчика отключена ${staffLabel} при создании заказа.`;
        }

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: null,
            toStatus: OrderStatus.CREATED,
            changedByStaffId: staff.id,
            comment: [
              `Заказ создан вручную ${staffLabel} через админ-панель.`,
              benefitNote,
            ]
              .filter(Boolean)
              .join(' '),
          },
        });

        return order.id;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    const order = await this.getOrderForStaffOrThrow(createdOrderId);
    const staffDto = mapOrderToStaffDetailsDto(order);

    // Notify managers (so the order shows up with action buttons) and the
    // client (so they know a manager created an order for them).
    try {
      await this.orderNotificationsService.notifyManagersAboutCreatedOrder(
        staffDto,
        mapUserToProfile(client),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify managers about manual order ${staffDto.orderNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    try {
      await this.orderNotificationsService.notifyUserAboutStatusChange(
        client.telegramId,
        staffDto.orderNumber,
        SharedOrderStatus.CREATED,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify client about manual order ${staffDto.orderNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return staffDto;
  }

  async getCurrentUserOrders(userId: string): Promise<OrderListItemDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            productTitle: true,
            productImage: true,
          },
        },
      },
    });

    return orders.map(mapOrderToListItemDto);
  }

  async getCurrentUserOrderById(
    userId: string,
    orderId: string,
  ): Promise<OrderDetailsDto> {
    const order = await this.getOwnedOrderOrThrow(userId, orderId);
    return mapOrderToDetailsDto(order);
  }

  async getOrderForStaff(orderId: string): Promise<StaffOrderDetailsDto> {
    const order = await this.getOrderForStaffOrThrow(orderId);
    return mapOrderToStaffDetailsDto(order);
  }

  async getNewOrdersForStaff(): Promise<StaffOrderListItemDto[]> {
    return this.getStaffOrdersByStatuses(STAFF_NEW_ORDER_STATUSES);
  }

  async getActiveOrdersForStaff(): Promise<StaffOrderListItemDto[]> {
    return this.getStaffOrdersByStatuses(STAFF_ACTIVE_ORDER_STATUSES);
  }

  async findOrderForStaffByNumber(orderNumber: string): Promise<StaffOrderDetailsDto> {
    const normalizedOrderNumber = orderNumber.trim().toUpperCase();

    if (!normalizedOrderNumber) {
      throw new BadRequestException('Номер заказа не может быть пустым.');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber: {
          equals: normalizedOrderNumber,
          mode: 'insensitive',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Заказ с таким номером не найден.');
    }

    return mapOrderToStaffDetailsDto(order);
  }

  async findOrdersForStaffByUser(query: string): Promise<StaffOrderListItemDto[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new BadRequestException('Поисковый запрос не может быть пустым.');
    }

    const normalizedQuery = trimmed.replace(/^@/, '');

    const orders = await this.prisma.order.findMany({
      where: {
        user: {
          OR: [
            { username: { equals: normalizedQuery, mode: 'insensitive' } },
            { telegramId: normalizedQuery },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: STAFF_ORDER_LIST_LIMIT,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            productTitle: true,
            productImage: true,
          },
        },
      },
    });

    return orders.map(mapOrderToStaffListItemDto);
  }

  async updateStatusByStaff(
    orderId: string,
    nextStatus: SharedOrderStatus,
    staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
      if (!staff) {
      throw new BadRequestException('Staff context is required.');
    }

    if (nextStatus === SharedOrderStatus.TRACK_CODE_RECEIVED) {
      throw new BadRequestException(
        'Статус трек-кода можно установить только через ввод трек-кода.',
      );
    }

    const updatedOrderId = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              isChannelSubscriber: true,
              hasUsedSubscriberBenefit: true,
            },
          },
          items: {
            select: {
              id: true,
              priceYuan: true,
              originalTotalUsd: true,
              totalUsd: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Заказ не найден.');
      }

      const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.status];
      const prismaNextStatus = nextStatus as OrderStatus;

      if (!allowedTransitions.includes(prismaNextStatus)) {
        throw new BadRequestException(
          `Переход из статуса ${order.status} в ${nextStatus} недоступен.`,
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: prismaNextStatus,
        },
      });

      const benefitResult =
        prismaNextStatus === OrderStatus.PAID_AWAITING_PURCHASE
          ? await this.subscriberBenefitService.applyIfEligible(tx, order)
          : null;

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: prismaNextStatus,
          changedByStaffId: staff.id,
          comment:
            benefitResult?.applied
              ? `Льгота подписчика применена. Новая сумма заказа: $${benefitResult.adjustedTotalUsd.toFixed(2)}.`
              : undefined,
        },
      });

      return { orderId: order.id, userTelegramId: order.user?.telegramId };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    const staffOrder = await this.getOrderForStaff(updatedOrderId.orderId);

    if (updatedOrderId.userTelegramId) {
      try {
        await this.orderNotificationsService.notifyUserAboutStatusChange(
          updatedOrderId.userTelegramId,
          staffOrder.orderNumber,
          nextStatus,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify user about status change: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return staffOrder;
  }

  async setTrackCodeByStaff(
    orderId: string,
    rawTrackCode: string,
    staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) {
      throw new BadRequestException('Staff context is required.');
    }

    const trackCode = rawTrackCode.trim();

    if (!trackCode) {
      throw new BadRequestException('Трек-код не может быть пустым.');
    }

    const updatedOrderId = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: { telegramId: true },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Заказ не найден.');
      }

      if (
        order.status !== OrderStatus.DELIVERY_PAID &&
        order.status !== OrderStatus.DUTY_PAID &&
        order.status !== OrderStatus.TRACK_CODE_RECEIVED
      ) {
        throw new BadRequestException(
          'Трек-код можно ввести только после оплаты доставки (и пошлины, если есть).',
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          trackCode,
          status: OrderStatus.TRACK_CODE_RECEIVED,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.TRACK_CODE_RECEIVED,
          changedByStaffId: staff.id,
          comment:
            order.status === OrderStatus.TRACK_CODE_RECEIVED
              ? 'Трек-код обновлён менеджером.'
              : 'Трек-код получен от менеджера.',
        },
      });

      return { orderId: order.id, userTelegramId: order.user?.telegramId, orderNumber: order.orderNumber };
    });

    const staffOrder = await this.getOrderForStaff(updatedOrderId.orderId);

    if (updatedOrderId.userTelegramId) {
      try {
        await this.orderNotificationsService.notifyUserAboutStatusChange(
          updatedOrderId.userTelegramId,
          updatedOrderId.orderNumber,
          SharedOrderStatus.TRACK_CODE_RECEIVED,
          trackCode,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify user about track code: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return staffOrder;
  }

  // ============================================================
  // Cancellation
  // ============================================================

  /** Statuses a customer is allowed to self-cancel from. */
  private readonly CLIENT_CANCELLABLE: OrderStatus[] = [
    OrderStatus.CREATED,
    OrderStatus.PAYMENT_PENDING,
  ];

  /** Terminal statuses — no further transitions allowed. */
  private readonly TERMINAL_STATUSES: OrderStatus[] = [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ];

  /** Customer-initiated cancel. Allowed only before goods payment. */
  async cancelByClient(
    user: User,
    orderId: string,
    reason?: string,
  ): Promise<OrderDetailsDto> {
    const order = await this.getOwnedOrderOrThrow(user.id, orderId);

    if (!this.CLIENT_CANCELLABLE.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        'Этот заказ уже нельзя отменить самостоятельно. Свяжитесь с менеджером.',
      );
    }

    await this.executeCancellation(order.id, order.status as OrderStatus, {
      reason: reason?.trim() || 'Отменено клиентом',
      changedByStaffId: null,
    });

    // Tell the manager so they can react.
    await this.orderNotificationsService
      .notifyManagersAboutCancellation(order.orderNumber, 'клиентом', reason)
      .catch((err) =>
        this.logger.warn(
          `Failed to notify managers about client cancellation: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );

    return this.getCurrentUserOrderById(user.id, orderId);
  }

  /** Manager/admin cancel. Allowed from any non-terminal state. */
  /**
   * Hard-delete an order. Used by staff to clean up test / spam orders that
   * shouldn't show up in analytics or history. Cascades to order items and
   * status history via the schema. Available to ADMIN and MANAGER.
   *
   * The order's user is NOT touched. If they had `hasUsedSubscriberBenefit`
   * set by this order, we leave it as-is (the manager should fix it via the
   * benefit toggle on a future manual order rather than touching the user
   * row implicitly).
   */
  async deleteOrderByStaff(
    orderId: string,
    staff?: StaffAccount,
  ): Promise<{ ok: true; orderNumber: string }> {
    if (!staff || (staff.role !== StaffRole.ADMIN && staff.role !== StaffRole.MANAGER)) {
      throw new ForbiddenException('Удаление заказов доступно только сотрудникам.');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException('Заказ не найден.');
    }

    await this.prisma.order.delete({ where: { id: order.id } });

    this.logger.log(
      `Order ${order.orderNumber} (${order.id}) hard-deleted by staff ${staff.id}.`,
    );

    return { ok: true, orderNumber: order.orderNumber };
  }

  async cancelByStaff(
    orderId: string,
    staff?: StaffAccount,
    reason?: string,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) throw new BadRequestException('Staff context is required.');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { telegramId: true } } },
    });
    if (!order) throw new NotFoundException('Заказ не найден.');

    if (this.TERMINAL_STATUSES.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        order.status === OrderStatus.CANCELLED
          ? 'Заказ уже отменён.'
          : 'Завершённый заказ нельзя отменить.',
      );
    }

    await this.executeCancellation(order.id, order.status as OrderStatus, {
      reason: reason?.trim() || 'Отменено менеджером',
      changedByStaffId: staff.id,
    });

    if (order.user?.telegramId) {
      await this.orderNotificationsService
        .notifyUserAboutStatusChange(
          order.user.telegramId,
          order.orderNumber,
          SharedOrderStatus.CANCELLED,
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to notify user about staff cancellation: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
    }

    return this.getOrderForStaff(orderId);
  }

  /**
   * Auto-cancel stale orders.
   *   CREATED: stuck > 24h
   *   PAYMENT_PENDING: stuck > 48h
   * Returns the number of orders cancelled.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoCancelStaleOrders(): Promise<number> {
    const now = Date.now();
    const stale24h = new Date(now - 24 * 60 * 60 * 1000);
    const stale48h = new Date(now - 48 * 60 * 60 * 1000);

    const candidates = await this.prisma.order.findMany({
      where: {
        OR: [
          { status: OrderStatus.CREATED, updatedAt: { lt: stale24h } },
          { status: OrderStatus.PAYMENT_PENDING, updatedAt: { lt: stale48h } },
        ],
      },
      include: { user: { select: { telegramId: true } } },
    });

    if (candidates.length === 0) return 0;

    for (const order of candidates) {
      try {
        await this.executeCancellation(order.id, order.status as OrderStatus, {
          reason: 'Авто-отмена: статус не менялся слишком долго',
          changedByStaffId: null,
        });

        if (order.user?.telegramId) {
          await this.orderNotificationsService
            .notifyUserAboutStatusChange(
              order.user.telegramId,
              order.orderNumber,
              SharedOrderStatus.CANCELLED,
            )
            .catch(() => undefined);
        }
      } catch (err) {
        this.logger.warn(
          `Auto-cancel failed for order ${order.orderNumber}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(`Auto-cancelled ${candidates.length} stale orders.`);
    return candidates.length;
  }

  private async executeCancellation(
    orderId: string,
    fromStatus: OrderStatus,
    opts: { reason: string; changedByStaffId: string | null },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: opts.reason.slice(0, 256),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus,
          toStatus: OrderStatus.CANCELLED,
          changedByStaffId: opts.changedByStaffId ?? undefined,
          comment: opts.reason,
        },
      });
    });
  }

  // ============================================================
  // Phase 2: actual delivery / duty payment cycle
  // ============================================================

  /**
   * Manager enters actual delivery cost. Transitions
   *   TRACK_CODE_RECEIVED -> DELIVERY_PAYMENT_PENDING
   * and notifies the customer.
   */
  async setActualDeliveryByStaff(
    orderId: string,
    actualDeliveryRub: number,
    staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) throw new BadRequestException('Staff context is required.');
    if (!Number.isFinite(actualDeliveryRub) || actualDeliveryRub < 0) {
      throw new BadRequestException('Сумма доставки должна быть положительным числом.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { telegramId: true } } },
      });
      if (!order) throw new NotFoundException('Заказ не найден.');

      if (
        order.status !== OrderStatus.PURCHASED &&
        order.status !== OrderStatus.DELIVERY_PAYMENT_PENDING
      ) {
        throw new BadRequestException(
          'Стоимость доставки можно ввести только после выкупа товара.',
        );
      }

      const wasInitial = order.status !== OrderStatus.DELIVERY_PAYMENT_PENDING;

      await tx.order.update({
        where: { id: order.id },
        data: {
          actualDeliveryRub: new Prisma.Decimal(actualDeliveryRub),
          actualDeliverySetAt: new Date(),
          status: OrderStatus.DELIVERY_PAYMENT_PENDING,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERY_PAYMENT_PENDING,
          changedByStaffId: staff.id,
          comment: wasInitial
            ? `Стоимость доставки: ${actualDeliveryRub} ₽`
            : `Стоимость доставки изменена: ${actualDeliveryRub} ₽`,
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userTelegramId: order.user?.telegramId,
        wasInitial,
      };
    });

    if (result.userTelegramId && result.wasInitial) {
      try {
        await this.orderNotificationsService.notifyUserAboutStatusChange(
          result.userTelegramId,
          result.orderNumber,
          SharedOrderStatus.DELIVERY_PAYMENT_PENDING,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify user about delivery cost: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return this.getOrderForStaff(result.orderId);
  }

  /**
   * Manager confirms delivery payment was received.
   *   DELIVERY_PAYMENT_PENDING -> DELIVERY_PAID
   */
  async markDeliveryPaidByStaff(
    orderId: string,
    staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) throw new BadRequestException('Staff context is required.');

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { telegramId: true } } },
      });
      if (!order) throw new NotFoundException('Заказ не найден.');

      if (order.status !== OrderStatus.DELIVERY_PAYMENT_PENDING) {
        throw new BadRequestException(
          'Подтвердить оплату доставки можно только из статуса «Ожидание оплаты доставки».',
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DELIVERY_PAID,
          deliveryPaidAt: new Date(),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERY_PAID,
          changedByStaffId: staff.id,
          comment: 'Оплата доставки подтверждена менеджером.',
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userTelegramId: order.user?.telegramId,
      };
    });

    if (result.userTelegramId) {
      try {
        await this.orderNotificationsService.notifyUserAboutStatusChange(
          result.userTelegramId,
          result.orderNumber,
          SharedOrderStatus.DELIVERY_PAID,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify user about delivery payment: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return this.getOrderForStaff(result.orderId);
  }

  /**
   * Manager enters actual customs duty.
   *   DELIVERY_PAID -> DUTY_PAYMENT_PENDING
   */
  async setActualDutyByStaff(
    orderId: string,
    actualDutyRub: number,
    staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) throw new BadRequestException('Staff context is required.');
    if (!Number.isFinite(actualDutyRub) || actualDutyRub < 0) {
      throw new BadRequestException('Сумма пошлины должна быть положительным числом или 0.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { telegramId: true } } },
      });
      if (!order) throw new NotFoundException('Заказ не найден.');

      if (
        order.status !== OrderStatus.DELIVERY_PAID &&
        order.status !== OrderStatus.DUTY_PAYMENT_PENDING
      ) {
        throw new BadRequestException(
          'Стоимость пошлины можно ввести только после оплаты доставки.',
        );
      }

      const wasInitial = order.status !== OrderStatus.DUTY_PAYMENT_PENDING;

      await tx.order.update({
        where: { id: order.id },
        data: {
          actualDutyRub: new Prisma.Decimal(actualDutyRub),
          actualDutySetAt: new Date(),
          status: OrderStatus.DUTY_PAYMENT_PENDING,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.DUTY_PAYMENT_PENDING,
          changedByStaffId: staff.id,
          comment: wasInitial
            ? `Стоимость пошлины: ${actualDutyRub} ₽`
            : `Стоимость пошлины изменена: ${actualDutyRub} ₽`,
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userTelegramId: order.user?.telegramId,
        wasInitial,
      };
    });

    if (result.userTelegramId && result.wasInitial) {
      try {
        await this.orderNotificationsService.notifyUserAboutStatusChange(
          result.userTelegramId,
          result.orderNumber,
          SharedOrderStatus.DUTY_PAYMENT_PENDING,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify user about duty cost: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return this.getOrderForStaff(result.orderId);
  }

  /**
   * Manager confirms duty payment.
   *   DUTY_PAYMENT_PENDING -> DUTY_PAID
   */
  async markDutyPaidByStaff(
    orderId: string,
    staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) throw new BadRequestException('Staff context is required.');

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { telegramId: true } } },
      });
      if (!order) throw new NotFoundException('Заказ не найден.');

      if (order.status !== OrderStatus.DUTY_PAYMENT_PENDING) {
        throw new BadRequestException(
          'Подтвердить оплату пошлины можно только из статуса «Ожидание оплаты пошлины».',
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DUTY_PAID,
          dutyPaidAt: new Date(),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.DUTY_PAID,
          changedByStaffId: staff.id,
          comment: 'Оплата пошлины подтверждена менеджером.',
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userTelegramId: order.user?.telegramId,
      };
    });

    if (result.userTelegramId) {
      try {
        await this.orderNotificationsService.notifyUserAboutStatusChange(
          result.userTelegramId,
          result.orderNumber,
          SharedOrderStatus.DUTY_PAID,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify user about duty payment: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return this.getOrderForStaff(result.orderId);
  }

  /**
   * Manager marks order as delivered. Valid from DELIVERY_PAID (no duty)
   * or DUTY_PAID (duty paid).
   */
  async markDeliveredByStaff(
    orderId: string,
    staff?: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    if (!staff) throw new BadRequestException('Staff context is required.');

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { telegramId: true } } },
      });
      if (!order) throw new NotFoundException('Заказ не найден.');

      if (order.status !== OrderStatus.TRACK_CODE_RECEIVED) {
        throw new BadRequestException(
          'Завершить заказ можно только после ввода трек-кода.',
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED, deliveredAt: new Date() },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERED,
          changedByStaffId: staff.id,
          comment: 'Заказ отмечен как доставленный.',
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userTelegramId: order.user?.telegramId,
      };
    });

    if (result.userTelegramId) {
      try {
        await this.orderNotificationsService.notifyUserAboutStatusChange(
          result.userTelegramId,
          result.orderNumber,
          SharedOrderStatus.DELIVERED,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify user about delivery completion: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return this.getOrderForStaff(result.orderId);
  }

  private async getOwnedOrderOrThrow(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        statusHistory: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Заказ не найден.');
    }

    return order;
  }

  private async getOrderForStaffOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Заказ не найден.');
    }

    return order;
  }

  private async getStaffOrdersByStatuses(
    statuses: OrderStatus[],
  ): Promise<StaffOrderListItemDto[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: statuses,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: STAFF_ORDER_LIST_LIMIT,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            productTitle: true,
            productImage: true,
          },
        },
      },
    });

    return orders.map(mapOrderToStaffListItemDto);
  }
}
