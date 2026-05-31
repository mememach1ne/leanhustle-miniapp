import axios from 'axios';
import type { Telegraf } from 'telegraf';

import type { StaffOrderListItemDto } from '@lean-poizon/shared';

import { ApiService } from '../services/api.service';
import { orderAdminService } from '../services/order-admin.service';
import type { BotContext } from '../types/bot-context';

const apiService = new ApiService();

const extractAxiosMessage = (error: unknown): string | null => {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const responseData = error.response?.data as { message?: string | string[] } | undefined;

  if (typeof responseData?.message === 'string') {
    return responseData.message;
  }

  if (Array.isArray(responseData?.message) && responseData.message[0]) {
    return responseData.message[0];
  }

  return null;
};

const getActor = (ctx: BotContext) => {
  if (!ctx.from) {
    throw new Error('Telegram user is missing.');
  }

  return {
    telegramId: String(ctx.from.id),
    username: ctx.from.username,
  };
};

const canEditSettings = (ctx: BotContext) => ctx.access?.role === 'admin';

const assertStaffPanel = async (ctx: BotContext) => {
  if (ctx.access) {
    return true;
  }

  await ctx.answerCbQuery('Панель доступна только менеджерам и администраторам.', {
    show_alert: true,
  });
  return false;
};

const assertAdminPanel = async (ctx: BotContext) => {
  if (canEditSettings(ctx)) {
    return true;
  }

  await ctx.answerCbQuery('Изменять бизнес-настройки может только admin.', {
    show_alert: true,
  });
  return false;
};

const replyWithOrderList = async (
  ctx: BotContext,
  title: string,
  orders: StaffOrderListItemDto[],
  kind: 'new' | 'active',
) => {
  if (orders.length === 0) {
    await ctx.reply(orderAdminService.buildOrderListEmptyText(kind));
    return;
  }

  await ctx.reply(orderAdminService.buildOrderListHeader(title));

  for (const order of orders) {
    await ctx.reply(orderAdminService.buildOrderListItemMessage(order), {
      reply_markup: orderAdminService.buildOpenOrderKeyboard(order.id),
      link_preview_options: {
        is_disabled: true,
      },
    });
  }
};

