import type { OrderTrackingDto, OrderTrackingItemDto } from '@lean-poizon/shared';
import { OrderStatus as SharedOrderStatus } from '@lean-poizon/shared';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { RaketaClientService, type RaketaTracking } from '../../raketa/raketa-client.service';
import { OrderNotificationsService } from './order-notifications.service';

/** RAKETA's milestones, in order (same names as its tracker's `line`). */
const MILESTONES = [
  'Создан',
  'На складе в Китае',
  'Отправлен в РФ',
  'На таможне',
  'На складе в РФ',
  'В пути по РФ',
  'Доставлен',
] as const;
const AT_CHINA_WAREHOUSE = 1;
const RF_SENT = 5;
const DELIVERED = 6;

const ARRIVED_EVENT = 'china_arrived_at_RAKETA_warehouse_in_China';
const ASSEMBLED_EVENT = 'china_union_assembly_is_complete';

/** After the delivery is paid the parcel is ours to follow until it's delivered. */
const FOLLOW_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERY_PAID,
  OrderStatus.DUTY_PAYMENT_PENDING,
  OrderStatus.DUTY_PAID,
  OrderStatus.TRACK_CODE_RECEIVED,
];

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const reached = (tracking: RaketaTracking | null, index: number) =>
  Boolean(tracking?.line.find((step) => step.name === MILESTONES[index])?.active);

/**
 * Parcel tracking from RAKETA's public tracker. Two kinds of orders:
 *  - single item → tracked by the item's own RA… number the whole way;
 *  - several items → each RA… travels to the China warehouse on its own,
 *    then they're packed into one consolidation parcel tracked by its RAC….
 * A sync every 30 min stores the parcel / CDEK numbers and moves the order:
 * «В пути по РФ» → TRACK_CODE_RECEIVED with the CDEK track, «Доставлен» → DELIVERED.
 */
