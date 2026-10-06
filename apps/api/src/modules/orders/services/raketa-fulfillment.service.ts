import type { StaffOrderDetailsDto } from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { DewuApiClientService } from '../../products/services/dewu-api-client.service';
import { type RaketaOrder, RaketaClientService } from '../../raketa/raketa-client.service';
import { buildRaketaItemTitle } from '../../raketa/raketa-title';
import { OrdersService } from '../orders.service';

/** RAKETA's seller directory id for "Poizon (Dewu)". */
const RAKETA_POIZON_SELLER_ID = 5;

/** Statuses in which the item has been (or is being) bought on Poizon. */
const REGISTRABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID_AWAITING_PURCHASE,
  OrderStatus.PURCHASED,
  OrderStatus.DELIVERY_PAYMENT_PENDING,
  OrderStatus.DELIVERY_PAID,
  OrderStatus.DUTY_PAYMENT_PENDING,
  OrderStatus.DUTY_PAID,
];

const CHINA_TRACK_RE = /^[A-Za-z0-9]{9,40}$/;
/** RAKETA's own order number, e.g. RA172104132 — links an existing order. */
const RAKETA_NUMBER_RE = /^RA\d{6,}$/;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** "Иванов Иван Иванович" → RAKETA recipient name parts (Cyrillic only). */
function splitFullName(fullName: string): { lastName: string; name: string; middleName: string | null } | null {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((part) => /^[А-Яа-яЁё-]+$/.test(part))) return null;
  return { lastName: parts[0], name: parts[1], middleName: parts[2] ?? null };
}

/**
 * Stage 1 of the RAKETA automation: once the manager enters the China-side
 * tracking number for an item, register that item as an order in the
 * RAKETA cabinet (title in Russian, Chinese description, price, declarant).
 * Sending a RAKETA number (RA…) instead links an order created by hand.
 */