export const registerAdminPanelCommands = (bot: Telegraf<BotContext>) => {
  bot.action(/^admin_panel:.+$/, async (ctx) => {
    if (!(await assertStaffPanel(ctx))) {
      return;
    }

    const access = ctx.access;

    if (!access) {
      return;
    }

    const action = orderAdminService.decodeAdminPanelActionCallback(ctx.match.input);

    if (!action) {
      await ctx.answerCbQuery('Не удалось распознать действие.', { show_alert: true });
      return;
    }

    try {
      switch (action) {
        case 'orders_help': {
          await ctx.answerCbQuery();
          await ctx.editMessageText(orderAdminService.buildOrdersHelpText(), {
            reply_markup: orderAdminService.withBackToAdmin(),
          });
          return;
        }
        case 'new_orders': {
          const orders = await apiService.getNewOrders(getActor(ctx));
          const view = orderAdminService.buildOrderListView('new', orders, 1);
          await ctx.answerCbQuery();
          await ctx.editMessageText(view.text, { reply_markup: view.reply_markup });
          return;
        }
        case 'active_orders': {
          const orders = await apiService.getActiveOrders(getActor(ctx));
          const view = orderAdminService.buildOrderListView('active', orders, 1);
          await ctx.answerCbQuery();
          await ctx.editMessageText(view.text, { reply_markup: view.reply_markup });
          return;
        }
        case 'find_order': {
          if (!ctx.from) {
            return;
          }

          orderAdminService.beginOrderNumberInput(String(ctx.from.id));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildFindOrderPrompt());
          return;
        }
        case 'settings': {
          const settings = await apiService.getStaffSettings(getActor(ctx));
          await ctx.answerCbQuery();
          await ctx.editMessageText(
            orderAdminService.buildSettingsMessage(settings, canEditSettings(ctx)),
            {
              reply_markup: orderAdminService.withBackToAdmin(
                orderAdminService.buildSettingsKeyboard(canEditSettings(ctx)),
              ),
            },
          );
          return;
        }
        case 'settings_audit': {
          const logs = await apiService.getStaffSettingsAudit(getActor(ctx));
          await ctx.answerCbQuery();
          await ctx.editMessageText(orderAdminService.buildSettingsAuditMessage(logs), {
            reply_markup: orderAdminService.withBackToAdmin(),
          });
          return;
        }
        case 'set_rate': {
          if (!(await assertAdminPanel(ctx)) || !ctx.from) {
            return;
          }

          orderAdminService.beginRateFieldInput(String(ctx.from.id));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildRateFieldPrompt(), {
            reply_markup: orderAdminService.buildRateFieldKeyboard(),
          });
          return;
        }
        case 'set_commission': {
          if (!(await assertAdminPanel(ctx)) || !ctx.from) {
            return;
          }

          orderAdminService.beginCommissionInput(String(ctx.from.id));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildCommissionPrompt());
          return;
        }
        case 'set_delivery': {
          if (!(await assertAdminPanel(ctx)) || !ctx.from) {
            return;
          }

          orderAdminService.beginDeliveryInput(String(ctx.from.id));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildDeliveryPrompt());
          return;
        }
        case 'create_order': {
          if (!(await assertStaffPanel(ctx)) || !ctx.from) {
            return;
          }

          orderAdminService.beginManualOrder(String(ctx.from.id));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildManualUsernamePrompt());
          return;
        }
        case 'pending_categories': {
          await ctx.answerCbQuery();
          await showPendingList(ctx);
          return;
        }
        case 'all_categories': {
          await ctx.answerCbQuery();
          await showAllCategoriesGroupSelector(ctx);
          return;
        }
      }
    } catch (error) {
      await ctx.answerCbQuery('Не удалось выполнить действие.', { show_alert: true });
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось выполнить действие из админ-панели.',
      );
    }
  });

  // --- Generic edit-in-place navigation (admin panel, lists, order open) ---
  bot.action(/^nav:.+$/, async (ctx) => {
    if (!(await assertStaffPanel(ctx))) return;
    if (!ctx.access) return;

    const path = orderAdminService.decodeNavCallback(ctx.match.input);
    if (!path) {
      await ctx.answerCbQuery();
      return;
    }

    try {
      // nav:admin → back to admin panel
      if (path === 'admin') {
        await ctx.answerCbQuery();
        const roleLabel = ctx.access.role === 'admin' ? 'Администратор' : 'Менеджер';
        await ctx.editMessageText(orderAdminService.getWelcomeText(roleLabel), {
          reply_markup: orderAdminService.buildAdminPanelKeyboard(ctx.access.role),
        });
        return;
      }

      // nav:list:<kind>:<page>
      const listMatch = /^list:(new|active):(\d+)$/.exec(path);
      if (listMatch) {
        const kind = listMatch[1] as 'new' | 'active';
        const page = Number(listMatch[2]) || 1;
        const orders =
          kind === 'new'
            ? await apiService.getNewOrders(getActor(ctx))
            : await apiService.getActiveOrders(getActor(ctx));
        const view = orderAdminService.buildOrderListView(kind, orders, page);
        await ctx.answerCbQuery();
        await ctx.editMessageText(view.text, { reply_markup: view.reply_markup });
        return;
      }

      // nav:order:<id>:<kind>:<page>
      const orderMatch = /^order:([\w-]+):(new|active):(\d+)$/.exec(path);
      if (orderMatch) {
        const orderId = orderMatch[1];
        const kind = orderMatch[2] as 'new' | 'active';
        const page = Number(orderMatch[3]) || 1;
        const order = await apiService.getStaffOrder(orderId, getActor(ctx));
        await ctx.answerCbQuery();
        await ctx.editMessageText(orderAdminService.buildOrderMessage(order), {
          reply_markup: orderAdminService.withOrderDetailNav(
            orderAdminService.buildOrderKeyboard(order),
            { kind, page },
          ),
          link_preview_options: { is_disabled: true },
        });
        return;
      }

      await ctx.answerCbQuery();
    } catch (error) {
      await ctx.answerCbQuery('Ошибка.', { show_alert: true });
      await ctx.reply(extractAxiosMessage(error) ?? 'Не удалось выполнить навигацию.');
    }
  });

  // --- Category navigation (edit-in-place) ---
  bot.action(/^cat:.+$/, async (ctx) => {
    if (!(await assertStaffPanel(ctx))) return;
    if (!ctx.from || !ctx.access) return;

    const decoded = orderAdminService.decodeCategoryCallback(ctx.match.input);
    if (!decoded) {
      await ctx.answerCbQuery('Не удалось распознать действие.', { show_alert: true });
      return;
    }

    try {
      switch (decoded.action) {
        case 'back_admin': {
          await ctx.answerCbQuery();
          await ctx.editMessageText(
            orderAdminService.getWelcomeText(
              ctx.access.role === 'admin' ? 'Администратор' : 'Менеджер',
            ),
            { reply_markup: orderAdminService.buildAdminPanelKeyboard(ctx.access.role) },
          );
          return;
        }
        case 'list_pending': {
          await ctx.answerCbQuery();
          await showPendingList(ctx);
          return;
        }
        case 'list_all': {
          await ctx.answerCbQuery();
          await showAllCategoriesGroupSelector(ctx);
          return;
        }
        case 'group': {
          if (!decoded.arg) return;
          await ctx.answerCbQuery();
          await showGroupCategories(ctx, decoded.arg);
          return;
        }
        case 'open': {
          if (!decoded.arg) return;
          const record = await apiService.getDeliveryCategory(decoded.arg, getActor(ctx));
          // Decide back target from where the category lives: pending if
          // weight is null, otherwise its group (or "dynamic").
          let backTo: string;
          if (record.weightKg === null) {
            backTo = 'pending';
          } else if (record.categoryKey.startsWith('enum:')) {
            const group = orderAdminService
              .getCategoryGroups()
              .find((g) => g.enumKeys.includes(record.categoryKey));
            backTo = `group:${group?.key ?? 'apparel'}`;
          } else {
            backTo = 'group:dynamic';
          }
          await ctx.answerCbQuery();
          await ctx.editMessageText(
            orderAdminService.buildCategoryDetailText({
              title: record.title,
              categoryKey: record.categoryKey,
              categoryL1: record.categoryL1,
              categoryL2: record.categoryL2,
              categoryL3: record.categoryL3,
              weightKg: record.weightKg,
              encounterCount: record.encounterCount,
              firstSeenAt: new Date(record.firstSeenAt),
            }),
            { reply_markup: orderAdminService.buildCategoryDetailKeyboard(record.id, backTo) },
          );
          return;
        }
        case 'edit': {
          if (!decoded.arg) return;
          const record = await apiService.getDeliveryCategory(decoded.arg, getActor(ctx));
          orderAdminService.beginCategoryWeightInput(String(ctx.from.id), {
            categoryId: record.id,
            categoryTitle: record.title,
          });
          await ctx.answerCbQuery();
          // Don't edit the message — manager needs to see what they're
          // editing while typing. Just send the prompt as a new message.
          await ctx.reply(orderAdminService.buildCategoryWeightPrompt(record.title));
          return;
        }
        case 'delete': {
          if (!decoded.arg) return;
          await apiService.deleteDeliveryCategory(decoded.arg, getActor(ctx));
          await ctx.answerCbQuery('Категория удалена');
          await showAllCategoriesGroupSelector(ctx);
          return;
        }
        default:
          await ctx.answerCbQuery();
      }
    } catch (error) {
      await ctx.answerCbQuery('Ошибка.', { show_alert: true });
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось выполнить действие с категорией.',
      );
    }
  });

  // --- Manual order creation: inline button actions ---
  bot.action(/^mo:.+$/, async (ctx) => {
    if (!(await assertStaffPanel(ctx))) return;
    if (!ctx.from) return;

    const managerId = String(ctx.from.id);
    const action = orderAdminService.decodeManualOrderCallback(ctx.match.input);
    if (!action) {
      await ctx.answerCbQuery();
      return;
    }

    const draft = orderAdminService.getManualOrderDraft(managerId);
    if (!draft) {
      await ctx.answerCbQuery('Сессия создания заказа истекла. Начните заново.', {
        show_alert: true,
      });
      return;
    }

    try {
      if (action === 'cancel') {
        orderAdminService.clearPendingIntent(managerId);
        await ctx.answerCbQuery('Отменено');
        await ctx.editMessageText('Создание заказа отменено.');
        return;
      }

      if (action.startsWith('grp:')) {
        const groupKey = action.slice('grp:'.length);
        const keyboard = orderAdminService.buildManualCategoryKeyboard(groupKey);
        if (!keyboard) {
          await ctx.answerCbQuery();
          return;
        }
        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup(keyboard);
        return;
      }

      if (action === 'grpback') {
        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup(
          orderAdminService.buildManualCategoryGroupsKeyboard(),
        );
        return;
      }

      if (action.startsWith('cat:')) {
        if (draft.step !== 'item_category') {
          await ctx.answerCbQuery();
          return;
        }
        const category = action.slice('cat:'.length);
        if (!orderAdminService.isValidDeliveryCategory(category)) {
          await ctx.answerCbQuery('Неизвестная категория.', { show_alert: true });
          return;
        }
        draft.current.deliveryCategory = category;
        draft.step = 'item_size';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.answerCbQuery('Категория выбрана');
        await ctx.editMessageText('Категория выбрана ✅');
        await ctx.reply(orderAdminService.buildManualItemSizePrompt());
        return;
      }

      if (action === 'additem') {
        if (draft.step !== 'add_more') {
          await ctx.answerCbQuery();
          return;
        }
        draft.current = {};
        draft.step = 'item_link';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.answerCbQuery();
        await ctx.reply(orderAdminService.buildManualItemLinkPrompt(draft.items.length + 1));
        return;
      }

      if (action === 'finish') {
        if (draft.step !== 'add_more') {
          await ctx.answerCbQuery();
          return;
        }
        if (draft.items.length === 0) {
          await ctx.answerCbQuery('Добавьте хотя бы один товар.', { show_alert: true });
          return;
        }
        draft.step = 'delivery_name';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.answerCbQuery();
        await ctx.reply(orderAdminService.buildManualDeliveryNamePrompt());
        return;
      }

      if (action === 'confirm') {
        if (draft.step !== 'confirm') {
          await ctx.answerCbQuery();
          return;
        }
        await ctx.answerCbQuery('Создаём…');
        try {
          const order = await apiService.createManualOrder(
            orderAdminService.buildManualOrderRequest(draft),
            getActor(ctx),
          );
          orderAdminService.clearPendingIntent(managerId);
          await ctx.editMessageText(
            `✅ Заказ ${order.orderNumber} создан и отправлен клиенту @${draft.username ?? ''}.`,
          );
        } catch (error) {
          await ctx.reply(
            extractAxiosMessage(error) ?? 'Не удалось создать заказ. Проверьте данные и попробуйте снова.',
          );
        }
        return;
      }

      await ctx.answerCbQuery();
    } catch (error) {
      await ctx.answerCbQuery('Ошибка.', { show_alert: true });
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось выполнить действие.',
      );
    }
  });

  // --- Manual order creation: text input steps ---
  bot.on('text', async (ctx, next) => {
    if (!ctx.from) return next();

    const managerId = String(ctx.from.id);
    const draft = orderAdminService.getManualOrderDraft(managerId);
    if (!draft) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next();

    switch (draft.step) {
      case 'username': {
        const username = text.replace(/^@+/, '').trim();
        if (!username) {
          await ctx.reply('Укажите корректный @username клиента.');
          return;
        }
        draft.username = username;
        draft.step = 'item_link';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualItemLinkPrompt(1));
        return;
      }
      case 'item_link': {
        draft.current.dewuLink = text === '-' ? undefined : text;
        draft.step = 'item_title';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualItemTitlePrompt());
        return;
      }
      case 'item_title': {
        if (!text) {
          await ctx.reply('Название не может быть пустым.');
          return;
        }
        draft.current.productTitle = text;
        draft.step = 'item_price';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualItemPricePrompt());
        return;
      }
      case 'item_price': {
        const price = orderAdminService.parseNumericInput(text);
        if (price === null || price <= 0) {
          await ctx.reply('Введите корректную цену в юанях, например 549 или 549,90.');
          return;
        }
        draft.current.priceYuan = price;
        draft.step = 'item_category';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualItemCategoryPrompt(), {
          reply_markup: orderAdminService.buildManualCategoryGroupsKeyboard(),
        });
        return;
      }
      case 'item_category': {
        await ctx.reply('Выберите категорию кнопкой выше.');
        return;
      }
      case 'item_size': {
        draft.current.sizeLabel = text === '-' ? undefined : text;
        draft.step = 'item_qty';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualItemQtyPrompt());
        return;
      }
      case 'item_qty': {
        const qty = orderAdminService.parseNumericInput(text);
        if (qty === null || !Number.isInteger(qty) || qty < 1) {
          await ctx.reply('Введите целое количество, например 1.');
          return;
        }
        const current = draft.current;
        if (
          !current.productTitle ||
          current.priceYuan === undefined ||
          !current.deliveryCategory
        ) {
          await ctx.reply('Данные товара неполные. Начните заново через /cancel.');
          return;
        }
        draft.items.push({
          dewuLink: current.dewuLink,
          productTitle: current.productTitle,
          priceYuan: current.priceYuan,
          deliveryCategory: current.deliveryCategory,
          sizeLabel: current.sizeLabel,
          quantity: qty,
        });
        draft.current = {};
        draft.step = 'add_more';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(
          `Товар добавлен.\n\n${orderAdminService.buildManualItemsSummary(draft)}`,
          { reply_markup: orderAdminService.buildManualAddMoreKeyboard() },
        );
        return;
      }
      case 'add_more': {
        await ctx.reply('Выберите действие кнопкой выше.');
        return;
      }
      case 'delivery_name': {
        if (!text) {
          await ctx.reply('ФИО не может быть пустым.');
          return;
        }
        draft.delivery.fullName = text;
        draft.step = 'delivery_address';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualDeliveryAddressPrompt());
        return;
      }
      case 'delivery_address': {
        if (!text) {
          await ctx.reply('Адрес не может быть пустым.');
          return;
        }
        draft.delivery.cdekAddress = text;
        draft.step = 'delivery_phone';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualDeliveryPhonePrompt());
        return;
      }
      case 'delivery_phone': {
        if (!text) {
          await ctx.reply('Телефон не может быть пустым.');
          return;
        }
        draft.delivery.phone = text;
        draft.step = 'delivery_comment';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualDeliveryCommentPrompt());
        return;
      }
      case 'delivery_comment': {
        draft.delivery.comment = text === '-' ? undefined : text;
        draft.step = 'confirm';
        orderAdminService.updateManualOrderDraft(managerId, draft);
        await ctx.reply(orderAdminService.buildManualOrderConfirmText(draft), {
          reply_markup: orderAdminService.buildManualConfirmKeyboard(),
        });
        return;
      }
      case 'confirm': {
        await ctx.reply('Подтвердите создание кнопкой выше или /cancel.');
        return;
      }
      default:
        return next();
    }
  });
};

