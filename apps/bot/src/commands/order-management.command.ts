import axios from 'axios';
import type { Telegraf } from 'telegraf';

import type { StaffOrderDetailsDto, StaffOrderListItemDto } from '@lean-poizon/shared';

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

const replyWithOrderCard = async (ctx: BotContext, order: StaffOrderDetailsDto) => {
  await ctx.reply(orderAdminService.buildOrderMessage(order), {
    reply_markup: orderAdminService.buildOrderKeyboard(order),
    link_preview_options: {
      is_disabled: true,
    },
  });
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

const getCommandArgument = (text: string) => {
  const parts = text.trim().split(/\s+/);
  return parts.slice(1).join(' ').trim();
};

export const registerOrderManagementCommands = (bot: Telegraf<BotContext>) => {
  bot.command('orders_help', async (ctx) => {
    await ctx.reply(orderAdminService.buildOrdersHelpText());
  });

  bot.command('new_orders', async (ctx) => {
    try {
      const orders = await apiService.getNewOrders(getActor(ctx));
      await replyWithOrderList(ctx, 'Последние новые заказы:', orders, 'new');
    } catch (error) {
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось загрузить список новых заказов.',
      );
    }
  });

  bot.command('active_orders', async (ctx) => {
    try {
      const orders = await apiService.getActiveOrders(getActor(ctx));
      await replyWithOrderList(ctx, 'Активные заказы:', orders, 'active');
    } catch (error) {
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось загрузить список активных заказов.',
      );
    }
  });

  bot.command('find_order', async (ctx) => {
    const text = 'text' in ctx.message ? ctx.message.text : '';
    const orderNumber = getCommandArgument(text);

    if (!ctx.from) {
      return;
    }

    if (!orderNumber) {
      orderAdminService.beginOrderNumberInput(String(ctx.from.id));
      await ctx.reply(orderAdminService.buildFindOrderPrompt());
      return;
    }

    try {
      const order = await apiService.findOrderByNumber(orderNumber, getActor(ctx));
      await replyWithOrderCard(ctx, order);
    } catch (error) {
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось найти заказ по указанному номеру.',
      );
    }
  });
};