@Injectable()
export class RaketaFulfillmentService {
  private readonly logger = new Logger(RaketaFulfillmentService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaketaClientService) private readonly raketa: RaketaClientService,
    @Inject(DewuApiClientService) private readonly dewu: DewuApiClientService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
  ) {}

  async setManual(orderId: string, manual: boolean, staff: StaffAccount): Promise<StaffOrderDetailsDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден.');

    if (order.fulfillmentManual !== manual) {
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: orderId }, data: { fulfillmentManual: manual } }),
        this.prisma.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            changedByStaffId: staff.id,
            comment: manual
              ? 'RAKETA: заказ переведён на ручное оформление.'
              : 'RAKETA: автоматическое оформление включено.',
          },
        }),
      ]);
    }
    return this.ordersService.getOrderForStaff(orderId);
  }

  async registerChinaTrack(
    orderId: string,
    itemId: string,
    rawTrack: string,
    staff: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    const track = rawTrack.replace(/\s+/g, '').toUpperCase();
    if (!CHINA_TRACK_RE.test(track)) {
      throw new BadRequestException(
        'Пришлите китайский трек (латинские буквы и цифры, от 9 символов, например SF1234567890) или номер RAKETA вида RA172104132.',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.fulfillmentManual) {
      throw new BadRequestException('Заказ ведётся вручную — автоматика RAKETA для него выключена.');
    }
    if (!REGISTRABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException('Китайский трек можно ввести только после оплаты товара клиентом.');
    }

    const index = order.items.findIndex((item) => item.id === itemId);
    const item = order.items[index];
    if (!item) throw new NotFoundException('Товар не найден в заказе.');
    if (item.raketaOrderId) {
      throw new BadRequestException(
        `Этот товар уже зарегистрирован в RAKETA (${item.raketaTrackNumber ?? item.raketaOrderId}).`,
      );
    }

    try {
      // "RA…" — the order already exists in RAKETA (created by hand): link it.
      if (RAKETA_NUMBER_RE.test(track)) {
        const found = await this.raketa.findOrderByTrack(track);
        if (!found) throw new Error(`в кабинете не найден заказ ${track}`);
        await this.linkItem(order, item.id, found, staff, 'привязан по номеру RAKETA');
        await this.assignDeliveryIfReady(orderId, staff);
        return this.ordersService.getOrderForStaff(orderId);
      }

      await this.prisma.orderItem.update({ where: { id: item.id }, data: { chinaTrackNumber: track } });

      const ruTitle = buildRaketaItemTitle({
        title: item.productTitle,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        categoryL3: item.categoryL3,
      });
      const label = order.items.length > 1 ? `${order.orderNumber}-${index + 1}` : order.orderNumber;

      const { order: created, existed } = await this.findOrCreate({
        title: `${label}) ${ruTitle}`,
        track,
        ruTitle,
        link: item.dewuLink,
        dwSpuId: item.dwSpuId,
        productTitle: item.productTitle,
        size: item.sizeLabel,
        quantity: item.quantity,
        priceYuan: Number(item.priceYuan),
      });
      if (existed) {
        await this.linkItem(order, item.id, created, staff, 'привязан');
        await this.assignDeliveryIfReady(orderId, staff);
        return this.ordersService.getOrderForStaff(orderId);
      }

      await this.linkItem(order, item.id, created, staff, 'создан', `${label}) ${ruTitle}`);
      this.logger.log(`RAKETA order ${created.id} created for ${order.orderNumber} item ${index + 1}`);
    } catch (error) {
      const message = errorText(error);
      this.logger.warn(`RAKETA registration failed for ${order.orderNumber}: ${message}`);
      await this.prisma.order.update({ where: { id: order.id }, data: { raketaLastError: message.slice(0, 1000) } });
      throw new BadRequestException(`RAKETA: не удалось создать заказ — ${message}`);
    }

    await this.assignDeliveryIfReady(orderId, staff);
    return this.ordersService.getOrderForStaff(orderId);
  }

  /** Runs the delivery step once every item is registered; errors are kept on the order. */
  private async assignDeliveryIfReady(orderId: string, staff: StaffAccount): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.fulfillmentManual || order.raketaDeliveryAssignedAt) return;
    if (!order.items.every((item) => item.raketaOrderId)) return;
    try {
      await this.assignDelivery(orderId, staff);
    } catch (error) {
      // Already stored as raketaLastError — the bot shows it with a retry button.
      this.logger.warn(`RAKETA delivery step failed for ${order.orderNumber}: ${errorText(error)}`);
    }
  }

  /**
   * Stage 3: recipient + CDEK pickup-point address at RAKETA; one item → set
   * on that order, several items → one consolidation with all of them.
   */
  async assignDelivery(orderId: string, staff: StaffAccount): Promise<StaffOrderDetailsDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.fulfillmentManual) {
      throw new BadRequestException('Заказ ведётся вручную — автоматика RAKETA для него выключена.');
    }
    if (order.raketaDeliveryAssignedAt) return this.ordersService.getOrderForStaff(orderId);

    const missing = order.items.filter((item) => !item.raketaOrderId).length;
    if (missing > 0) {
      throw new BadRequestException(`Сначала зарегистрируйте в RAKETA все товары (осталось ${missing}).`);
    }
    if (!order.deliveryPvzCode || !order.deliveryCityId || !order.deliveryCity) {
      throw new BadRequestException(
        'У заказа нет пункта СДЭК из справочника (адрес введён вручную). Попросите клиента выбрать пункт в приложении или оформите доставку вручную.',
      );
    }
    const name = splitFullName(order.deliveryFullName ?? '');
    if (!name) {
      throw new BadRequestException(
        `ФИО получателя «${order.deliveryFullName ?? ''}» не подходит RAKETA: нужны фамилия и имя на русском.`,
      );
    }
    const phone10 = (order.deliveryPhone ?? '').replace(/\D/g, '').replace(/^[78](\d{10})$/, '$1');
    if (!/^\d{10}$/.test(phone10)) {
      throw new BadRequestException(`Телефон получателя «${order.deliveryPhone ?? ''}» не подходит RAKETA.`);
    }

    try {
      const recipientId =
        order.raketaRecipientId ??
        (await this.raketa.createRecipient({ ...name, phone10 }));
      if (!order.raketaRecipientId) {
        await this.prisma.order.update({ where: { id: order.id }, data: { raketaRecipientId: recipientId } });
      }

      const addressId =
        order.raketaAddressId ??
        (await this.raketa.createCdekAddress({
          title: `${order.deliveryFullName} — ${order.deliveryCity}`,
          cityId: order.deliveryCityId,
          city: order.deliveryCity,
          region: order.deliveryRegion,
          pvzCode: order.deliveryPvzCode,
          pvzIndex: order.deliveryPvzIndex,
          street: (order.deliveryCdekAddress ?? '').replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, ''),
        }));
      if (!order.raketaAddressId) {
        await this.prisma.order.update({ where: { id: order.id }, data: { raketaAddressId: addressId } });
      }

      let summary: string;
      if (order.items.length > 1) {
        const consolidationId =
          order.raketaConsolidationId ??
          (await this.raketa.createConsolidation({
            title: `${order.orderNumber} ${name.lastName} ${order.items.length} шт`,
            orderIds: order.items.map((item) => item.raketaOrderId as string),
            recipientId,
            addressId,
          }));
        await this.prisma.order.update({ where: { id: order.id }, data: { raketaConsolidationId: consolidationId } });
        summary = `создано объединение из ${order.items.length} заказов`;
      } else {
        await this.raketa.assignOrderDelivery({
          orderId: order.items[0].raketaOrderId as string,
          declarantId: await this.raketa.getOwnDeclarantId(),
          recipientId,
          addressId,
        });
        summary = 'получатель и адрес указаны в заказе';
      }

      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: order.id },
          data: { raketaDeliveryAssignedAt: new Date(), raketaLastError: null },
        }),
        this.prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: order.status,
            changedByStaffId: staff.id,
            comment: `RAKETA: ${summary}; СДЭК ${order.deliveryPvzCode}, ${order.deliveryCity}.`,
          },
        }),
      ]);
    } catch (error) {
      const message = errorText(error);
      await this.prisma.order.update({ where: { id: order.id }, data: { raketaLastError: message.slice(0, 1000) } });
      throw new BadRequestException(`RAKETA: не удалось оформить доставку — ${message}`);
    }

    return this.ordersService.getOrderForStaff(orderId);
  }

  /**
   * Admin tool: register a purchase that isn't a customer order (for
   * yourself / without commission) straight in RAKETA.
   */
  async createQuickOrder(input: {
    link: string;
    productTitle: string;
    categoryL1?: string | null;
    categoryL2?: string | null;
    categoryL3?: string | null;
    dwSpuId: string;
    size: string;
    priceYuan: number;
    quantity: number;
    chinaTrackNumber: string;
    label?: string | null;
    delivery?: {
      fullName: string;
      phone: string;
      pointAddress: string;
      pickupPoint: {
        cityId: string;
        city: string;
        region?: string | null;
        pvzCode: string;
        pvzIndex?: string | null;
      };
    };
  }): Promise<{
    id: string;
    raketaTrackNumber: string | null;
    title: string;
    existed: boolean;
    deliveryAssigned: boolean;
    deliveryError: string | null;
  }> {
    const track = input.chinaTrackNumber.replace(/\s+/g, '').toUpperCase();
    if (!CHINA_TRACK_RE.test(track) || RAKETA_NUMBER_RE.test(track)) {
      throw new BadRequestException(
        'Китайский трек: латинские буквы и цифры, от 9 символов (например SF1234567890).',
      );
    }
    const ruTitle = buildRaketaItemTitle({
      title: input.productTitle,
      categoryL1: input.categoryL1,
      categoryL2: input.categoryL2,
      categoryL3: input.categoryL3,
    });
    const label = (input.label ?? '').trim().slice(0, 40) || 'Личный';
    try {
      const { order, existed } = await this.findOrCreate({
        title: `${label}) ${ruTitle}`,
        track,
        ruTitle,
        link: input.link,
        dwSpuId: input.dwSpuId,
        productTitle: input.productTitle,
        size: input.size,
        quantity: input.quantity,
        priceYuan: input.priceYuan,
      });
      this.logger.log(`RAKETA quick order ${order.id} ${existed ? 'found' : 'created'} (${track})`);

      // Optional recipient + CDEK point; a failure here doesn't undo the order.
      let deliveryAssigned = false;
      let deliveryError: string | null = null;
      if (input.delivery) {
        try {
          const name = splitFullName(input.delivery.fullName);
          if (!name) throw new Error('ФИО: нужны фамилия и имя на русском.');
          const phone10 = input.delivery.phone.replace(/\D/g, '').replace(/^[78](\d{10})$/, '$1');
          if (!/^\d{10}$/.test(phone10)) throw new Error('Телефон должен быть в формате +7XXXXXXXXXX.');
          const point = input.delivery.pickupPoint;
          const recipientId = await this.raketa.createRecipient({ ...name, phone10 });
          const addressId = await this.raketa.createCdekAddress({
            title: `${input.delivery.fullName} — ${point.city}`,
            cityId: point.cityId,
            city: point.city,
            region: point.region ?? null,
            pvzCode: point.pvzCode,
            pvzIndex: point.pvzIndex ?? null,
            street: input.delivery.pointAddress,
          });
          await this.raketa.assignOrderDelivery({
            orderId: order.id,
            declarantId: await this.raketa.getOwnDeclarantId(),
            recipientId,
            addressId,
          });
          deliveryAssigned = true;
        } catch (error) {
          deliveryError = errorText(error);
          this.logger.warn(`RAKETA quick order delivery failed (${order.id}): ${deliveryError}`);
        }
      }

      return {
        id: order.id,
        raketaTrackNumber: order.raketa_track_number ?? null,
        title: order.title || `${label}) ${ruTitle}`,
        existed,
        deliveryAssigned,
        deliveryError,
      };
    } catch (error) {
      throw new BadRequestException(`RAKETA: не удалось создать заказ — ${errorText(error)}`);
    }
  }

  /** Reuses an existing RAKETA order with this China track, otherwise creates one. */
  private async findOrCreate(input: {
    title: string;
    track: string;
    ruTitle: string;
    link: string;
    dwSpuId: string;
    productTitle: string;
    size: string;
    quantity: number;
    priceYuan: number;
  }): Promise<{ order: RaketaOrder; existed: boolean }> {
    // Retry-safe: a previous attempt may have created the order already.
    const existing = await this.raketa.findOrderByTrack(input.track);
    if (existing) return { order: existing, existed: true };

    try {
      const order = await this.raketa.createOrder({
        title: input.title.slice(0, 190),
        china_track_number: input.track,
        seller_id: RAKETA_POIZON_SELLER_ID,
        declarant_id: await this.raketa.getOwnDeclarantId(),
        items: [
          {
            link: input.link,
            item_title: input.ruTitle,
            discription_cn: await this.chineseDescription(input.dwSpuId, input.productTitle, input.size),
            count: input.quantity,
            price_cn: input.priceYuan.toFixed(0),
            additional_services: [],
          },
        ],
        additional_services: [],
        delivery_type: null,
        receive_type: null,
        customer_recipient_id: null,
        customer_address_id: null,
        tc_tariff_token: null,
        consolidation_id: null,
        draft: false,
      });
      return { order, existed: false };
    } catch (error) {
      // RAKETA already has an order with this track (e.g. an earlier attempt
      // whose response we couldn't read) — find it among recent orders.
      if (!/уже создан/i.test(errorText(error))) throw error;
      const found = await this.raketa.scanRecentOrdersForChinaTrack(input.track);
      if (!found) {
        throw new Error(
          'RAKETA пишет, что заказ с этим треком уже создан, но найти его не удалось — пришлите его номер RAKETA (RA…), и он привяжется.',
        );
      }
      return { order: found, existed: true };
    }
  }

  private async linkItem(
    order: { id: string; status: OrderStatus },
    itemId: string,
    raketaOrder: RaketaOrder,
    staff: StaffAccount,
    verb: string,
    fallbackTitle?: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.orderItem.update({
        where: { id: itemId },
        data: {
          raketaOrderId: raketaOrder.id,
          raketaTrackNumber: raketaOrder.raketa_track_number ?? null,
          ...(raketaOrder.china_track_number ? { chinaTrackNumber: raketaOrder.china_track_number } : {}),
          raketaRegisteredAt: new Date(),
        },
      }),
      this.prisma.order.update({ where: { id: order.id }, data: { raketaLastError: null } }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          changedByStaffId: staff.id,
          comment: `RAKETA: заказ «${raketaOrder.title || fallbackTitle || ''}» ${verb}${
            raketaOrder.raketa_track_number ? ` (${raketaOrder.raketa_track_number})` : ''
          }${raketaOrder.china_track_number ? `, трек Китая ${raketaOrder.china_track_number}` : ''}.`,
        },
      }),
    ]);
  }

  /** Chinese title from the price engine (RAKETA needs a description in Chinese). */
  private async chineseDescription(dwSpuId: string, fallbackTitle: string, size: string): Promise<string> {
    try {
      const raw = await this.dewu.queryProductDetail(dwSpuId);
      const data = (raw as { data?: { titleRaw?: string } }).data;
      if (data?.titleRaw) return `${data.titleRaw} 尺码 ${size}`.slice(0, 500);
    } catch (error) {
      this.logger.warn(`Engine lookup for Chinese title failed (${dwSpuId}): ${String(error)}`);
    }
    return `${fallbackTitle} 尺码 ${size}`.slice(0, 500);
  }
}
