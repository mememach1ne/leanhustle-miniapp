import type { OrderTrackingDto } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import type { RaketaTrackingService } from '../services/raketa-tracking.service';
import { ORDER_CARD_HTML } from './order-card.html';

const MANAGER_TELEGRAM_URL = 'https://t.me/lh_poizonmanager';
const MAX_DATA = 1024;
/** A card opened again within this time isn't refreshed from the tracker. */
const QUERY_REFRESH_MS = 60_000;

/** How far the order went by its own status (same as the order page). */
const RANK: Record<OrderStatus, number> = {
  CREATED: 0,
  PAYMENT_PENDING: 0,
  PAID_AWAITING_PURCHASE: 1,
  PURCHASED: 2,
  DELIVERY_PAYMENT_PENDING: 3,
  DELIVERY_PAID: 4,
  DUTY_PAYMENT_PENDING: 4,
  DUTY_PAID: 5,
  TRACK_CODE_RECEIVED: 6,
  DELIVERED: 7,
  CANCELLED: -1,
};


/** chat_data of the card — see order-card.html.ts for the keys. */
interface CardState {
  n: string;
  c: number;
  w?: 1;
  h?: 1;
  x?: 1;
  d?: string;
  a?: 1;
  e?: string;
  p?: { a: number; l: Array<[string, number]>; u?: string };
  tr?: { c: string; n: string };
}

export type CardResult = 'sent' | 'updated' | 'unchanged' | 'skipped' | 'failed';

const shortDate = (value: Date | string | null | undefined) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? undefined
    : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' })
        .format(date)
        .replace('.', '');
};

class TelegramError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

/**
 * The live order card in the client's chat with the bot: one widget message
 * per order that the server re-renders silently (editMessageWidgetData +
 * caption + keyboard) on every change, instead of a message per step. Only
 * events that need the client (pay delivery / duty, track, delivered,
 * cancelled) still come as separate messages — see OrderNotificationsService.
 * No caption: the card says everything (Sergey's call — apps without widgets
 * show an «unsupported message» with the buttons).
 */
@Injectable()
export class OrderWidgetService {
  private readonly logger = new Logger(OrderWidgetService.name);
  private readonly locks = new Map<string, Promise<unknown>>();
  /** Turned off at runtime if Telegram rejects the widget methods. */
  private disabled: boolean;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {
    this.disabled = (process.env.ORDER_WIDGETS ?? '').toLowerCase() === 'off';
  }

  get enabled(): boolean {
    return !this.disabled && Boolean(this.config.get<string>('telegram.botToken'));
  }

  /**
   * Sends the card (when `create` and there is none yet) or updates it.
   * Returns what happened; 'skipped'/'failed' mean the caller should fall
   * back to a plain message.
   */
  syncCard(orderId: string, options: { create: boolean; refreshTracking?: boolean } = { create: true }): Promise<CardResult> {
    if (!this.enabled) return Promise.resolve('skipped');
    const previous = this.locks.get(orderId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => this.syncUnlocked(orderId, options));
    const tail = run.catch(() => undefined);
    this.locks.set(orderId, tail);
    void tail.then(() => {
      if (this.locks.get(orderId) === tail) this.locks.delete(orderId);
    });
    return run;
  }

  /** The card is on screen and asks for fresh data (background request) — bot forwards it here. */
  async handleQuery(query: { id: string; fromId: string; data: string; chatId?: string; messageId?: number }): Promise<void> {
    try {
      const order =
        query.chatId && query.messageId
          ? await this.prisma.order.findFirst({
              where: { widgetMessageId: query.messageId, user: { telegramId: query.chatId } },
              select: { id: true, widgetRefreshedAt: true },
            })
          : null;
      if (order && query.data === 'r') {
        const stale = !order.widgetRefreshedAt || Date.now() - order.widgetRefreshedAt.getTime() > QUERY_REFRESH_MS;
        if (stale) await this.syncCard(order.id, { create: false, refreshTracking: true });
      }
    } catch (error) {
      this.logger.warn(`Widget query ${query.id} failed: ${String(error)}`);
    }
    await this.call('answerWidgetQuery', { widget_query_id: query.id, data: 'ok' }).catch(() => undefined);
  }

  private async syncUnlocked(
    orderId: string,
    options: { create: boolean; refreshTracking?: boolean },
  ): Promise<CardResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        user: { select: { telegramId: true } },
        statusHistory: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    const chatId = order?.user?.telegramId;
    if (!order || !chatId || order.hiddenFromClient) return 'skipped';
    if (!order.widgetMessageId && (!options.create || order.status === OrderStatus.DELIVERED)) return 'skipped';

