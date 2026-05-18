import type {
  CheckoutOrderResponse,
  OrderDetailsDto,
  OrderListItemDto,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
} from '@lean-poizon/shared';
import { OrderStatus as SharedOrderStatus } from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  type StaffAccount,
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
  [OrderStatus.PURCHASED]: [],
  // After track code, manager enters actual delivery -> DELIVERY_PAYMENT_PENDING
  [OrderStatus.TRACK_CODE_RECEIVED]: [],
  // After delivery payment is confirmed by manager -> DELIVERY_PAID.
  [OrderStatus.DELIVERY_PAYMENT_PENDING]: [OrderStatus.DELIVERY_PAID],
  // From DELIVERY_PAID manager either enters duty cost (-> DUTY_PAYMENT_PENDING)
  // or marks delivered without duty (-> DELIVERED). Both transitions are
  // handled by dedicated endpoints, not generic updateStatus.
  [OrderStatus.DELIVERY_PAID]: [OrderStatus.DELIVERED],
  [OrderStatus.DUTY_PAYMENT_PENDING]: [OrderStatus.DUTY_PAID],
  [OrderStatus.DUTY_PAID]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
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
        order.status !== OrderStatus.PURCHASED &&
        order.status !== OrderStatus.TRACK_CODE_RECEIVED
      ) {
        throw new BadRequestException(
          'Трек-код можно ввести только после статуса «Выкуплен».',
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
        order.status !== OrderStatus.TRACK_CODE_RECEIVED &&
        order.status !== OrderStatus.DELIVERY_PAYMENT_PENDING
      ) {
        throw new BadRequestException(
          'Стоимость доставки можно ввести только после получения трек-кода.',
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

      if (
        order.status !== OrderStatus.DELIVERY_PAID &&
        order.status !== OrderStatus.DUTY_PAID
      ) {
        throw new BadRequestException(
          'Завершить заказ можно после оплаты доставки (и пошлины, если она есть).',
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
