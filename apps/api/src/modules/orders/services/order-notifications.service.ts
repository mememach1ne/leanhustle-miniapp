import type { StaffOrderDetailsDto, UserProfile } from '@lean-poizon/shared';
import {
  encodeManagerOrderCallback,
  MANAGER_ORDER_ACTIONS,
  OrderStatus,
} from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MANAGER_TELEGRAM_URL = 'https://t.me/lh_poizonmanager';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const formatRub = (value: number): string =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ₽`;


@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name);
  private readonly configService: ConfigService;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  async notifyManagersAboutCreatedOrder(
    order: StaffOrderDetailsDto,
    user?: UserProfile,
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
    details: {
      amountRub?: number;
      orderId?: string;
      /** RAKETA top-up link: the client pays delivery by card right away. */
      payUrl?: string;
      /** Breakdown shown under the amount, e.g. «Международная доставка — 1 200 ₽». */
      lines?: Array<{ name: string; amountRub: number }>;
      /** Delivery (and duty) were paid through RAKETA in one go. */
      allPaid?: boolean;
    } = {},
  ): Promise<void> {
    const botToken = this.configService.get<string>('telegram.botToken');

    if (!botToken) {
      return;
    }

    const text = this.buildClientStatusText(orderNumber, newStatus, trackCode, details.amountRub, details);

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
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: this.buildClientKeyboard(newStatus, trackCode, details.orderId, details.payUrl),
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

  /**
   * Customer-facing status message (Telegram HTML, no emoji): a bold
   * headline, what happened and what comes next.
   */
  private buildClientStatusText(
    orderNumber: string,
    status: OrderStatus,
    trackCode?: string | null,
    amountRub?: number,
    extra: { payUrl?: string; lines?: Array<{ name: string; amountRub: number }>; allPaid?: boolean } = {},
  ): string {
    const order = `<b>${escapeHtml(orderNumber)}</b>`;
    const amount = typeof amountRub === 'number' ? formatRub(amountRub) : null;
    const lines = (headline: string, ...body: string[]) =>
      [`<b>${headline}</b>`, '', ...body].join('\n');

    switch (status) {
      case OrderStatus.CREATED:
        return lines(
          'Заказ оформлен',
          `Менеджер оформил для вас заказ ${order}.`,
          'Откройте его в приложении, проверьте состав и оплатите товар в USDT.',
        );
      case OrderStatus.PAYMENT_PENDING:
        return lines(
          'Заказ ждёт оплаты',
          `Заказ ${order} готов к оплате.`,
          'Откройте его в приложении и оплатите товар в USDT: сеть выбираете сами, платёж подтвердится автоматически.',
        );
      case OrderStatus.PAID_AWAITING_PURCHASE:
        return lines(
          'Оплата получена',
          `Спасибо! Заказ ${order} оплачен.`,
          'В ближайшее время выкупим товар на Poizon и сообщим, когда он будет выкуплен.',
        );
      case OrderStatus.PURCHASED:
        return lines(
          'Товар выкуплен',
          `Заказ ${order} выкуплен на Poizon.`,
          'Товар пройдёт проверку подлинности и отправится к нам. Когда посылку взвесят, пришлём стоимость доставки.',
        );
      case OrderStatus.DELIVERY_PAYMENT_PENDING:
        if (extra.payUrl) {
          return lines(
            amount ? `К оплате за доставку: ${amount}` : 'Рассчитана стоимость доставки',
            `Посылка по заказу ${order} собрана и взвешена на складе в Китае.`,
            ...(extra.lines?.length
              ? ['', ...extra.lines.map((line) => `${escapeHtml(line.name)}: ${formatRub(line.amountRub)}`)]
              : []),
            '',
            'Оплатите по кнопке «Оплатить доставку» — после оплаты посылка сразу отправится в Россию. Платёж подтвердится автоматически.',
          );
        }
        return lines(
          amount ? `Стоимость доставки: ${amount}` : 'Рассчитана стоимость доставки',
          `Доставка из Китая по заказу ${order} рассчитана по фактическому весу.`,
          'Менеджер свяжется с вами для оплаты.',
        );
      case OrderStatus.DELIVERY_PAID:
        return extra.allPaid
          ? lines(
              'Доставка оплачена',
              `Спасибо! Оплата получена, заказ ${order} отправляется в Россию.`,
              'Трек-код СДЭК пришлём, как только посылка будет передана в доставку.',
            )
          : lines(
              'Доставка оплачена',
              `Спасибо! Заказ ${order} отправляется в Россию.`,
              'Если потребуется таможенная пошлина, мы сообщим отдельно.',
            );
      case OrderStatus.DUTY_PAYMENT_PENDING:
        return amountRub === 0
          ? lines(
              'Пошлина не требуется',
              `Стоимость заказа ${order} укладывается в беспошлинный лимит.`,
              'Трек-код для отслеживания пришлём, как только он появится.',
            )
          : lines(
              amount ? `Таможенная пошлина: ${amount}` : 'Рассчитана таможенная пошлина',
              `Заказ ${order} превышает беспошлинный лимит, поэтому начислена пошлина.`,
              'Менеджер свяжется с вами для оплаты.',
            );
      case OrderStatus.DUTY_PAID:
        return lines(
          'Пошлина оплачена',
          `Спасибо! Заказ ${order} проходит таможенное оформление.`,
          'Трек-код для отслеживания пришлём, как только он появится.',
        );
      case OrderStatus.TRACK_CODE_RECEIVED:
        return lines(
          'Посылка в пути',
          `Заказ ${order} передан в СДЭК.`,
          ...(trackCode
            ? [
                '',
                `Трек-код: <code>${escapeHtml(trackCode)}</code>`,
                'Нажмите на трек-код, чтобы скопировать его.',
              ]
            : []),
        );
      case OrderStatus.DELIVERED:
        return lines(
          'Заказ доставлен',
          `Заказ ${order} завершён. Спасибо, что выбрали LEAN HUSTLE POIZON!`,
          'Будем рады вашему отзыву — напишите менеджеру, как вам заказ.',
        );
      case OrderStatus.CANCELLED:
        return lines(
          'Заказ отменён',
          `Заказ ${order} отменён.`,
          'Если это ошибка или остались вопросы, напишите менеджеру.',
        );
      default:
        return lines('Статус заказа обновлён', `Заказ ${order}: ${this.getStatusLabel(status, trackCode)}.`);
    }
  }

  private buildClientKeyboard(
    status: OrderStatus,
    trackCode?: string | null,
    orderId?: string,
    payUrl?: string,
  ) {
    const miniAppUrl =
      this.configService.get<string>('telegram.miniAppUrl') || 'https://leanhustle.ru';
    const rows: Array<Array<Record<string, unknown>>> = [];

    if (status === OrderStatus.DELIVERY_PAYMENT_PENDING && payUrl) {
      rows.push([{ text: 'Оплатить доставку', url: payUrl, style: 'success' }]);
    }

    if (status === OrderStatus.TRACK_CODE_RECEIVED && trackCode) {
      rows.push([
        {
          text: 'Отследить в СДЭК',
          url: `https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(trackCode)}`,
          style: 'primary',
        },
      ]);
    }
    rows.push([
      {
        text: status === OrderStatus.PAYMENT_PENDING ? 'Оплатить' : 'Открыть заказ',
        web_app: {
          url: `${miniAppUrl.replace(/\/$/, '')}/profile/orders${orderId ? `/${orderId}` : ''}`,
        },
        ...(status === OrderStatus.TRACK_CODE_RECEIVED ? {} : { style: 'primary' }),
      },
      { text: 'Менеджер', url: MANAGER_TELEGRAM_URL },
    ]);

    return { inline_keyboard: rows };
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
        return 'Доставлен';
      case OrderStatus.CANCELLED:
        return 'Отменён';
      default:
        return status;
    }
  }

  /** Managers get pinged when a customer's crypto payment is auto-detected. */
  async notifyManagersAboutAutoPayment(
    orderNumber: string,
    amountUsdt: number,
    network: string,
  ): Promise<void> {
    const botToken = this.configService.get<string>('telegram.botToken');
    const managerTelegramIds =
      this.configService.get<string[]>('notifications.managerTelegramIds') ?? [];

    if (!botToken || managerTelegramIds.length === 0) return;

    const text = [
      `💸 Клиент произвёл автооплату по заказу ${orderNumber}.`,
      '',
      `Криптодепозит USDT · ${network} на ${amountUsdt.toFixed(2)} получен и подтверждён сервером.`,
      'Заказ переведён в статус «Оплачен, ожидается выкуп».',
    ].join('\n');

    await Promise.allSettled(
      managerTelegramIds.map(async (chatId) => {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(10_000),
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              disable_web_page_preview: true,
            }),
          },
        );
        const payload = (await response.json()) as { ok?: boolean; description?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.description ?? 'Telegram sendMessage failed');
        }
      }),
    );
  }

  /** Plain message to every manager (RAKETA automation events). */
  async notifyManagers(text: string, orderId?: string): Promise<void> {
    const botToken = this.configService.get<string>('telegram.botToken');
    const managerTelegramIds =
      this.configService.get<string[]>('notifications.managerTelegramIds') ?? [];
    if (!botToken || managerTelegramIds.length === 0) return;
    const miniAppUrl = this.configService.get<string>('telegram.miniAppUrl');

    await Promise.allSettled(
      managerTelegramIds.map(async (chatId) => {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
            ...(orderId && miniAppUrl
              ? {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: 'Открыть в панели', url: `${miniAppUrl}/admin/orders/${orderId}` }],
                    ],
                  },
                }
              : {}),
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
          this.logger.warn(`Failed to notify managers: ${String(result.reason)}`);
        }
      });
    });
  }

  async notifyManagersAboutCancellation(
    orderNumber: string,
    cancelledBy: string,
    reason?: string,
  ): Promise<void> {
    const botToken = this.configService.get<string>('telegram.botToken');
    const managerTelegramIds =
      this.configService.get<string[]>('notifications.managerTelegramIds') ?? [];

    if (!botToken || managerTelegramIds.length === 0) return;

    const lines = [
      `❌ Заказ ${orderNumber} отменён ${cancelledBy}.`,
      ...(reason ? ['', `Причина: ${reason}`] : []),
    ];

    await Promise.allSettled(
      managerTelegramIds.map(async (chatId) => {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(10_000),
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: lines.join('\n'),
              disable_web_page_preview: true,
            }),
          },
        );
        const payload = (await response.json()) as { ok?: boolean; description?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.description ?? 'Telegram sendMessage failed');
        }
      }),
    );
  }
}
