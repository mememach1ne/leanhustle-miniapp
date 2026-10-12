import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { type RaketaOrderDetails, RaketaClientService } from '../../raketa/raketa-client.service';
import { OrderNotificationsService } from './order-notifications.service';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, '').toUpperCase();

/** Orders whose RAKETA side we check (not finished, automation on). */
const ACTIVE_STATUSES_EXCLUDED: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.CREATED];

/** Time after the last RAKETA change of an order before «Собрать» may be pressed for it. */
export const ASSEMBLE_SETTLE_MS = 30 * 60 * 1000;

/**
 * Safety net for the RAKETA automation:
 *  - one RAKETA operation per order at a time (registration, delivery,
 *    «Собрать», price, payment and clicks in the panel are serialized);
 *  - `inspect()` compares our order with the cabinet (tracks, shared RAKETA
 *    orders, item counts, the consolidation and its members);
 *  - on any mismatch the order is QUARANTINED: switched to manual
 *    (automation stops touching it), the reason is stored and the owner
 *    is told once. Called before every irreversible step and every 30 min.
 */
@Injectable()
export class RaketaGuardService {
  private readonly logger = new Logger(RaketaGuardService.name);
  private readonly locks = new Map<string, Promise<unknown>>();
  private reconciling = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaketaClientService) private readonly raketa: RaketaClientService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  /** Runs `fn` after every earlier RAKETA operation on this order has finished. */
  withOrderLock<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(orderId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(fn);
    const tail = run.catch(() => undefined);
    this.locks.set(orderId, tail);
    void tail.then(() => {
      if (this.locks.get(orderId) === tail) this.locks.delete(orderId);
    });
    return run;
  }

  /** RAKETA events that need someone to act go to the owner (not the manager). */
  async notifyOwner(text: string, orderId?: string): Promise<void> {
    const owners = await this.prisma.staffAccount.findMany({
      where: { isOwner: true, isActive: true, telegramId: { not: null } },
      select: { telegramId: true },
    });
    await this.notifications
      .notifyTelegramIds(owners.map((o) => o.telegramId as string), text, orderId)
      .catch(() => undefined);
  }

  /** Our orders that own any of these RAKETA orders (to tell whose a consolidation is). */
  async ourOrdersOf(raketaOrderIds: string[]): Promise<Array<{ id: string; orderNumber: string }>> {
    if (raketaOrderIds.length === 0) return [];
    const items = await this.prisma.orderItem.findMany({
      where: { raketaOrderId: { in: raketaOrderIds } },
      select: { order: { select: { id: true, orderNumber: true } } },
    });
    const byId = new Map(items.map((i) => [i.order.id, i.order]));
    return [...byId.values()];
  }

  /**
   * Compares our order with RAKETA. Returns human-readable problems (empty =
   * consistent). Network errors are not problems — they just mean «not now».
   */
  async inspect(orderId: string): Promise<string[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!order) return [];
    const problems: string[] = [];
    const registered = order.items.filter((item) => item.raketaOrderId);
    if (registered.length === 0) return [];

    // A RAKETA order must belong to one of our orders only.
    const foreign = await this.prisma.orderItem.findMany({
      where: { raketaOrderId: { in: registered.map((i) => i.raketaOrderId as string) }, orderId: { not: order.id } },
      select: { raketaTrackNumber: true, order: { select: { orderNumber: true } } },
    });
    for (const f of foreign) {
      problems.push(`заказ RAKETA ${f.raketaTrackNumber ?? ''} привязан ещё и к заказу ${f.order.orderNumber}`);
    }

    // Group our items by RAKETA order.
    const groups = new Map<string, typeof registered>();
    for (const item of registered) {
      const id = item.raketaOrderId as string;
      groups.set(id, [...(groups.get(id) ?? []), item]);
    }

    const details = new Map<string, RaketaOrderDetails>();
    for (const [raketaOrderId, items] of groups) {
      const d = await this.raketa.getOrderDetails(raketaOrderId);
      details.set(raketaOrderId, d);
      const label = d.raketa_track_number ?? raketaOrderId;
      const cardTrack = norm(d.china_track_number);
      for (const item of items) {
        if (item.chinaTrackNumber && cardTrack && norm(item.chinaTrackNumber) !== cardTrack) {
          problems.push(
            `у вещи «${item.productTitle.slice(0, 40)}» трек ${item.chinaTrackNumber}, а у её заказа ${label} в RAKETA — ${d.china_track_number}`,
          );
        }
      }
      const raketaCount = (d.items ?? []).reduce((sum, x) => sum + (Number(x.count) || 1), 0);
      const ourCount = items.reduce((sum, i) => sum + i.quantity, 0);
      if (raketaCount !== ourCount) {
        problems.push(
          `в заказе RAKETA ${label} ${raketaCount} шт, а у нас к нему привязано ${ourCount} шт (${items
            .map((i) => i.productTitle.slice(0, 25))
            .join(', ')})`,
        );
      }
    }

    // Consolidation: exactly our RAKETA orders, all pointing to it.
    const ids = [...groups.keys()];
    if (order.raketaDeliveryAssignedAt && registered.length === order.items.length) {
      if (ids.length > 1) {
        if (!order.raketaConsolidationId) {
          problems.push('доставка оформлена, но объединение не записано');
        } else {
          const c = await this.raketa.getConsolidation(order.raketaConsolidationId);
          const members = new Set((c.orders ?? []).map((o) => o.id));
          const missing = ids.filter((id) => !members.has(id));
          const extra = [...members].filter((id) => !groups.has(id));
          if (missing.length) {
            problems.push(
              `в объединении нет заказов RAKETA ${missing.map((id) => details.get(id)?.raketa_track_number ?? id).join(', ')}`,
            );
          }
          if (extra.length) problems.push(`в объединении есть чужие заказы RAKETA (${extra.length} шт)`);
        }
      }
      for (const [id, d] of details) {
        const cons = d.consolidation_id ?? null;
        if (ids.length > 1 && cons && order.raketaConsolidationId && cons !== order.raketaConsolidationId) {
          problems.push(`заказ RAKETA ${d.raketa_track_number ?? id} лежит в другом объединении`);
        }
        if (ids.length === 1 && cons) {
          problems.push(`заказ RAKETA ${d.raketa_track_number ?? id} лежит в объединении, хотя должен ехать один`);
        }
      }
    }
    return [...new Set(problems)];
  }

  /**
   * Inspect and, on problems, quarantine. Returns true when it's safe to go
   * on. A RAKETA outage returns false without quarantining (try later).
   */
  async ensureConsistent(orderId: string, step: string): Promise<boolean> {
    let problems: string[];
    try {
      problems = await this.inspect(orderId);
    } catch (error) {
      this.logger.warn(`RAKETA check before «${step}» (${orderId}) failed: ${errorText(error)}`);
      return false;
    }
    if (problems.length === 0) return true;
    await this.quarantine(orderId, problems, step);
    return false;
  }

  /** Stop the automation for an order with a known reason (also used by «Собрать» checks). */
  quarantineWith(orderId: string, problems: string[], step: string): Promise<void> {
    return this.quarantine(orderId, problems, step);
  }

  private async quarantine(orderId: string, problems: string[], step: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    const message = `Сверка RAKETA: ${problems.join('; ')}`.slice(0, 1000);
    const already = order.fulfillmentManual && order.raketaLastError === message;
    if (already) return;
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { fulfillmentManual: true, raketaLastError: message },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          comment: `RAKETA: автоматика остановлена (перед шагом «${step}»): ${problems.join('; ')}.`.slice(0, 2000),
        },
      }),
    ]);
    this.logger.warn(`${order.orderNumber} quarantined: ${message}`);
    await this.notifyOwner(
      [
        `RAKETA: заказ ${order.orderNumber} поставлен на ручное оформление — данные не сходятся с кабинетом.`,
        ...problems.map((p) => `• ${p}`),
        '',
        `Шаг, который был остановлен: «${step}». Исправьте в кабинете RAKETA и включите автоматику в карточке заказа.`,
      ].join('\n'),
      orderId,
    );
  }

  /** Every 30 min: re-check all orders the automation is driving. */
  @Cron('0 15,45 * * * *')
  async reconcile(): Promise<void> {
    if (this.reconciling || !this.raketa.isConfigured) return;
    this.reconciling = true;
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          fulfillmentManual: false,
          raketaPaidAt: null,
          status: { notIn: ACTIVE_STATUSES_EXCLUDED },
          items: { some: { raketaOrderId: { not: null } } },
        },
        select: { id: true },
      });
      for (const order of orders) {
        await this.withOrderLock(order.id, () => this.ensureConsistent(order.id, 'плановая сверка'));
      }
    } catch (error) {
      this.logger.warn(`RAKETA reconcile failed: ${errorText(error)}`);
    } finally {
      this.reconciling = false;
    }
  }
}
