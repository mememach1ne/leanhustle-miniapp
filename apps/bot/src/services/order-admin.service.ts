import { InlineKeyboardMarkup } from 'telegraf/types';

import type {
  BusinessSettingsDto,
  SettingsAuditLogItemDto,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
} from '@lean-poizon/shared';
import {
  MANAGER_ORDER_ACTIONS,
  OrderStatus,
  encodeManagerOrderCallback,
} from '@lean-poizon/shared';

type SettingsFieldKey =
  | 'cnyToUsd'
  | 'cnyToRub'
  | 'eurToRub'
  | 'commissionPercent'
  | 'deliveryPricePerKgRub';

interface PendingTrackCodeState {
  orderId: string;
  orderNumber: string;
  sourceChatId?: number;
  sourceMessageId?: number;
}

interface PendingOrderNumberState {
  promptMessageId?: number;
}

interface PendingRateValueState {
  field: Extract<SettingsFieldKey, 'cnyToUsd' | 'cnyToRub' | 'eurToRub'>;
}

type PendingManagerIntent =
  | ({ type: 'awaiting_track_code' } & PendingTrackCodeState)
  | ({ type: 'awaiting_order_number' } & PendingOrderNumberState)
  | { type: 'awaiting_rate_field' }
  | ({ type: 'awaiting_rate_value' } & PendingRateValueState)
  | { type: 'awaiting_commission_value' }
  | { type: 'awaiting_delivery_value' };

const OPEN_ORDER_PREFIX = 'open_order:';
const SETTINGS_ACTION_PREFIX = 'settings_action:';
const SETTINGS_RATE_PREFIX = 'settings_rate:';
const ADMIN_PANEL_ACTION_PREFIX = 'admin_panel:';

type AdminPanelAction =
  | 'new_orders'
  | 'active_orders'
  | 'find_order'
  | 'orders_help'
  | 'settings'
  | 'settings_audit'
  | 'set_rate'
  | 'set_commission'
  | 'set_delivery';

export class OrderAdminService {
  private readonly pendingIntentByManager = new Map<string, PendingManagerIntent>();

  getWelcomeText(roleLabel: string) {
    return [
      'LEAN POIZON Manager Bot',
      '',
      'Доступ подтверждён.',
      `Роль: ${roleLabel}`,
      '',
      'Админ-панель открыта ниже. Выберите нужное действие кнопкой.',
      'Новые заказы приходят сюда автоматически, а старые можно открыть через списки или поиск.',
      'Команда /cancel отменяет любой активный ввод.',
    ].join('\n');
  }

  getClientWelcomeText() {
    return [
      'Добро пожаловать в LEAN POIZON!',
      '',
      'Здесь мы помогаем заказать товары с Dewu / Poizon в Россию.',
      'Если нужна помощь с заказом, напишите менеджеру: @zanyatij',
    ].join('\n');
  }

  buildAdminPanelKeyboard(role: 'admin' | 'manager'): InlineKeyboardMarkup {
    const keyboard: InlineKeyboardMarkup['inline_keyboard'] = [
      [
        {
          text: 'Новые заказы',
          callback_data: this.encodeAdminPanelActionCallback('new_orders'),
        },
        {
          text: 'Активные заказы',
          callback_data: this.encodeAdminPanelActionCallback('active_orders'),
        },
      ],
      [
        {
          text: 'Найти заказ',
          callback_data: this.encodeAdminPanelActionCallback('find_order'),
        },
        {
          text: 'Помощь',
          callback_data: this.encodeAdminPanelActionCallback('orders_help'),
        },
      ],
      [
        {
          text: 'Настройки',
          callback_data: this.encodeAdminPanelActionCallback('settings'),
        },
        {
          text: 'История настроек',
          callback_data: this.encodeAdminPanelActionCallback('settings_audit'),
        },
      ],
    ];

    if (role === 'admin') {
      keyboard.push(
        [
          {
            text: 'Изменить курс',
            callback_data: this.encodeAdminPanelActionCallback('set_rate'),
          },
        ],
        [
          {
            text: 'Изменить комиссию',
            callback_data: this.encodeAdminPanelActionCallback('set_commission'),
          },
          {
            text: 'Изменить доставку',
            callback_data: this.encodeAdminPanelActionCallback('set_delivery'),
          },
        ],
      );
    }

    return {
      inline_keyboard: keyboard,
    };
  }

