import type { StaffOrderDetailsDto, UserProfile } from '@lean-poizon/shared';
import {
  encodeManagerOrderCallback,
  MANAGER_ORDER_ACTIONS,
  OrderStatus,
} from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name);
  private readonly configService: ConfigService;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  async notifyManagersAboutCreatedOrder(
    order: StaffOrderDetailsDto,
    user: UserProfile,
  ): Promise<void> {
    const botToken = this.configService.get<string>('telegram.botToken');
    const managerTelegramIds =
      this.configService.get<string[]>('notifications.managerTelegramIds') ?? [];

    if (!botToken || managerTelegramIds.length === 0) {
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const text = this.buildMessage(order, user);
    const miniAppUrl = this.configService.get<string>('telegram.miniAppUrl');

    const inlineKeyboard: { text: string; callback_data?: string; url?: string }[][] = [
      [
        {
          text: 'Отправлены реквизиты',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.PAYMENT_PENDING,
            order.id,
          ),
        },
      ],
      [
        {
          text: 'Товар оплачен',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.PAID_AWAITING_PURCHASE,
            order.id,
          ),
        },
      ],
      [
        {
          text: 'Выкуплен',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.PURCHASED,
            order.id,
          ),
        },
      ],
      [
        {
          text: 'Ввести трек-код',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.TRACK_CODE,
            order.id,
          ),
        },
      ],
    ];

    // Add deep link to admin panel if mini app URL is configured
    if (miniAppUrl) {
      inlineKeyboard.push([
        {
          text: 'Открыть в панели',
          url: `${miniAppUrl}/admin/orders/${order.id}`,
        },
      ]);
    }

    const replyMarkup = { inline_keyboard: inlineKeyboard };

    await Promise.allSettled(
      managerTelegramIds.map(async (chatId) => {
        const response = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            reply_markup: replyMarkup,
            disable_web_page_preview: true,
          }),
        });
        const payload = (await response.json()) as { ok?: boolean; description?: string };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.description ?? 'Telegram sendMessage failed');
        }
      }),
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.warn(
            `Failed to send order notification: ${
              result.reason instanceof Error ? result.reason.message : String(result.reason)
            }`,
          );
        }
      });
    });
  }

  async notifyUserAboutStatusChange(
    userTelegramId: string,
    orderNumber: string,
    newStatus: OrderStatus,
    trackCode?: string | null,
  ): Promise<void> {
    const botToken = this.configService.get<string>('telegram.botToken');

    if (!botToken) {
      return;
    }

    const statusLabel = this.getStatusLabel(newStatus, trackCode);
    const text = [
      `Обновление по заявке ${orderNumber}`,
      '',
      `Новый статус: ${statusLabel}`,
      ...(trackCode ? [`Трек-код: ${trackCode}`] : []),
    ].join('\n');

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            chat_id: userTelegramId,
            text,
          }),
        },
      );

      const payload = (await response.json()) as { ok?: boolean; description?: string };

      if (!response.ok || !payload.ok) {
        this.logger.warn(
          `Failed to notify user ${userTelegramId} about order ${orderNumber}: ${payload.description}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to notify user ${userTelegramId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  buildMessage(order: StaffOrderDetailsDto, user?: UserProfile): string {
    const userLine = user?.username
      ? `@${user.username}`
      : order.user.username
        ? `@${order.user.username}`
        : `${order.user.firstName}${order.user.lastName ? ` ${order.user.lastName}` : ''}`;

    const items = order.items
      .map((item, index) => {
        return [
          `${index + 1}. ${item.title}`,
          `Размер: ${item.size}${item.version ? `, ${item.version}` : ''}`,
          `Количество: ${item.quantity}`,
          `Цена: ${item.priceYuan.toFixed(2)} CNY / $${item.totalUsd.toFixed(2)}`,
          `Доставка: ${item.deliveryRub} ₽`,
          `Пошлина: ${item.dutyRub} ₽`,
          item.dewuLink,
        ].join('\n');
      })
      .join('\n\n');

    return [
      `Заявка ${order.orderNumber}`,
      '',
      `Статус: ${this.getStatusLabel(order.status, order.trackCode)}`,
      `Пользователь: ${userLine}`,
      `Telegram ID: ${order.user.telegramId}`,
      '',
      ...(order.delivery
        ? [
            `ФИО: ${order.delivery.fullName}`,
            `СДЭК: ${order.delivery.cdekAddress}`,
            `Телефон: ${order.delivery.phone}`,
            '',
          ]
        : []),
      items,
      '',
      `Итог: $${order.summary.totalUsd.toFixed(2)}`,
      `Доставка: ${order.summary.deliveryRub} ₽`,
      `Пошлина: ${order.summary.dutyRub} ₽`,
    ].join('\n');
  }

  private getStatusLabel(status: OrderStatus, trackCode?: string | null): string {
    switch (status) {
      case OrderStatus.CREATED:
        return 'Создан';
      case OrderStatus.PAYMENT_PENDING:
        return 'Ожидание оплаты';
      case OrderStatus.PAID_AWAITING_PURCHASE:
        return 'Оплачен, ожидается выкуп';
      case OrderStatus.PURCHASED:
        return 'Выкуплен';
      case OrderStatus.TRACK_CODE_RECEIVED:
        return trackCode
          ? `Трек-код получен — ${trackCode}`
          : 'Трек-код получен';
      case OrderStatus.DELIVERY_PAYMENT_PENDING:
        return 'Ожидание оплаты доставки';
      case OrderStatus.DELIVERY_PAID:
        return 'Доставка оплачена';
      case OrderStatus.DUTY_PAYMENT_PENDING:
        return 'Ожидание оплаты пошлины';
      case OrderStatus.DUTY_PAID:
        return 'Пошлина оплачена';
      case OrderStatus.DELIVERED:
        return 'Доставлено';
      default:
        return status;
    }
  }
}
