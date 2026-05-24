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

interface PendingCategoryWeightState {
  categoryId: string;
  categoryTitle: string;
}

interface PendingActualDeliveryState {
  orderId: string;
  orderNumber: string;
}

interface PendingActualDutyState {
  orderId: string;
  orderNumber: string;
}

type PendingManagerIntent =
  | ({ type: 'awaiting_track_code' } & PendingTrackCodeState)
  | ({ type: 'awaiting_order_number' } & PendingOrderNumberState)
  | { type: 'awaiting_rate_field' }
  | ({ type: 'awaiting_rate_value' } & PendingRateValueState)
  | { type: 'awaiting_commission_value' }
  | { type: 'awaiting_delivery_value' }
  | ({ type: 'awaiting_category_weight' } & PendingCategoryWeightState)
  | ({ type: 'awaiting_actual_delivery' } & PendingActualDeliveryState)
  | ({ type: 'awaiting_actual_duty' } & PendingActualDutyState);

const OPEN_ORDER_PREFIX = 'open_order:';
const SETTINGS_ACTION_PREFIX = 'settings_action:';
const SETTINGS_RATE_PREFIX = 'settings_rate:';
const ADMIN_PANEL_ACTION_PREFIX = 'admin_panel:';
const CLIENT_ACTION_PREFIX = 'client:';
const CATEGORY_ACTION_PREFIX = 'cat:';
const NAV_PREFIX = 'nav:';

const ORDERS_PER_PAGE = 8;

export const POIZON_IOS_URL = 'https://apps.apple.com/app/id1012871328';
// Poizon is not on Google Play. We host the official APK ourselves and
// serve it directly via nginx (see infra/nginx).
export const POIZON_ANDROID_URL = 'https://leanhustle.ru/poizon.apk';

// Mandatory news channel. The bot must be an administrator of this
// channel (otherwise getChatMember fails).
export const NEWS_CHANNEL_USERNAME = '@lh_poizon';
export const NEWS_CHANNEL_URL = 'https://t.me/lh_poizon';
export const MANAGER_TELEGRAM_URL = 'https://t.me/lh_poizonmanager';

type AdminPanelAction =
  | 'new_orders'
  | 'active_orders'
  | 'find_order'
  | 'orders_help'
  | 'settings'
  | 'settings_audit'
  | 'set_rate'
  | 'set_commission'
  | 'set_delivery'
  | 'pending_categories'
  | 'all_categories';

export class OrderAdminService {
  private readonly pendingIntentByManager = new Map<string, PendingManagerIntent>();

  getWelcomeText(roleLabel: string) {
    return [
      'LEAN HUSTLE POIZON Manager Bot',
      '',
      'Доступ подтверждён.',
      `Роль: ${roleLabel}`,
      '',
      'Админ-панель открыта ниже. Выберите нужное действие кнопкой.',
      'Новые заказы приходят сюда автоматически, а старые можно открыть через списки или поиск.',
      'Команда /cancel отменяет любой активный ввод.',
    ].join('\n');
  }

  // HTML-formatted; send with parse_mode: 'HTML'.
  // <tg-emoji emoji-id="..."> renders a premium custom emoji on supported
  // clients, and the inner standard emoji as a fallback elsewhere.
  getClientWelcomeText() {
    return [
      'Добро пожаловать в LEAN HUSTLE POIZON! <tg-emoji emoji-id="5386797112774110235">🔥</tg-emoji>',
      '',
      'Здесь мы помогаем заказать товары с Poizon в Россию. <tg-emoji emoji-id="5449408995691341691">📦</tg-emoji>',
    ].join('\n');
  }

  buildClientWelcomeKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: '📲 Скачать приложение POIZON',
            callback_data: `${CLIENT_ACTION_PREFIX}download_app`,
          },
        ],
        [
          {
            text: 'Инструкция',
            callback_data: `${CLIENT_ACTION_PREFIX}guide`,
            // Bot API 9.4 premium emoji (📗-style book).
            icon_custom_emoji_id: '5402482853030163217',
          } as InlineKeyboardMarkup['inline_keyboard'][number][number],
        ],
        [
          {
            text: '🛒 Другие китайские маркетплейсы',
            callback_data: `${CLIENT_ACTION_PREFIX}other_marketplaces`,
          },
        ],
        [
          {
            text: '💬 Связаться с менеджером',
            url: MANAGER_TELEGRAM_URL,
          },
        ],
      ],
    };
  }

  getDownloadAppText() {
    return [
      '📲 Официальное приложение POIZON',
      '',
      'Выбери свою платформу:',
    ].join('\n');
  }

  getOtherMarketplacesText() {
    return 'Скоро появится';
  }

  buildOtherMarketplacesKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: '💬 Связаться с менеджером',
            url: MANAGER_TELEGRAM_URL,
          },
        ],
        [
          {
            text: '← Назад',
            callback_data: `${CLIENT_ACTION_PREFIX}back_to_welcome`,
          },
        ],
      ],
    };
  }

  buildDownloadAppKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: 'Скачать для iOS',
            url: POIZON_IOS_URL,
            // Bot API 9.4: premium emoji icon + blue Apple-style.
            // Old clients fall back to plain text and default color.
            style: 'primary',
            icon_custom_emoji_id: '5332823031859389246',
          } as InlineKeyboardMarkup['inline_keyboard'][number][number],
        ],
        [
          {
            text: 'Скачать для Android',
            url: POIZON_ANDROID_URL,
            // Bot API 9.4: premium emoji icon + green Android-style.
            style: 'success',
            icon_custom_emoji_id: '6199417621100629765',
          } as InlineKeyboardMarkup['inline_keyboard'][number][number],
        ],
        [
          {
            text: '← Назад',
            callback_data: `${CLIENT_ACTION_PREFIX}back_to_welcome`,
          },
        ],
      ],
    };
  }

  isClientDownloadAppCallback(data: string): boolean {
    return data === `${CLIENT_ACTION_PREFIX}download_app`;
  }

  isClientOtherMarketplacesCallback(data: string): boolean {
    return data === `${CLIENT_ACTION_PREFIX}other_marketplaces`;
  }

  isClientGuideCallback(data: string): boolean {
    return data === `${CLIENT_ACTION_PREFIX}guide`;
  }

  isClientBackToWelcomeCallback(data: string): boolean {
    return data === `${CLIENT_ACTION_PREFIX}back_to_welcome`;
  }

  getGuideText() {
    return [
      '📗 Инструкция',
      '',
      'Выбери формат:',
    ].join('\n');
  }

  buildGuideKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: 'Видео-инструкция',
            url: 'https://youtu.be/dwVmtQGWVa8',
            icon_custom_emoji_id: '5269213586953085214',
          } as InlineKeyboardMarkup['inline_keyboard'][number][number],
        ],
        [
          {
            text: 'Текстовая инструкция',
            url: 'https://telegra.ph/KAK-ZAKAZYVAT-s-POIZON-v-ROSSII-05-24',
            icon_custom_emoji_id: '5434144690511290129',
          } as InlineKeyboardMarkup['inline_keyboard'][number][number],
        ],
        [
          {
            text: '← Назад',
            callback_data: `${CLIENT_ACTION_PREFIX}back_to_welcome`,
          },
        ],
      ],
    };
  }

  isClientCheckSubscriptionCallback(data: string): boolean {
    return data === `${CLIENT_ACTION_PREFIX}check_subscription`;
  }

  getSubscriptionRequiredText() {
    return [
      '🔒 Для использования бота подпишись на наш новостной канал',
      '',
      'Там — анонсы новых дропов, скидки и обновления сервиса.',
      '',
      'После подписки нажми «Проверить подписку».',
    ].join('\n');
  }

  buildSubscriptionRequiredKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: '📢 Подписаться на канал',
            url: NEWS_CHANNEL_URL,
          },
        ],
        [
          {
            text: '✅ Проверить подписку',
            callback_data: `${CLIENT_ACTION_PREFIX}check_subscription`,
          },
        ],
      ],
    };
  }

  getSubscriptionStillMissingText() {
    return [
      '❌ Похоже, ты ещё не подписан на канал.',
      '',
      'Подпишись на @lh_poizon и нажми «Проверить подписку» ещё раз.',
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
      [
        {
          text: 'Непроверенные категории',
          callback_data: this.encodeAdminPanelActionCallback('pending_categories'),
        },
        {
          text: 'Все категории',
          callback_data: this.encodeAdminPanelActionCallback('all_categories'),
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

  beginCategoryWeightInput(managerId: string, state: PendingCategoryWeightState) {
    this.pendingIntentByManager.set(managerId, {
      type: 'awaiting_category_weight',
      ...state,
    });
  }

  getPendingCategoryWeightInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_category_weight' ? pending : null;
  }

  beginActualDeliveryInput(managerId: string, state: PendingActualDeliveryState) {
    this.pendingIntentByManager.set(managerId, { type: 'awaiting_actual_delivery', ...state });
  }

  getPendingActualDeliveryInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_actual_delivery' ? pending : null;
  }

  beginActualDutyInput(managerId: string, state: PendingActualDutyState) {
    this.pendingIntentByManager.set(managerId, { type: 'awaiting_actual_duty', ...state });
  }

  getPendingActualDutyInput(managerId: string) {
    const pending = this.pendingIntentByManager.get(managerId);
    return pending?.type === 'awaiting_actual_duty' ? pending : null;
  }

  buildActualDeliveryPrompt(orderNumber: string) {
    return `Введите фактическую стоимость доставки для заказа ${orderNumber} в рублях. Например: 1850 или 1850,50. Для отмены — /cancel.`;
  }

  buildActualDutyPrompt(orderNumber: string) {
    return `Введите фактическую пошлину для заказа ${orderNumber} в рублях. Если пошлины нет — введите 0. Для отмены — /cancel.`;
  }

  // --- Category callback helpers ---

  /**
   * Groups for the manager's "Все категории" view. Each enum-key category
   * (seeded from DeliveryCategory) belongs to exactly one group. Any row
   * whose categoryKey doesn't start with "enum:" is treated as dynamic
   * and bucketed into the "dynamic" group.
   */
  private readonly KNOWN_CATEGORY_GROUPS: Array<{
    key: string;
    label: string;
    enumKeys: string[];
  }> = [
    {
      key: 'footwear',
      label: '👟 Обувь',
      enumKeys: ['enum:SNEAKERS', 'enum:SLIDES', 'enum:BOOTS', 'enum:LOAFERS'],
    },
    {
      key: 'apparel',
      label: '👕 Одежда',
      enumKeys: [
        'enum:TSHIRT',
        'enum:SHORTS',
        'enum:PANTS',
        'enum:HOODIE',
        'enum:SWEATSHIRT',
        'enum:JACKET',
        'enum:VEST',
        'enum:DRESS',
        'enum:SKIRT',
        'enum:UNDERWEAR',
      ],
    },
    {
      key: 'accessories',
      label: '👜 Аксессуары',
      enumKeys: [
        'enum:WATCH',
        'enum:GLASSES',
        'enum:BAG',
        'enum:SMALL_ACCESSORY',
        'enum:JEWELRY',
        'enum:PHONE_CASE',
        'enum:HEADWEAR',
        'enum:SCARF',
        'enum:PERFUME',
        'enum:TECH_ACCESSORY',
      ],
    },
  ];

  getCategoryGroups() {
    return this.KNOWN_CATEGORY_GROUPS;
  }

  encodeCategoryCallback(action: string, arg?: string): string {
    return arg ? `${CATEGORY_ACTION_PREFIX}${action}:${arg}` : `${CATEGORY_ACTION_PREFIX}${action}`;
  }

  decodeCategoryCallback(
    callbackData: string,
  ): { action: string; arg?: string } | null {
    if (!callbackData.startsWith(CATEGORY_ACTION_PREFIX)) return null;
    const rest = callbackData.slice(CATEGORY_ACTION_PREFIX.length);
    const colon = rest.indexOf(':');
    if (colon < 0) {
      // Action without arg (e.g. list_pending, list_all, back_admin).
      return { action: rest };
    }
    return { action: rest.slice(0, colon), arg: rest.slice(colon + 1) };
  }

  /** Pending-only flat list (manager triage). */
  buildPendingListText(
    rows: Array<{ id: string; title: string; weightKg: number | null; encounterCount: number }>,
  ): string {
    if (rows.length === 0) {
      return '⚠️ Непроверенные категории\n\nСписок пуст. Все категории имеют введённый вес.';
    }
    return [
      '⚠️ Непроверенные категории',
      `Всего: ${rows.length}`,
      '',
      'Категории, для которых ещё не задан вес. Клиенты видят «вес уточнит менеджер».',
    ].join('\n');
  }

  buildPendingListKeyboard(
    rows: Array<{ id: string; title: string; encounterCount: number }>,
  ): InlineKeyboardMarkup {
    const inline_keyboard: InlineKeyboardMarkup['inline_keyboard'] = rows
      .slice(0, 30)
      .map((row) => {
        const text = `⚠️ ${row.title} (×${row.encounterCount})`.slice(0, 60);
        return [{ text, callback_data: this.encodeCategoryCallback('open', row.id) }];
      });
    inline_keyboard.push([
      { text: '↑ Главное меню', callback_data: this.encodeCategoryCallback('back_admin') },
    ]);
    return { inline_keyboard };
  }

  /** Top-level group selector for "Все категории". */
  buildAllCategoriesText(): string {
    return [
      '📦 Все категории',
      '',
      'Выбери подкатегорию для просмотра и редактирования веса.',
    ].join('\n');
  }

  buildAllCategoriesKeyboard(dynamicCount: number): InlineKeyboardMarkup {
    const inline_keyboard: InlineKeyboardMarkup['inline_keyboard'] = this.KNOWN_CATEGORY_GROUPS.map(
      (group) => [
        { text: group.label, callback_data: this.encodeCategoryCallback('group', group.key) },
      ],
    );
    if (dynamicCount > 0) {
      inline_keyboard.push([
        {
          text: `🆕 Найденные на Poizon (${dynamicCount})`,
          callback_data: this.encodeCategoryCallback('group', 'dynamic'),
        },
      ]);
    }
    inline_keyboard.push([
      { text: '↑ Главное меню', callback_data: this.encodeCategoryCallback('back_admin') },
    ]);
    return { inline_keyboard };
  }

  /** Categories within a single group. */
  buildGroupCategoriesText(groupKey: string, count: number): string {
    const group = this.KNOWN_CATEGORY_GROUPS.find((g) => g.key === groupKey);
    const label = group?.label ?? (groupKey === 'dynamic' ? '🆕 Найденные на Poizon' : groupKey);
    if (count === 0) {
      return `${label}\n\nКатегорий нет.`;
    }
    return `${label}\n\nВыбери категорию для редактирования.`;
  }

  buildGroupCategoriesKeyboard(
    groupKey: string,
    rows: Array<{ id: string; title: string; weightKg: number | null }>,
  ): InlineKeyboardMarkup {
    const inline_keyboard: InlineKeyboardMarkup['inline_keyboard'] = rows.slice(0, 30).map((row) => {
      const prefix = row.weightKg === null ? '⚠️' : '✓';
      const weightSuffix =
        row.weightKg === null ? '' : ` — ${row.weightKg.toFixed(2)} кг`;
      const text = `${prefix} ${row.title}${weightSuffix}`.slice(0, 60);
      return [{ text, callback_data: this.encodeCategoryCallback('open', row.id) }];
    });
    inline_keyboard.push([
      {
        text: '← К подкатегориям',
        callback_data: this.encodeCategoryCallback('list_all'),
      },
    ]);
    inline_keyboard.push([
      { text: '↑ Главное меню', callback_data: this.encodeCategoryCallback('back_admin') },
    ]);
    void groupKey;
    return { inline_keyboard };
  }

  /**
   * Map a dynamic category title (e.g. "T-Shirts", "Running Shoes",
   * "Men's Perfumes") to one of our known group keys. Returns null when
   * no keyword matches, meaning the entry stays in "dynamic".
   */
  private classifyDynamicTitle(title: string): string | null {
    const t = title.toLowerCase().trim();
    if (!t) return null;

    // Footwear
    if (/\b(sneakers?|shoes?|footwear|trainers?|runners?|boots?|loafers?|moccasins?|slides?|sandals?|slippers?|clogs?)\b/.test(t)) {
      return 'footwear';
    }

    // Accessories — order matters: more specific first
    if (/\b(watches?|wristwatch)\b/.test(t)) return 'accessories';
    if (/\b(glasses|sunglasses|eyewear|spectacles?)\b/.test(t)) return 'accessories';
    if (/\b(bag|bags|backpack|handbag|crossbody|tote|clutch|wallet)\b/.test(t)) return 'accessories';
    if (/\b(jewelry|jewellery|necklace|bracelet|ring|earrings?)\b/.test(t)) return 'accessories';
    if (/\b(cap|caps|hat|hats|beanie|headwear)\b/.test(t)) return 'accessories';
    if (/\b(scarf|scarves|shawl)\b/.test(t)) return 'accessories';
    if (/\b(perfume|cologne|fragrance|toiletry|toiletries|makeup)\b/.test(t)) return 'accessories';
    if (/\b(case|cover|phone case)\b/.test(t)) return 'accessories';
    if (/\b(earbuds|headphones|earphones|airpods|speakers?|camera|cameras?|tech)\b/.test(t)) return 'accessories';
    if (/\b(belt|belts|keychain|key chain)\b/.test(t)) return 'accessories';

    // Apparel
    if (/\b(t-?shirts?|tees?|polo|polos)\b/.test(t)) return 'apparel';
    if (/\b(shorts?)\b/.test(t)) return 'apparel';
    if (/\b(jeans|pants|trousers|leggings)\b/.test(t)) return 'apparel';
    if (/\b(hoodie|hoodies|hooded)\b/.test(t)) return 'apparel';
    if (/\b(sweatshirts?|crewneck)\b/.test(t)) return 'apparel';
    if (/\b(jackets?|coats?|parka|windbreaker|outerwear)\b/.test(t)) return 'apparel';
    if (/\b(vest|gilet)\b/.test(t)) return 'apparel';
    if (/\b(dress|gown|dresses)\b/.test(t)) return 'apparel';
    if (/\b(skirt|skirts)\b/.test(t)) return 'apparel';
    if (/\b(underwear|socks|boxers|briefs|bra|lingerie)\b/.test(t)) return 'apparel';

    return null;
  }

  /**
   * Filter category rows by group. Dynamic entries are auto-classified
   * by title into footwear/apparel/accessories; only entries whose title
   * doesn't match any keyword stay in the "dynamic" bucket.
   * Within each group we deduplicate by title (case-insensitive) and
   * keep the first occurrence — manager can clean leftovers from the
   * "Все категории" view.
   */
  filterCategoriesByGroup<T extends { categoryKey: string; title: string }>(
    rows: T[],
    groupKey: string,
  ): T[] {
    const matched = rows.filter((row) => {
      if (row.categoryKey.startsWith('enum:')) {
        const group = this.KNOWN_CATEGORY_GROUPS.find((g) =>
          g.enumKeys.includes(row.categoryKey),
        );
        return group?.key === groupKey;
      }
      const classified = this.classifyDynamicTitle(row.title);
      if (classified) return classified === groupKey;
      return groupKey === 'dynamic';
    });

    // Deduplicate by lowercase title — keeps the first occurrence.
    const seen = new Set<string>();
    return matched.filter((row) => {
      const key = row.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  buildCategoryDetailText(record: {
    title: string;
    categoryKey: string;
    categoryL1: string | null;
    categoryL2: string | null;
    categoryL3: string | null;
    weightKg: number | null;
    encounterCount: number;
    firstSeenAt: Date;
  }): string {
    const isEnum = record.categoryKey.startsWith('enum:');
    const chain = isEnum
      ? '(базовая категория)'
      : [record.categoryL1, record.categoryL2, record.categoryL3]
          .filter((s): s is string => Boolean(s))
          .join(' › ') || '(нет от Poizon)';
    const weight =
      record.weightKg === null
        ? '— не задан, клиенты видят «вес уточнит менеджер»'
        : `${record.weightKg.toFixed(3)} кг`;

    return [
      `📦 ${record.title}`,
      '',
      `Цепочка: ${chain}`,
      `Вес: ${weight}`,
      `Встречалась: ${record.encounterCount} раз`,
      `Впервые: ${this.formatDateTime(record.firstSeenAt.toISOString())}`,
    ].join('\n');
  }

  /**
   * Detail keyboard. `backTo` controls the back navigation target:
   *   - "pending" → back to pending list
   *   - "group:<key>" → back to a group view
   */
  buildCategoryDetailKeyboard(id: string, backTo: string): InlineKeyboardMarkup {
    const backButton =
      backTo === 'pending'
        ? { text: '← К непроверенным', callback_data: this.encodeCategoryCallback('list_pending') }
        : backTo.startsWith('group:')
          ? {
              text: '← Назад',
              callback_data: this.encodeCategoryCallback('group', backTo.slice('group:'.length)),
            }
          : { text: '← Назад', callback_data: this.encodeCategoryCallback('list_all') };

    return {
      inline_keyboard: [
        [{ text: 'Ввести / изменить вес', callback_data: this.encodeCategoryCallback('edit', id) }],
        [{ text: '🗑 Удалить категорию', callback_data: this.encodeCategoryCallback('delete', id) }],
        [backButton],
        [
          { text: '↑ Главное меню', callback_data: this.encodeCategoryCallback('back_admin') },
        ],
      ],
    };
  }

  buildCategoryWeightPrompt(title: string) {
    return `Введите вес для категории «${title}» в килограммах. Можно через точку (0.5) или запятую (0,5). Для отмены — /cancel.`;
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
      action === 'set_delivery' ||
      action === 'pending_categories' ||
      action === 'all_categories'
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

  // ===== Edit-in-place admin navigation =====

  encodeNavCallback(path: string): string {
    return `${NAV_PREFIX}${path}`;
  }

  decodeNavCallback(callbackData: string): string | null {
    if (!callbackData.startsWith(NAV_PREFIX)) return null;
    return callbackData.slice(NAV_PREFIX.length);
  }

  /** Pagination: returns the slice + total pages for a list. */
  paginate<T>(items: T[], page: number): { slice: T[]; page: number; totalPages: number } {
    const totalPages = Math.max(1, Math.ceil(items.length / ORDERS_PER_PAGE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * ORDERS_PER_PAGE;
    return {
      slice: items.slice(start, start + ORDERS_PER_PAGE),
      page: safePage,
      totalPages,
    };
  }

  buildOrderListView(
    kind: 'new' | 'active',
    orders: StaffOrderListItemDto[],
    page: number,
  ): { text: string; reply_markup: InlineKeyboardMarkup } {
    const title = kind === 'new' ? '📋 Новые заказы' : '🚚 Активные заказы';

    if (orders.length === 0) {
      return {
        text: kind === 'new' ? 'Новых заказов сейчас нет.' : 'Активных заказов сейчас нет.',
        reply_markup: {
          inline_keyboard: [
            [{ text: '↑ Главное меню', callback_data: this.encodeNavCallback('admin') }],
          ],
        },
      };
    }

    const { slice, page: safePage, totalPages } = this.paginate(orders, page);

    const text = [
      `${title} — стр. ${safePage}/${totalPages} • Всего: ${orders.length}`,
      '',
      'Нажми на заказ чтобы открыть.',
    ].join('\n');

    const inline_keyboard: InlineKeyboardMarkup['inline_keyboard'] = slice.map((order) => {
      const userTag = order.user.username ? `@${order.user.username}` : order.user.firstName;
      const statusEmoji = this.getStatusEmoji(order.status);
      const label = `${statusEmoji} ${order.orderNumber} • $${order.totalUsd.toFixed(0)} • ${userTag}`.slice(0, 60);
      return [{ text: label, callback_data: this.encodeNavCallback(`order:${order.id}:${kind}:${safePage}`) }];
    });

    // Pagination row (only if needed)
    if (totalPages > 1) {
      const navRow: InlineKeyboardMarkup['inline_keyboard'][number] = [];
      if (safePage > 1) {
        navRow.push({
          text: '← Назад',
          callback_data: this.encodeNavCallback(`list:${kind}:${safePage - 1}`),
        });
      }
      navRow.push({
        text: `${safePage}/${totalPages}`,
        callback_data: this.encodeNavCallback(`list:${kind}:${safePage}`),
      });
      if (safePage < totalPages) {
        navRow.push({
          text: 'Вперёд →',
          callback_data: this.encodeNavCallback(`list:${kind}:${safePage + 1}`),
        });
      }
      inline_keyboard.push(navRow);
    }

    inline_keyboard.push([
      { text: '↑ Главное меню', callback_data: this.encodeNavCallback('admin') },
    ]);

    return { text, reply_markup: { inline_keyboard } };
  }

  private getStatusEmoji(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.CREATED:
        return '🆕';
      case OrderStatus.PAYMENT_PENDING:
        return '💳';
      case OrderStatus.PAID_AWAITING_PURCHASE:
        return '💰';
      case OrderStatus.PURCHASED:
        return '✅';
      case OrderStatus.DELIVERY_PAYMENT_PENDING:
        return '📦';
      case OrderStatus.DELIVERY_PAID:
        return '✓';
      case OrderStatus.DUTY_PAYMENT_PENDING:
        return '🛃';
      case OrderStatus.DUTY_PAID:
        return '✓';
      case OrderStatus.TRACK_CODE_RECEIVED:
        return '📮';
      case OrderStatus.DELIVERED:
        return '🎉';
      case OrderStatus.CANCELLED:
        return '❌';
      default:
        return '•';
    }
  }

  /**
   * Append "← К списку" + "↑ Главное меню" to an order detail keyboard
   * so the manager can navigate without leaving the message.
   */
  withOrderDetailNav(
    keyboard: InlineKeyboardMarkup | undefined,
    backToList?: { kind: 'new' | 'active'; page: number },
  ): InlineKeyboardMarkup {
    const inline_keyboard = keyboard ? [...keyboard.inline_keyboard] : [];
    if (backToList) {
      inline_keyboard.push([
        {
          text: '← К списку',
          callback_data: this.encodeNavCallback(`list:${backToList.kind}:${backToList.page}`),
        },
      ]);
    }
    inline_keyboard.push([
      { text: '↑ Главное меню', callback_data: this.encodeNavCallback('admin') },
    ]);
    return { inline_keyboard };
  }

  /** Wraps any single-message screen with "↑ Главное меню". */
  withBackToAdmin(keyboard?: InlineKeyboardMarkup): InlineKeyboardMarkup {
    const inline_keyboard = keyboard ? [...keyboard.inline_keyboard] : [];
    inline_keyboard.push([
      { text: '↑ Главное меню', callback_data: this.encodeNavCallback('admin') },
    ]);
    return { inline_keyboard };
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
      order.summary.actualDeliveryRub !== null && order.summary.actualDeliveryRub !== undefined
        ? `Доставка: ${order.summary.actualDeliveryRub} ₽ (факт, было ~${order.summary.deliveryRub} ₽)`
        : `Доставка: ~${order.summary.deliveryRub} ₽ (примерная)`,
      order.summary.actualDutyRub !== null && order.summary.actualDutyRub !== undefined
        ? `Пошлина: ${order.summary.actualDutyRub} ₽ (факт, было ~${order.summary.dutyRub} ₽)`
        : `Пошлина: ~${order.summary.dutyRub} ₽ (примерная)`,
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

    // --- New post-purchase flow ---
    // PURCHASED → DELIVERY_PAYMENT_PENDING → DELIVERY_PAID
    //          → (optional) DUTY_PAYMENT_PENDING → DUTY_PAID
    //          → TRACK_CODE_RECEIVED → DELIVERED

    if (
      order.status === OrderStatus.PURCHASED ||
      order.status === OrderStatus.DELIVERY_PAYMENT_PENDING
    ) {
      const hasActual = order.summary.actualDeliveryRub !== null && order.summary.actualDeliveryRub !== undefined;
      buttons.push([
        {
          text: hasActual ? 'Изменить стоимость доставки' : 'Ввести стоимость доставки',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.ACTUAL_DELIVERY,
            order.id,
          ),
        },
      ]);
    }

    if (order.status === OrderStatus.DELIVERY_PAYMENT_PENDING) {
      buttons.push([
        {
          text: '✓ Доставка оплачена',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.MARK_DELIVERY_PAID,
            order.id,
          ),
        },
      ]);
    }

    if (
      order.status === OrderStatus.DELIVERY_PAID ||
      order.status === OrderStatus.DUTY_PAYMENT_PENDING
    ) {
      const hasActual = order.summary.actualDutyRub !== null && order.summary.actualDutyRub !== undefined;
      buttons.push([
        {
          text: hasActual ? 'Изменить стоимость пошлины' : 'Ввести стоимость пошлины',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.ACTUAL_DUTY,
            order.id,
          ),
        },
      ]);
    }

    if (order.status === OrderStatus.DUTY_PAYMENT_PENDING) {
      buttons.push([
        {
          text: '✓ Пошлина оплачена',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.MARK_DUTY_PAID,
            order.id,
          ),
        },
      ]);
    }

    // Track code is only available AFTER delivery (and duty) are paid.
    if (
      order.status === OrderStatus.DELIVERY_PAID ||
      order.status === OrderStatus.DUTY_PAID ||
      order.status === OrderStatus.TRACK_CODE_RECEIVED
    ) {
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

    if (order.status === OrderStatus.TRACK_CODE_RECEIVED) {
      buttons.push([
        {
          text: '🚚 Отметить доставленным',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.MARK_DELIVERED,
            order.id,
          ),
        },
      ]);
    }

    // Cancel available from any non-terminal status.
    if (
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.CANCELLED
    ) {
      buttons.push([
        {
          text: '❌ Отменить заказ',
          callback_data: encodeManagerOrderCallback(
            MANAGER_ORDER_ACTIONS.CANCEL,
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
        return 'Ожидание оплаты товара';
      case OrderStatus.PAID_AWAITING_PURCHASE:
        return 'Оплачен, ожидается выкуп';
      case OrderStatus.PURCHASED:
        return 'Выкуплен';
      case OrderStatus.DELIVERY_PAYMENT_PENDING:
        return 'Ожидание оплаты доставки';
      case OrderStatus.DELIVERY_PAID:
        return 'Доставка оплачена';
      case OrderStatus.DUTY_PAYMENT_PENDING:
        return 'Ожидание оплаты пошлины';
      case OrderStatus.DUTY_PAID:
        return 'Пошлина оплачена';
      case OrderStatus.TRACK_CODE_RECEIVED:
        return trackCode ? `Трек-код получен — ${trackCode}` : 'Трек-код получен';
      case OrderStatus.DELIVERED:
        return 'Доставлено';
      case OrderStatus.CANCELLED:
        return 'Отменён';
      default:
        return status;
    }
  }
}

export const orderAdminService = new OrderAdminService();