  buildOrdersHelpText() {
    return [
      'Команды менеджера:',
      '',
      '/new_orders — последние новые заказы',
      '/active_orders — активные заказы в работе',
      '/find_order LP001 — найти заказ по номеру',
      '/find_order — запросить номер заказа следующим сообщением',
      '/settings — текущие бизнес-настройки',
      '/settings_audit — история изменений настроек',
      '/set_rate — изменить курс',
      '/set_commission — изменить комиссию',
      '/set_delivery — изменить доставку за кг',
      '/cancel — отменить текущий ввод',
    ].join('\n');
  }

  beginTrackCodeInput(managerId: string, state: PendingTrackCodeState) {
    this.pendingIntentByManager.set(managerId, {
      type: 'awaiting_track_code',
      ...state,
    });
  }

  getPendingTrackCodeInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_track_code' ? pending : null;
  }

  beginOrderNumberInput(managerId: string, state: PendingOrderNumberState = {}) {
    this.pendingIntentByManager.set(managerId, {
      type: 'awaiting_order_number',
      ...state,
    });
  }

  getPendingOrderNumberInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_order_number' ? pending : null;
  }

  beginRateFieldInput(managerId: string) {
    this.pendingIntentByManager.set(managerId, { type: 'awaiting_rate_field' });
  }

  getPendingRateFieldInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_rate_field' ? pending : null;
  }

  beginRateValueInput(managerId: string, field: PendingRateValueState['field']) {
    this.pendingIntentByManager.set(managerId, {
      type: 'awaiting_rate_value',
      field,
    });
  }

  getPendingRateValueInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_rate_value' ? pending : null;
  }

  beginCommissionInput(managerId: string) {
    this.pendingIntentByManager.set(managerId, { type: 'awaiting_commission_value' });
  }

  getPendingCommissionInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_commission_value' ? pending : null;
  }

  beginDeliveryInput(managerId: string) {
    this.pendingIntentByManager.set(managerId, { type: 'awaiting_delivery_value' });
  }

  getPendingDeliveryInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_delivery_value' ? pending : null;
  }

  clearPendingIntent(managerId: string) {
    this.pendingIntentByManager.delete(managerId);
  }

  buildFindOrderPrompt() {
    return 'Введите номер заказа, например LP001. Для отмены используйте /cancel.';
  }

  buildTrackCodePrompt(orderNumber: string) {
    return `Введите трек-код для заказа ${orderNumber}. Для отмены используйте /cancel.`;
  }

  buildRateFieldPrompt() {
    return 'Выберите курс для изменения или отправьте один из кодов: CNY_USD, CNY_RUB, EUR_RUB.';
  }

  buildRateValuePrompt(field: PendingRateValueState['field']) {
    const label = this.getRateFieldLabel(field);
    return `Введите новое значение для ${label}. Поддерживаются форматы 0.146 и 87,9.`;
  }

  buildCommissionPrompt() {
    return 'Введите новую комиссию в %, например 10 или 9.5.';
  }

  buildDeliveryPrompt() {
    return 'Введите новую стоимость доставки за кг в ₽, например 1400.';
  }

  buildSettingsMessage(settings: BusinessSettingsDto, canEdit: boolean) {
    return [
      'Текущие бизнес-настройки:',
      '',
      `CNY -> USD: ${settings.cnyToUsd.toFixed(6)}`,
      `CNY -> RUB: ${settings.cnyToRub.toFixed(4)}`,
      `EUR -> RUB: ${settings.eurToRub.toFixed(4)}`,
      `Комиссия: ${settings.commissionPercent.toFixed(2)}%`,
      `Доставка: ${settings.deliveryPricePerKgRub.toFixed(2)} ₽/кг`,
      '',
      `Порог пошлины: ${settings.dutyThresholdEur.toFixed(2)} EUR`,
      `Пошлина: ${settings.dutyPercent.toFixed(2)}%`,
      `Сервисный сбор пошлины: ${settings.dutyProcessingFeeRub.toFixed(2)} ₽`,
      '',
      canEdit
        ? 'Admin может изменить курсы, комиссию и доставку кнопками ниже или командами.'
        : 'Manager может только просматривать настройки и историю изменений.',
    ].join('\n');
  }

  buildSettingsKeyboard(canEdit: boolean): InlineKeyboardMarkup | undefined {
    if (!canEdit) {
      return {
        inline_keyboard: [
          [
            {
              text: 'История изменений',
              callback_data: this.encodeSettingsActionCallback('audit'),
            },
          ],
        ],
      };
    }

    return {
      inline_keyboard: [
        [
          {
            text: 'Изменить курс',
            callback_data: this.encodeSettingsActionCallback('set_rate'),
          },
          {
            text: 'Изменить комиссию',
            callback_data: this.encodeSettingsActionCallback('set_commission'),
          },
        ],
        [
          {
            text: 'Изменить доставку',
            callback_data: this.encodeSettingsActionCallback('set_delivery'),
          },
          {
            text: 'История изменений',
            callback_data: this.encodeSettingsActionCallback('audit'),
          },
        ],
      ],
    };
  }

  buildRateFieldKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: 'CNY -> USD',
            callback_data: this.encodeSettingsRateCallback('cnyToUsd'),
          },
        ],
        [
          {
            text: 'CNY -> RUB',
            callback_data: this.encodeSettingsRateCallback('cnyToRub'),
          },
        ],
        [
          {
            text: 'EUR -> RUB',
            callback_data: this.encodeSettingsRateCallback('eurToRub'),
          },
        ],
      ],
    };
  }

  buildSettingsAuditMessage(logs: SettingsAuditLogItemDto[]) {
    if (logs.length === 0) {
      return 'История изменений настроек пока пуста.';
    }

    return [
      'Последние изменения настроек:',
      '',
      ...logs.map((log, index) => {
        const actor = log.changedByStaff?.username
          ? `@${log.changedByStaff.username}`
          : log.changedByStaff?.telegramId ?? 'неизвестный staff';

        const diffs = log.changedFields.map((field) => {
          const previous = log.previousValues?.[field];
          const next = log.nextValues[field];

          return `• ${this.getSettingLabel(field)}: ${this.formatSettingValue(field, previous)} -> ${this.formatSettingValue(field, next)}`;
        });

        return [
          `${index + 1}. ${actor} — ${this.formatDateTime(log.createdAt)}`,
          ...diffs,
        ].join('\n');
      }),
    ].join('\n\n');
  }

  buildSettingsUpdatedText(settings: BusinessSettingsDto, changedFields: string[]) {
    return [
      `Настройки обновлены: ${changedFields.map((field) => this.getSettingLabel(field)).join(', ')}.`,
      '',
      this.buildSettingsMessage(settings, true),
    ].join('\n');
  }

  parseNumericInput(value: string): number | null {
    const normalized = value.trim().replace(',', '.');

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  parseRateFieldInput(value: string): PendingRateValueState['field'] | null {
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');

    switch (normalized) {
      case 'CNY_USD':
        return 'cnyToUsd';
      case 'CNY_RUB':
        return 'cnyToRub';
      case 'EUR_RUB':
        return 'eurToRub';
      default:
        return null;
    }
  }

  encodeOpenOrderCallback(orderId: string) {
    return `${OPEN_ORDER_PREFIX}${orderId}`;
  }

  decodeOpenOrderCallback(callbackData: string): string | null {
    if (!callbackData.startsWith(OPEN_ORDER_PREFIX)) {
      return null;
    }

    const orderId = callbackData.slice(OPEN_ORDER_PREFIX.length);
    return orderId || null;
  }

  encodeSettingsActionCallback(action: 'set_rate' | 'set_commission' | 'set_delivery' | 'audit') {
    return `${SETTINGS_ACTION_PREFIX}${action}`;
  }

  decodeSettingsActionCallback(callbackData: string) {
    if (!callbackData.startsWith(SETTINGS_ACTION_PREFIX)) {
      return null;
    }

    const action = callbackData.slice(SETTINGS_ACTION_PREFIX.length);

    if (
      action === 'set_rate' ||
      action === 'set_commission' ||
      action === 'set_delivery' ||
      action === 'audit'
    ) {
      return action;
    }

    return null;
  }

  encodeSettingsRateCallback(field: PendingRateValueState['field']) {
    return `${SETTINGS_RATE_PREFIX}${field}`;
  }

  decodeSettingsRateCallback(callbackData: string): PendingRateValueState['field'] | null {
    if (!callbackData.startsWith(SETTINGS_RATE_PREFIX)) {
      return null;
    }

    const field = callbackData.slice(SETTINGS_RATE_PREFIX.length);

    if (field === 'cnyToUsd' || field === 'cnyToRub' || field === 'eurToRub') {
      return field;
    }

    return null;
  }

  encodeAdminPanelActionCallback(action: AdminPanelAction) {
    return `${ADMIN_PANEL_ACTION_PREFIX}${action}`;
  }

  decodeAdminPanelActionCallback(callbackData: string): AdminPanelAction | null {
    if (!callbackData.startsWith(ADMIN_PANEL_ACTION_PREFIX)) {
      return null;
    }

    const action = callbackData.slice(ADMIN_PANEL_ACTION_PREFIX.length);

    if (
      action === 'new_orders' ||
      action === 'active_orders' ||
      action === 'find_order' ||
      action === 'orders_help' ||
      action === 'settings' ||
      action === 'settings_audit' ||
      action === 'set_rate' ||
      action === 'set_commission' ||
      action === 'set_delivery'
    ) {
      return action;
    }

    return null;
  }

  formatDateTime(value: string) {
    const date = new Date(value);

    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Moscow',
    }).format(date);
  }

  buildStatusUpdatedText(order: StaffOrderDetailsDto) {
    const lines = [
      `Статус заказа ${order.orderNumber} обновлён: ${this.getStatusLabel(
        order.status,
        order.trackCode,
      )}.`,
    ];

    if (order.status === OrderStatus.PAID_AWAITING_PURCHASE) {
      lines.push(
        order.subscriberBenefitApplied
          ? `Льгота подписчика применена. Новая сумма заказа: $${order.summary.totalUsd.toFixed(2)}.`
          : 'Льгота подписчика не применялась.',
      );
    }

    return lines.join('\n');
  }

  buildTrackCodeSavedText(order: StaffOrderDetailsDto) {
    return `Трек-код для заказа ${order.orderNumber} сохранён: ${order.trackCode}.`;
  }

  buildOrderListHeader(title: string) {
    return title;
  }

  buildOrderListEmptyText(kind: 'new' | 'active') {
    return kind === 'new'
      ? 'Новых заказов сейчас нет.'
      : 'Активных заказов сейчас нет.';
  }

  buildOrderListItemMessage(order: StaffOrderListItemDto): string {
    const username = order.user.username ? `@${order.user.username}` : 'без username';

    return [
      `${order.orderNumber} • ${this.getStatusLabel(order.status, order.trackCode)}`,
      `${username} • Telegram ID: ${order.user.telegramId}`,
      `Сумма: $${order.totalUsd.toFixed(2)} • Товаров: ${order.itemsCount}`,
      `Доставка: ${order.deliveryRub} ₽ • Пошлина: ${order.dutyRub} ₽`,
      ...(order.previewTitle ? [`Товар: ${order.previewTitle}`] : []),
      ...(order.subscriberBenefitApplied
        ? [`Льгота подписчика: ${order.subscriberBenefitAmountRub} ₽`]
        : []),
      `Создан: ${this.formatDateTime(order.createdAt)}`,
    ].join('\n');
  }

  buildOpenOrderKeyboard(orderId: string): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: 'Открыть заказ',
            callback_data: this.encodeOpenOrderCallback(orderId),
          },
        ],
      ],
    };
  }

  buildOrderMessage(order: StaffOrderDetailsDto): string {
    const userLine = order.user.username
      ? `@${order.user.username}`
      : `${order.user.firstName}${order.user.lastName ? ` ${order.user.lastName}` : ''}`;

    const items = order.items
      .map((item, index) =>
        [
          `${index + 1}. ${item.title}`,
          `Размер: ${item.size}${item.version ? `, ${item.version}` : ''}`,
          `Количество: ${item.quantity}`,
          `Цена: ${item.priceYuan.toFixed(2)} CNY / $${item.totalUsd.toFixed(2)}`,
          `Доставка: ${item.deliveryRub} ₽`,
          `Пошлина: ${item.dutyRub} ₽`,
          item.dewuLink,
        ].join('\n'),
      )
      .join('\n\n');

    return [
      `Заявка ${order.orderNumber}`,
      '',
      `Статус: ${this.getStatusLabel(order.status, order.trackCode)}`,
      `Пользователь: ${userLine}`,
      `Telegram ID: ${order.user.telegramId}`,
      `Создан: ${this.formatDateTime(order.createdAt)}`,
      ...(order.subscriberBenefitApplied
        ? [
            'Льгота подписчика: применена',
            `Скидка на комиссию: ${order.subscriberBenefitAmountRub} ₽`,
          ]
        : ['Льгота подписчика: нет']),
      ...(order.trackCode ? [`Трек-код: ${order.trackCode}`] : []),
      ...(order.statusHistory.length > 0
        ? [
            '',
            'История статусов:',
            ...order.statusHistory
              .slice(0, 3)
              .map(
                (entry) =>
                  `• ${this.getStatusLabel(entry.toStatus)} — ${this.formatDateTime(entry.createdAt)}`,
              ),
          ]
        : []),
      '',
      items,
      '',
      ...(order.subscriberBenefitApplied
        ? [`Исходная сумма: $${order.summary.originalTotalUsd.toFixed(2)}`]
        : []),
      `Итог: $${order.summary.totalUsd.toFixed(2)}`,
      `Доставка: ${order.summary.deliveryRub} ₽`,
      `Пошлина: ${order.summary.dutyRub} ₽`,
    ].join('\n');
  }

  buildOrderKeyboard(order: StaffOrderDetailsDto): InlineKeyboardMarkup | undefined {
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

    if (order.status === OrderStatus.CREATED) {
      buttons.push([
        {
          text: 'Отправлены реквизиты',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.PAYMENT_PENDING,
            order.id,
          ),
        },
      ]);
    }

    if (order.status === OrderStatus.PAYMENT_PENDING) {
      buttons.push([
        {
          text: 'Товар оплачен',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.PAID_AWAITING_PURCHASE,
            order.id,
          ),
        },
      ]);
    }

    if (order.status === OrderStatus.PAID_AWAITING_PURCHASE) {
      buttons.push([
        {
          text: 'Выкуплен',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.PURCHASED,
            order.id,
          ),
        },
      ]);
    }

    if ([OrderStatus.PURCHASED, OrderStatus.TRACK_CODE_RECEIVED].includes(order.status)) {
      buttons.push([
        {
          text: order.trackCode ? 'Обновить трек-код' : 'Ввести трек-код',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.TRACK_CODE,
            order.id,
          ),
        },
      ]);
    }

    if (buttons.length === 0) {
      return undefined;
    }

    return {
      inline_keyboard: buttons,
    };
  }

  private getRateFieldLabel(field: PendingRateValueState['field']) {
    switch (field) {
      case 'cnyToUsd':
        return 'CNY -> USD';
      case 'cnyToRub':
        return 'CNY -> RUB';
      case 'eurToRub':
        return 'EUR -> RUB';
      default:
        return field;
    }
  }

  private getSettingLabel(field: string) {
    switch (field) {
      case 'cnyToUsd':
        return 'CNY -> USD';
      case 'cnyToRub':
        return 'CNY -> RUB';
      case 'eurToRub':
        return 'EUR -> RUB';
      case 'commissionPercent':
        return 'Комиссия';
      case 'deliveryPricePerKgRub':
        return 'Доставка';
      default:
        return field;
    }
  }

  private formatSettingValue(field: string, value: number | undefined) {
    if (value === undefined) {
      return '—';
    }

    if (field === 'commissionPercent') {
      return `${value}%`;
    }

    if (field === 'deliveryPricePerKgRub') {
      return `${value} ₽/кг`;
    }

    return String(value);
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
        return trackCode ? `Трек-код получен — ${trackCode}` : 'Трек-код получен';
      default:
        return status;
    }
  }
}

export const orderAdminService = new OrderAdminService();