    const tracking = await this.tracking(order.userId as string, order.id);
    const state = this.buildState(order, tracking);
    const keyboard = this.keyboard(order);
    const data = JSON.stringify(state);
    const fingerprint = JSON.stringify({ data, keyboard });

    try {
      if (!order.widgetMessageId) {
        const message = (await this.call('sendWidget', {
          chat_id: chatId,
          html: ORDER_CARD_HTML,
          chat_data: data,
          allow_queries: true,
          reply_markup: keyboard,
        })) as { message_id: number };
        await this.prisma.order.update({
          where: { id: order.id },
          data: { widgetMessageId: message.message_id, widgetState: fingerprint, widgetRefreshedAt: new Date() },
        });
        this.logger.log(`${order.orderNumber}: order card sent`);
        return 'sent';
      }

      if (order.widgetState === fingerprint) {
        await this.prisma.order.update({ where: { id: order.id }, data: { widgetRefreshedAt: new Date() } });
        return 'unchanged';
      }
      const previous = safeParse(order.widgetState);
      const target = { chat_id: chatId, message_id: order.widgetMessageId };
      if (previous?.data !== data) await this.edit('editMessageWidgetData', { ...target, chat_data: data });
      if (JSON.stringify(previous?.keyboard) !== JSON.stringify(keyboard)) {
        await this.edit('editMessageReplyMarkup', { ...target, reply_markup: keyboard });
      }
      await this.prisma.order.update({
        where: { id: order.id },
        data: { widgetState: fingerprint, widgetRefreshedAt: new Date() },
      });
      return 'updated';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // The client deleted the card — send a new one next time something happens.
      if (/message to edit not found|MESSAGE_ID_INVALID|message can't be edited/i.test(message)) {
        await this.prisma.order.update({ where: { id: order.id }, data: { widgetMessageId: null, widgetState: null } });
        return options.create ? this.syncUnlocked(orderId, options) : 'failed';
      }
      if (error instanceof TelegramError && error.code === 404) {
        this.disabled = true;
        this.logger.warn(`Widgets aren't available for the bot (${message}) — falling back to plain messages`);
      } else {
        this.logger.warn(`${order.orderNumber}: order card failed: ${message}`);
      }
      return 'failed';
    }
  }

  private async tracking(userId: string, orderId: string): Promise<OrderTrackingDto | null> {
    try {
      // Loaded lazily: tracking → notifications → this service would be an import cycle.
      const { RaketaTrackingService: Tracking } = await import('../services/raketa-tracking.service');
      const service: RaketaTrackingService = this.moduleRef.get(Tracking, { strict: false });
      return await service.getForUser(userId, orderId);
    } catch {
      return null;
    }
  }

  private buildState(
    order: Prisma.OrderGetPayload<{
      include: { items: true; statusHistory: { select: { toStatus: true; createdAt: true } } };
    }>,
    tracking: OrderTrackingDto | null,
  ): CardState {
    const history = new Map(order.statusHistory.map((h) => [h.toStatus, h.createdAt]));
    const rank = RANK[order.status] ?? 0;
    const parcel = (i: number) => tracking?.steps[i];
    const hadDuty =
      order.status === OrderStatus.DUTY_PAYMENT_PENDING ||
      history.has(OrderStatus.DUTY_PAYMENT_PENDING) ||
      history.has(OrderStatus.DUTY_PAID);
    const steps: Array<{ done: boolean; at?: Date | string | null }> = [
      { done: true, at: order.createdAt },
      { done: rank >= 1, at: history.get(OrderStatus.PAID_AWAITING_PURCHASE) },
      { done: rank >= 2, at: history.get(OrderStatus.PURCHASED) },
      { done: Boolean(parcel(1)?.done) || rank >= 3, at: parcel(1)?.at },
      { done: rank >= 4, at: history.get(OrderStatus.DELIVERY_PAID) },
      { done: hadDuty && rank >= 5 && order.status !== OrderStatus.DUTY_PAYMENT_PENDING, at: history.get(OrderStatus.DUTY_PAID) },
      { done: Boolean(parcel(2)?.done), at: parcel(2)?.at },
      { done: Boolean(parcel(3)?.done), at: parcel(3)?.at },
      { done: Boolean(parcel(4)?.done), at: parcel(4)?.at },
      { done: Boolean(parcel(5)?.done) || rank >= 6, at: parcel(5)?.at ?? history.get(OrderStatus.TRACK_CODE_RECEIVED) },
      { done: Boolean(parcel(6)?.done) || rank >= 7, at: parcel(6)?.at ?? history.get(OrderStatus.DELIVERED) },
    ];
    const visible = steps.map((s, i) => (i === 5 && !hadDuty ? false : s.done));
    const lastDone = visible.lastIndexOf(true);
    let next = lastDone + 1;
    if (next === 5 && !hadDuty) next = 6;
    const cancelled = order.status === OrderStatus.CANCELLED;
    // «Waiting» only when the client really has to pay that step.
    const waiting =
      !cancelled &&
      ((next === 1 && rank === 0) ||
        (next === 4 && order.status === OrderStatus.DELIVERY_PAYMENT_PENDING) ||
        (next === 5 && order.status === OrderStatus.DUTY_PAYMENT_PENDING));
    const current = waiting ? next : lastDone;

    const state: CardState = { n: order.orderNumber, c: current };
    if (waiting) state.w = 1;
    if (hadDuty) state.h = 1;
    if (cancelled) state.x = 1;
    const at = shortDate(waiting ? steps[lastDone]?.at : steps[current]?.at);
    if (at) state.d = at;
    if (!waiting && current === 3 && order.raketaAssembledAt && !order.raketaPriceTotal) state.a = 1;

    // Expected delivery: from the day delivery was paid + the quoted days; before that just the days.
    const paidAt = history.get(OrderStatus.DELIVERY_PAID);
    if (order.deliveryDaysMax) {
      state.e = paidAt
        ? `~${shortDate(new Date(paidAt.getTime() + order.deliveryDaysMax * 86_400_000))}`
        : order.deliveryDaysMin === order.deliveryDaysMax
          ? `${order.deliveryDaysMax} дн.`
          : `${order.deliveryDaysMin}–${order.deliveryDaysMax} дн.`;
    }

    if (order.status === OrderStatus.DELIVERY_PAYMENT_PENDING && order.raketaTopupAmount) {
      const lines = Array.isArray(order.raketaPriceLines)
        ? (order.raketaPriceLines as Array<{ name?: unknown; amountRub?: unknown }>)
            .map((l) => [String(l.name ?? '').slice(0, 28), Math.round(Number(l.amountRub ?? 0))] as [string, number])
            .filter((l) => l[1] > 0)
        : [];
      state.p = { a: Math.round(Number(order.raketaTopupAmount)), l: lines };
      if (order.raketaTopupUrl && order.raketaTopupUrl.length <= 300) state.p.u = order.raketaTopupUrl;
    }

    const track = order.trackCode ?? tracking?.cdekTrack ?? order.raketaTkTrack;
    if (track && order.deliveryCarrier !== 'raketa') {
      state.tr = { c: order.deliveryCarrier ?? 'cdek', n: track };
    }

    // A very long bill can't overflow chat_data: drop its extras.
    if (Buffer.byteLength(JSON.stringify(state)) > MAX_DATA && state.p) {
      state.p.l = [];
      if (Buffer.byteLength(JSON.stringify(state)) > MAX_DATA) delete state.p.u;
    }
    return state;
  }

  private keyboard(order: { id: string; status: OrderStatus; raketaTopupUrl: string | null }) {
    const miniAppUrl = (this.config.get<string>('telegram.miniAppUrl') || 'https://leanhustle.ru').replace(/\/$/, '');
    const rows: Array<Array<Record<string, unknown>>> = [];
    if (order.status === OrderStatus.DELIVERY_PAYMENT_PENDING && order.raketaTopupUrl) {
      rows.push([{ text: 'Оплатить доставку', url: order.raketaTopupUrl, style: 'success' }]);
    }
    const unpaid = order.status === OrderStatus.CREATED || order.status === OrderStatus.PAYMENT_PENDING;
    rows.push([
      {
        text: unpaid ? 'Оплатить' : 'Открыть заказ',
        web_app: { url: `${miniAppUrl}/profile/orders/${order.id}` },
        style: 'primary',
      },
      { text: 'Менеджер', url: MANAGER_TELEGRAM_URL },
    ]);
    return { inline_keyboard: rows };
  }

  /** Edit that tolerates «not modified» (the state is already there). */
  private async edit(method: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.call(method, payload);
    } catch (error) {
      if (error instanceof Error && /message is not modified/i.test(error.message)) return;
      throw error;
    }
  }

  private async call(method: string, payload: Record<string, unknown>): Promise<unknown> {
    const token = this.config.get<string>('telegram.botToken');
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string; error_code?: number } | null;
    if (!res.ok || !body?.ok) {
      throw new TelegramError(`${method}: ${body?.description ?? `HTTP ${res.status}`}`, body?.error_code ?? res.status);
    }
    return body.result;
  }
}

function safeParse(value: string | null): { data?: string; keyboard?: unknown } | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as { data?: string; keyboard?: unknown };
  } catch {
    return null;
  }
}
