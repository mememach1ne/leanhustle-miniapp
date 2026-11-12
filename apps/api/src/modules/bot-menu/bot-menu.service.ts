import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BRAND_LOGOS } from '../orders/widget/brand-logos';
import { UsersService } from '../users/users.service';
import { MENU_CARD_HTML } from './menu-card.html';

const MAX_ORDERS = 3;

/** Short stage of an active order for the menu. */
const STAGE: Partial<Record<OrderStatus, string>> = {
  CREATED: 'Ждёт оплаты',
  PAYMENT_PENDING: 'Ждёт оплаты',
  PAID_AWAITING_PURCHASE: 'Выкупаем',
  PURCHASED: 'Едет на склад в Китае',
  DELIVERY_PAYMENT_PENDING: 'Оплатите доставку',
  DELIVERY_PAID: 'Едет в Россию',
  DUTY_PAYMENT_PENDING: 'Оплатите пошлину',
  DUTY_PAID: 'Едет в Россию',
  TRACK_CODE_RECEIVED: 'В пути по России',
};
const WAITING = new Set<OrderStatus>(['CREATED', 'PAYMENT_PENDING', 'DELIVERY_PAYMENT_PENDING', 'DUTY_PAYMENT_PENDING']);

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * /start menu as a Telegram widget: one per chat (a new /start deletes the
 * previous one), with the client's active orders; refreshed when opened.
 */
@Injectable()
export class BotMenuService {
  private readonly logger = new Logger(BotMenuService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  /** Sends the menu. False = widgets unavailable → the bot sends the old text menu. */
  async send(input: {
    telegramId: string;
    chatId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  }): Promise<{ sent: boolean; messageId?: number }> {
    if ((process.env.MENU_WIDGET ?? '').toLowerCase() === 'off') return { sent: false };
    const user = await this.users.upsertTelegramUser({
      telegramId: input.telegramId,
      username: input.username,
      firstName: input.firstName || input.username || 'Telegram user',
      lastName: input.lastName,
      languageCode: input.languageCode,
    });
    const data = JSON.stringify(await this.state(user.id));
    const { menuMessageId } = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { menuMessageId: true },
    });
    try {
      const message = (await this.call('sendWidget', {
        chat_id: input.chatId,
        html: MENU_CARD_HTML,
        chat_data: data,
        allow_queries: true,
      })) as { message_id: number };
      if (menuMessageId) {
        await this.call('deleteMessage', { chat_id: input.chatId, message_id: menuMessageId }).catch(() => undefined);
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { menuMessageId: message.message_id, menuState: data },
      });
      return { sent: true, messageId: message.message_id };
    } catch (error) {
      this.logger.warn(`Menu widget failed for ${input.telegramId}: ${errorText(error)}`);
      return { sent: false };
    }
  }

  /** Background query from an opened menu: refresh the orders. False = not a menu message. */
  async handleQuery(query: { id: string; chatId?: string; messageId?: number }): Promise<boolean> {
    if (!query.chatId || !query.messageId) return false;
    const user = await this.prisma.user.findFirst({
      where: { telegramId: query.chatId, menuMessageId: query.messageId },
    });
    if (!user) return false;
    try {
      const data = JSON.stringify(await this.state(user.id));
      if (data !== user.menuState) {
        await this.call('editMessageWidgetData', { chat_id: query.chatId, message_id: query.messageId, chat_data: data });
        await this.prisma.user.update({ where: { id: user.id }, data: { menuState: data } });
      }
    } catch (error) {
      if (!/not modified/i.test(errorText(error))) this.logger.warn(`Menu refresh failed: ${errorText(error)}`);
    }
    await this.call('answerWidgetQuery', { widget_query_id: query.id, data: 'ok' }).catch(() => undefined);
    return true;
  }

  private async state(userId: string): Promise<Record<string, unknown>> {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        hiddenFromClient: false,
        status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ORDERS,
      select: { id: true, orderNumber: true, status: true },
    });
    return {
      o: orders.map((o) => [o.orderNumber, STAGE[o.status] ?? 'В работе', o.id, WAITING.has(o.status) ? 1 : 0]),
      lg: BRAND_LOGOS.poizon,
    };
  }

  private async call(method: string, payload: Record<string, unknown>): Promise<unknown> {
    const token = this.config.get<string>('telegram.botToken');
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null;
    if (!res.ok || !body?.ok) throw new Error(`${method}: ${body?.description ?? `HTTP ${res.status}`}`);
    return body.result;
  }
}
