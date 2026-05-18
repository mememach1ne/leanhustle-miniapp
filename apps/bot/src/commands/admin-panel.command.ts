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
          await ctx.reply(orderAdminService.buildOrdersHelpText(), {
            reply_markup: orderAdminService.buildAdminPanelKeyboard(access.role),
          });
          return;
        }
        case 'new_orders': {
          const orders = await apiService.getNewOrders(getActor(ctx));
          await ctx.answerCbQuery();
          await replyWithOrderList(ctx, 'Последние новые заказы:', orders, 'new');
          return;
        }
        case 'active_orders': {
          const orders = await apiService.getActiveOrders(getActor(ctx));
          await ctx.answerCbQuery();
          await replyWithOrderList(ctx, 'Активные заказы:', orders, 'active');
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
          await ctx.reply(orderAdminService.buildSettingsMessage(settings, canEditSettings(ctx)), {
            reply_markup: orderAdminService.buildSettingsKeyboard(canEditSettings(ctx)),
          });
          return;
        }
        case 'settings_audit': {
          const logs = await apiService.getStaffSettingsAudit(getActor(ctx));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildSettingsAuditMessage(logs));
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
  const dynamicCount = all.filter((r) => !r.categoryKey.startsWith('enum:')).length;
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
