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
  // Items are often bought in advance, before the client pays.
  OrderStatus.PAYMENT_PENDING,
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

/** Distinct RAKETA orders of our order (items sent under one China track share one). */
export function distinctRaketaOrderIds(items: Array<{ raketaOrderId: string | null }>): string[] {
  return [...new Set(items.map((item) => item.raketaOrderId).filter((id): id is string => Boolean(id)))];
}

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
      throw new BadRequestException('Для этого статуса заказа китайский трек ввести нельзя.');
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

      // Poizon sometimes ships several items under one track: they go into one RAKETA order.
      const sibling = order.items.find(
        (other) => other.id !== item.id && other.raketaOrderId && (other.chinaTrackNumber ?? '').toUpperCase() === track,
      );
      if (sibling?.raketaOrderId) {
        if (order.raketaDeliveryAssignedAt) {
          throw new Error('доставка по заказу уже оформлена — добавить вещь в эту посылку нельзя, оформите её вручную');
        }
        const ruTitleAdded = buildRaketaItemTitle({
          title: item.productTitle,
          categoryL1: item.categoryL1,
          categoryL2: item.categoryL2,
          categoryL3: item.categoryL3,
        });
        const existing = await this.raketa.getOrder(sibling.raketaOrderId);
        await this.raketa.addOrderItem({
          orderId: sibling.raketaOrderId,
          declarantId: await this.raketa.getOwnDeclarantId(),
          item: await this.itemPayload({
            ruTitle: ruTitleAdded,
            link: item.dewuLink,
            dwSpuId: item.dwSpuId,
            productTitle: item.productTitle,
            size: item.sizeLabel,
            quantity: item.quantity,
            priceYuan: Number(item.priceYuan),
          }),
          title: `${existing.title} + ${ruTitleAdded}`,
        });
        await this.prisma.orderItem.update({ where: { id: item.id }, data: { chinaTrackNumber: track } });
        await this.linkItem(
          order,
          item.id,
          { ...existing, china_track_number: track },
          staff,
          'дополнен ещё одной вещью (тот же китайский трек)',
        );
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
      const base = order.raketaTitle?.trim() || order.orderNumber;
      const label = order.items.length > 1 ? `${base}-${index + 1}` : base;

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
        insurance: order.insurance,
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

  /**
   * Staff picks the CDEK point for an order whose address was typed by hand
   * (old clients). Saved on the order AND on the client's address, so next
   * orders already have it; then the delivery step runs if everything's ready.
   */
  async setPickupPoint(
    orderId: string,
    point: { cityId: string; city: string; region?: string | null; pvzCode: string; pvzIndex?: string | null },
    label: string,
    staff: StaffAccount,
  ): Promise<StaffOrderDetailsDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.raketaDeliveryAssignedAt) {
      throw new BadRequestException('Доставка уже оформлена в RAKETA — пункт менять нельзя.');
    }
    const columns = {
      cityId: point.cityId,
      city: point.city,
      region: point.region ?? null,
      pvzCode: point.pvzCode,
      pvzIndex: point.pvzIndex ?? null,
    };
    const cdekAddress = label.trim().slice(0, 512);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          deliveryCdekAddress: cdekAddress,
          deliveryCityId: columns.cityId,
          deliveryCity: columns.city,
          deliveryRegion: columns.region,
          deliveryPvzCode: columns.pvzCode,
          deliveryPvzIndex: columns.pvzIndex,
          raketaAddressId: null,
          raketaLastError: null,
        },
      });

      // Pin it to the client's saved address (the one used for this order), or add one.
      if (order.userId) {
        const own = order.deliveryAddressId
          ? await tx.deliveryAddress.findFirst({ where: { id: order.deliveryAddressId, userId: order.userId } })
          : null;
        if (own) {
          await tx.deliveryAddress.update({ where: { id: own.id }, data: { cdekAddress, ...columns } });
        } else if (order.deliveryFullName && order.deliveryPhone) {
          const count = await tx.deliveryAddress.count({ where: { userId: order.userId } });
          const created = await tx.deliveryAddress.create({
            data: {
              userId: order.userId,
              fullName: order.deliveryFullName,
              phone: order.deliveryPhone,
              cdekAddress,
              isDefault: count === 0,
              ...columns,
            },
          });
          await tx.order.update({ where: { id: order.id }, data: { deliveryAddressId: created.id } });
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          changedByStaffId: staff.id,
          comment: `Пункт СДЭК выбран менеджером: ${cdekAddress} (было: ${order.deliveryCdekAddress ?? '—'}).`,
        },
      });
    });

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
        (await this.raketa.findOrCreateRecipient({ ...name, phone10 }));
      if (!order.raketaRecipientId) {
        await this.prisma.order.update({ where: { id: order.id }, data: { raketaRecipientId: recipientId } });
      }

      const addressId =
        order.raketaAddressId ??
        (await this.raketa.findOrCreateCdekAddress({
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
      const raketaOrderIds = distinctRaketaOrderIds(order.items);
      if (raketaOrderIds.length > 1) {
        const consolidationId =
          order.raketaConsolidationId ??
          (await this.raketa.createConsolidation({
            title: order.raketaTitle?.trim() || `${order.orderNumber} ${name.lastName} ${order.items.length} шт`,
            orderIds: raketaOrderIds,
            recipientId,
            addressId,
            insurance: order.insurance,
          }));
        await this.prisma.order.update({ where: { id: order.id }, data: { raketaConsolidationId: consolidationId } });
        summary = `создано объединение из ${raketaOrderIds.length} заказов (${order.items.length} шт)`;
      } else {
        await this.raketa.assignOrderDelivery({
          orderId: raketaOrderIds[0],
          declarantId: await this.raketa.getOwnDeclarantId(),
          recipientId,
          addressId,
          insurance: order.insurance,
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
   * Admin tool: register purchases that aren't customer orders (for
   * yourself / without commission) straight in RAKETA. One RAKETA order per
   * item; with a recipient + CDEK point, one item gets them on its order and
   * several items are grouped into one consolidation.
   */
  async createQuickOrders(input: {
    label?: string | null;
    /** Consolidation title; defaults to "<label> N шт". */
    title?: string | null;
    insurance?: boolean;
    items: Array<{
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
      titleCn?: string | null;
    }>;
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
    orders: Array<{ id: string; raketaTrackNumber: string | null; title: string; existed: boolean }>;
    consolidationId: string | null;
    deliveryAssigned: boolean;
    deliveryError: string | null;
  }> {
    const tracks = input.items.map((item) => item.chinaTrackNumber.replace(/\s+/g, '').toUpperCase());
    tracks.forEach((track, i) => {
      if (!CHINA_TRACK_RE.test(track) || RAKETA_NUMBER_RE.test(track)) {
        throw new BadRequestException(
          `Товар ${i + 1}: китайский трек — латинские буквы и цифры, от 9 символов (например SF1234567890).`,
        );
      }
    });
    const label = (input.label ?? '').trim().slice(0, 40) || 'Личный';
    // Items with the same China track (Poizon shipped them together) → one RAKETA order.
    const groups = new Map<string, number[]>();
    tracks.forEach((track, i) => groups.set(track, [...(groups.get(track) ?? []), i]));
    const many = groups.size > 1;
    const orders: Array<{ id: string; raketaTrackNumber: string | null; title: string; existed: boolean }> = [];

    let groupNo = 0;
    for (const [track, indexes] of groups) {
      groupNo++;
      const [i, ...rest] = indexes;
      const item = input.items[i];
      const ruTitle = buildRaketaItemTitle({
        title: item.productTitle,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        categoryL3: item.categoryL3,
      });
      const title = `${many ? `${label}-${groupNo}` : label}) ${ruTitle}`;
      try {
        const { order, existed } = await this.findOrCreate({
          title,
          track: tracks[i],
          ruTitle,
          link: item.link,
          dwSpuId: item.dwSpuId,
          productTitle: item.productTitle,
          size: item.size,
          quantity: item.quantity,
          priceYuan: item.priceYuan,
          titleCn: item.titleCn,
          insurance: input.insurance,
        });
        let fullTitle = order.title || title;
        for (const j of rest) {
          const extra = input.items[j];
          const extraTitle = buildRaketaItemTitle({
            title: extra.productTitle,
            categoryL1: extra.categoryL1,
            categoryL2: extra.categoryL2,
            categoryL3: extra.categoryL3,
          });
          fullTitle = `${fullTitle} + ${extraTitle}`;
          await this.raketa.addOrderItem({
            orderId: order.id,
            declarantId: await this.raketa.getOwnDeclarantId(),
            item: await this.itemPayload({
              ruTitle: extraTitle,
              link: extra.link,
              dwSpuId: extra.dwSpuId,
              productTitle: extra.productTitle,
              size: extra.size,
              quantity: extra.quantity,
              priceYuan: extra.priceYuan,
              titleCn: extra.titleCn,
            }),
            title: fullTitle,
          });
        }
        orders.push({ id: order.id, raketaTrackNumber: order.raketa_track_number ?? null, title: fullTitle, existed });
        this.logger.log(`RAKETA quick order ${order.id} ${existed ? 'found' : 'created'} (${track}, ${indexes.length} шт)`);
      } catch (error) {
        const done = orders.length
          ? ` Уже созданы: ${orders.map((o) => o.raketaTrackNumber ?? o.id).join(', ')}.`
          : '';
        throw new BadRequestException(`RAKETA: трек ${track} — ${errorText(error)}.${done}`);
      }
    }

    // Optional recipient + CDEK point; a failure here doesn't undo the orders.
    let consolidationId: string | null = null;
    let deliveryAssigned = false;
    let deliveryError: string | null = null;
    if (input.delivery) {
      try {
        const name = splitFullName(input.delivery.fullName);
        if (!name) throw new Error('ФИО: нужны фамилия и имя на русском.');
        const phone10 = input.delivery.phone.replace(/\D/g, '').replace(/^[78](\d{10})$/, '$1');
        if (!/^\d{10}$/.test(phone10)) throw new Error('Телефон должен быть в формате +7XXXXXXXXXX.');
        const point = input.delivery.pickupPoint;
        const recipientId = await this.raketa.findOrCreateRecipient({ ...name, phone10 });
        const addressId = await this.raketa.findOrCreateCdekAddress({
          title: `${input.delivery.fullName} — ${point.city}`,
          cityId: point.cityId,
          city: point.city,
          region: point.region ?? null,
          pvzCode: point.pvzCode,
          pvzIndex: point.pvzIndex ?? null,
          street: input.delivery.pointAddress,
        });
        if (many) {
          consolidationId = await this.raketa.createConsolidation({
            title: input.title?.trim() || `${label} ${orders.length} шт`,
            orderIds: orders.map((o) => o.id),
            recipientId,
            addressId,
            insurance: input.insurance,
          });
        } else {
          await this.raketa.assignOrderDelivery({
            orderId: orders[0].id,
            declarantId: await this.raketa.getOwnDeclarantId(),
            recipientId,
            addressId,
            insurance: input.insurance,
          });
        }
        deliveryAssigned = true;
      } catch (error) {
        deliveryError = errorText(error);
        this.logger.warn(`RAKETA quick orders delivery failed: ${deliveryError}`);
      }
    }

    return { orders, consolidationId, deliveryAssigned, deliveryError };
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
    titleCn?: string | null;
    insurance?: boolean;
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
        items: [await this.itemPayload(input)],
        additional_services: [],
        delivery_type: null,
        receive_type: null,
        customer_recipient_id: null,
        customer_address_id: null,
        tc_tariff_token: null,
        consolidation_id: null,
        draft: false,
        insurance: Boolean(input.insurance),
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

  /** One RAKETA order item: Russian title, Chinese description, price ¥. */
  private async itemPayload(input: {
    ruTitle: string;
    link: string;
    dwSpuId: string;
    productTitle: string;
    size: string;
    quantity: number;
    priceYuan: number;
    titleCn?: string | null;
  }) {
    return {
      link: input.link,
      item_title: input.ruTitle,
      discription_cn: input.titleCn
        ? `${input.titleCn} 尺码 ${input.size}`.slice(0, 500)
        : await this.chineseDescription(input.dwSpuId, input.productTitle, input.size),
      count: input.quantity,
      price_cn: input.priceYuan.toFixed(0),
      additional_services: [] as string[],
    };
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
