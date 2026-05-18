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
          const rows = await apiService.listPendingDeliveryCategories(getActor(ctx));
          await ctx.answerCbQuery();
          await ctx.reply(
            orderAdminService.buildCategoryListText('⚠️ Непроверенные категории:', rows),
            { reply_markup: orderAdminService.buildCategoryListKeyboard(rows) },
          );
          return;
        }
        case 'all_categories': {
          const rows = await apiService.listAllDeliveryCategories(getActor(ctx));
          await ctx.answerCbQuery();
          await ctx.reply(
            orderAdminService.buildCategoryListText('📦 Все категории:', rows),
            { reply_markup: orderAdminService.buildCategoryListKeyboard(rows) },
          );
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

  // --- Category detail / edit / delete callbacks ---
  bot.action(/^cat:.+$/, async (ctx) => {
    if (!(await assertStaffPanel(ctx))) return;
    if (!ctx.from) return;

    const decoded = orderAdminService.decodeCategoryCallback(ctx.match.input);
    if (!decoded) {
      await ctx.answerCbQuery('Не удалось распознать действие.', { show_alert: true });
      return;
    }

    try {
      if (decoded.action === 'open') {
        const record = await apiService.getDeliveryCategory(decoded.id, getActor(ctx));
        await ctx.answerCbQuery();
        await ctx.reply(
          orderAdminService.buildCategoryDetailText({
            title: record.title,
            categoryL1: record.categoryL1,
            categoryL2: record.categoryL2,
            categoryL3: record.categoryL3,
            weightKg: record.weightKg,
            encounterCount: record.encounterCount,
            firstSeenAt: new Date(record.firstSeenAt),
          }),
          { reply_markup: orderAdminService.buildCategoryDetailKeyboard(record.id) },
        );
        return;
      }

      if (decoded.action === 'edit') {
        const record = await apiService.getDeliveryCategory(decoded.id, getActor(ctx));
        orderAdminService.beginCategoryWeightInput(String(ctx.from.id), {
          categoryId: record.id,
          categoryTitle: record.title,
        });
        await ctx.answerCbQuery();
        await ctx.reply(orderAdminService.buildCategoryWeightPrompt(record.title));
        return;
      }

      if (decoded.action === 'delete') {
        await apiService.deleteDeliveryCategory(decoded.id, getActor(ctx));
        await ctx.answerCbQuery('Категория удалена');
        await ctx.reply('🗑 Категория удалена.');
        return;
      }
    } catch (error) {
      await ctx.answerCbQuery('Ошибка.', { show_alert: true });
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось выполнить действие с категорией.',
      );
    }
  });
};