// --- helpers ---

const showPendingList = async (ctx: BotContext) => {
  const rows = await apiService.listPendingDeliveryCategories(getActor(ctx));
  await ctx.editMessageText(orderAdminService.buildPendingListText(rows), {
    reply_markup: orderAdminService.buildPendingListKeyboard(rows),
  });
};

const showAllCategoriesGroupSelector = async (ctx: BotContext) => {
  const all = await apiService.listAllDeliveryCategories(getActor(ctx));
  // Only count entries that don't fit into any named group (after the
  // dynamic-title classifier). Otherwise the dynamic counter shows
  // categories that already live under Footwear/Apparel/Accessories.
  const dynamicCount = orderAdminService.filterCategoriesByGroup(all, 'dynamic').length;
  await ctx.editMessageText(orderAdminService.buildAllCategoriesText(), {
    reply_markup: orderAdminService.buildAllCategoriesKeyboard(dynamicCount),
  });
};

const showGroupCategories = async (ctx: BotContext, groupKey: string) => {
  const all = await apiService.listAllDeliveryCategories(getActor(ctx));
  const rows = orderAdminService.filterCategoriesByGroup(all, groupKey);
  await ctx.editMessageText(
    orderAdminService.buildGroupCategoriesText(groupKey, rows.length),
    { reply_markup: orderAdminService.buildGroupCategoriesKeyboard(groupKey, rows) },
  );
};