@Injectable()
export class RaketaTrackingService {
  private readonly logger = new Logger(RaketaTrackingService.name);
  private syncing = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaketaClientService) private readonly raketa: RaketaClientService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  /** Tracking for the order page; null when the order isn't handled through RAKETA. */
  async getForUser(userId: string, orderId: string): Promise<OrderTrackingDto | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.fulfillmentManual || !order.items.some((item) => item.raketaTrackNumber)) return null;

    const consolidated = order.items.length > 1 || Boolean(order.raketaConsolidationId);
    const mainTrack = consolidated ? order.raketaParcelTrack : order.items[0].raketaTrackNumber;
    const track = (number: string | null | undefined) =>
      number ? this.raketa.getTracking(number).catch(() => null) : Promise.resolve(null);

    const [main, ...itemTracks] = await Promise.all([
      track(mainTrack),
      ...(consolidated ? order.items.map((item) => track(item.raketaTrackNumber)) : []),
    ]);

    const items: OrderTrackingItemDto[] = consolidated
      ? order.items.map((item, i) => {
          const events = itemTracks[i]?.events ?? [];
          return {
            title: item.productTitle,
            size: item.sizeLabel,
            trackNumber: item.raketaTrackNumber,
            arrived: events.some((e) => e.id === ARRIVED_EVENT) || reached(itemTracks[i], AT_CHINA_WAREHOUSE + 1),
            lastEvent: events.at(-1)?.name ?? null,
          };
        })
      : [];

    // RAKETA marks «На складе в Китае» active even on a fresh parcel, so this
    // step is judged by the arrival event (consolidation: every item arrived,
    // or the parcel is already packed).
    const done = MILESTONES.map((_, index) => {
      if (index === 0) return true;
      if (index !== AT_CHINA_WAREHOUSE) return reached(main, index);
      if (reached(main, index + 1)) return true;
      if (!consolidated) return Boolean(main?.events.some((e) => e.id === ARRIVED_EVENT));
      const assembled = Boolean(main?.events.some((e) => e.id === ASSEMBLED_EVENT));
      return assembled || (items.length > 0 && items.every((item) => item.arrived));
    });
    // A later milestone implies the earlier ones.
    const last = done.lastIndexOf(true);
    const steps = MILESTONES.map((name, index) => ({ name, done: index <= last, current: index === last }));

    return {
      kind: consolidated ? 'consolidation' : 'single',
      trackNumber: mainTrack ?? null,
      cdekTrack: order.trackCode ?? order.raketaTkTrack ?? null,
      steps,
      events: [...(main?.events ?? [])].reverse().map((e) => ({ name: e.name, at: e.at })),
      items,
    };
  }

  @Cron('0 5,35 * * * *')
  async syncTracking(): Promise<void> {
    if (this.syncing || !this.raketa.isConfigured) return;
    this.syncing = true;
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          raketaDeliveryAssignedAt: { not: null },
          fulfillmentManual: false,
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        },
        include: {
          items: { select: { raketaOrderId: true }, orderBy: { createdAt: 'asc' } },
          user: { select: { telegramId: true } },
        },
      });
      for (const order of orders) {
        try {
          await this.syncOrder(order);
        } catch (error) {
          this.logger.warn(`RAKETA tracking for ${order.orderNumber}: ${errorText(error)}`);
        }
      }
    } finally {
      this.syncing = false;
    }
  }

  private async syncOrder(order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    trackCode: string | null;
    raketaConsolidationId: string | null;
    raketaParcelTrack: string | null;
    raketaTkTrack: string | null;
    raketaPaidAt: Date | null;
    items: Array<{ raketaOrderId: string | null }>;
    user: { telegramId: string } | null;
  }): Promise<void> {
    // Parcel number + CDEK track: consolidation card, or the single order card.
    let parcel: string | null = null;
    let tk: string | null = null;
    if (order.raketaConsolidationId) {
      const c = await this.raketa.getConsolidation(order.raketaConsolidationId);
      parcel = c.raketa_track_number ?? null;
      tk = c.tk_track_number ?? null;
    } else if (order.items.length === 1 && order.items[0].raketaOrderId) {
      const o = await this.raketa.getOrder(order.items[0].raketaOrderId);
      parcel = o.raketa_track_number ?? null;
      tk = o.tk_track_number ?? null;
    } else {
      return;
    }
    if (parcel !== order.raketaParcelTrack || tk !== order.raketaTkTrack) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { raketaParcelTrack: parcel, raketaTkTrack: tk },
      });
    }
    if (!parcel || !order.raketaPaidAt || !FOLLOW_STATUSES.includes(order.status)) return;

    const tracking = await this.raketa.getTracking(parcel);
    const cdek = order.trackCode ?? tk;

    if (reached(tracking, DELIVERED)) {
      await this.move(order, OrderStatus.DELIVERED, cdek, 'RAKETA: посылка доставлена.');
      return;
    }
    if (reached(tracking, RF_SENT) && cdek && order.status !== OrderStatus.TRACK_CODE_RECEIVED) {
      await this.move(order, OrderStatus.TRACK_CODE_RECEIVED, cdek, `RAKETA: посылка передана в СДЭК, трек ${cdek}.`);
    }
  }

  private async move(
    order: { id: string; orderNumber: string; status: OrderStatus; user: { telegramId: string } | null },
    to: OrderStatus,
    trackCode: string | null,
    comment: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: to,
          ...(trackCode ? { trackCode } : {}),
          ...(to === OrderStatus.TRACK_CODE_RECEIVED ? { trackCodeReceivedAt: now } : {}),
          ...(to === OrderStatus.DELIVERED ? { deliveredAt: now } : {}),
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: to, comment },
      });
    });
    this.logger.log(`${order.orderNumber}: ${order.status} → ${to} (RAKETA tracking)`);
    if (order.user?.telegramId) {
      await this.notifications.notifyUserAboutStatusChange(
        order.user.telegramId,
        order.orderNumber,
        to as unknown as SharedOrderStatus,
        trackCode,
        { orderId: order.id },
      );
    }
  }
}
