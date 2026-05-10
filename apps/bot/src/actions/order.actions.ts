import axios from 'axios';
import type { Telegraf } from 'telegraf';

import {
  MANAGER_ORDER_ACTIONS,
  OrderStatus,
  decodeManagerOrderCallback,
} from '@lean-poizon/shared';

import { ApiService } from '../services/api.service';
import { orderAdminService } from '../services/order-admin.service';
import type { BotContext } from '../types/bot-context';
import { logger } from '../utils/logger';

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

const refreshOrderMessage = async (ctx: BotContext, orderId: string) => {
  try {
    const order = await apiService.getStaffOrder(orderId, getActor(ctx));

    if (!('editMessageText' in ctx) || typeof ctx.editMessageText !== 'function') {
      return;
    }

    await ctx.editMessageText(orderAdminService.buildOrderMessage(order), {
      reply_markup: orderAdminService.buildOrderKeyboard(order),
      link_preview_options: {
        is_disabled: true,
      },
    });
  } catch (error) {
    logger.warn('Failed to refresh manager order message', {
      error: error instanceof Error ? error.message : String(error),
      orderId,
    });
  }
};

const replyWithOrderCard = async (ctx: BotContext, orderId: string) => {
  const order = await apiService.getStaffOrder(orderId, getActor(ctx));

  await ctx.reply(orderAdminService.buildOrderMessage(order), {
    reply_markup: orderAdminService.buildOrderKeyboard(order),
    link_preview_options: {
      is_disabled: true,
    },
  });
};

export const registerOrderActions = (bot: Telegraf<BotContext>) => {
  bot.command('cancel', async (ctx) => {
    if (!ctx.from) {
      return;
    }

    orderAdminService.clearPendingIntent(String(ctx.from.id));
    await ctx.reply('Текущий ввод отменён.');
  });

  bot.action(/^open_order:.+$/, async (ctx) => {
    const orderId = orderAdminService.decodeOpenOrderCallback(ctx.match.input);

    if (!orderId) {
      await ctx.answerCbQuery('Не удалось открыть заказ.', { show_alert: true });
      return;
    }

    try {
      await replyWithOrderCard(ctx, orderId);
      await ctx.answerCbQuery();
    } catch (error) {
      await ctx.answerCbQuery('Не удалось открыть заказ.', { show_alert: true });
      await ctx.reply(extractAxiosMessage(error) ?? 'Не удалось загрузить карточку заказа.');
    }
  });

  bot.action(/^ord:.+$/, async (ctx) => {
    const payload = decodeManagerOrderCallback(ctx.match.input);

    if (!payload) {
      await ctx.answerCbQuery('Действие не распознано.', { show_alert: true });
      return;
    }

    try {
      switch (payload.action) {
        case MANAGER_ORDER_ACTIONS.PAYMENT_PENDING: {
          const order = await apiService.updateOrderStatus(
            payload.orderId,
            { status: OrderStatus.PAYMENT_PENDING },
            getActor(ctx),
          );
          await ctx.answerCbQuery('Статус обновлён.');
          await ctx.reply(orderAdminService.buildStatusUpdatedText(order));
          await refreshOrderMessage(ctx, payload.orderId);
          return;
        }
        case MANAGER_ORDER_ACTIONS.PAID_AWAITING_PURCHASE: {
          const order = await apiService.updateOrderStatus(
            payload.orderId,
            { status: OrderStatus.PAID_AWAITING_PURCHASE },
            getActor(ctx),
          );
          await ctx.answerCbQuery('Статус обновлён.');
          await ctx.reply(orderAdminService.buildStatusUpdatedText(order));
          await refreshOrderMessage(ctx, payload.orderId);
          return;
        }
        case MANAGER_ORDER_ACTIONS.PURCHASED: {
          const order = await apiService.updateOrderStatus(
            payload.orderId,
            { status: OrderStatus.PURCHASED },
            getActor(ctx),
          );
          await ctx.answerCbQuery('Статус обновлён.');
          await ctx.reply(orderAdminService.buildStatusUpdatedText(order));
          await refreshOrderMessage(ctx, payload.orderId);
          return;
        }
        case MANAGER_ORDER_ACTIONS.TRACK_CODE: {
          const order = await apiService.getStaffOrder(payload.orderId, getActor(ctx));
          const callbackMessage = ctx.callbackQuery.message;

          if (
            ![OrderStatus.PURCHASED, OrderStatus.TRACK_CODE_RECEIVED].includes(order.status)
          ) {
            await ctx.answerCbQuery(
              'Трек-код можно ввести только после статуса «Выкуплен».',
              {
                show_alert: true,
              },
            );
            return;
          }

          if (!callbackMessage) {
            await ctx.answerCbQuery('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ Р·Р°РєР°Р·Р°.', {
              show_alert: true,
            });
            return;
          }

          orderAdminService.beginTrackCodeInput(String(ctx.from?.id), {
            orderId: order.id,
            orderNumber: order.orderNumber,
            sourceChatId:
              'chat' in callbackMessage ? callbackMessage.chat.id : undefined,
            sourceMessageId: callbackMessage.message_id,
          });

          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildTrackCodePrompt(order.orderNumber));
          return;
        }
        default:
          await ctx.answerCbQuery('Действие не поддерживается.', { show_alert: true });
      }
    } catch (error) {
      await ctx.answerCbQuery('Не удалось выполнить действие.', { show_alert: true });
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось выполнить действие по заказу.',
      );
    }
  });

  bot.on('text', async (ctx, next) => {
    const from = ctx.from;

    if (!from) {
      return next();
    }

    const text = ctx.message.text.trim();

    if (text.startsWith('/')) {
      return next();
    }

    const pendingTrackCode = orderAdminService.getPendingTrackCodeInput(String(from.id));

    if (pendingTrackCode) {
      try {
        const order = await apiService.updateOrderTrackCode(
          pendingTrackCode.orderId,
          { trackCode: text },
          getActor(ctx),
        );

        orderAdminService.clearPendingIntent(String(from.id));
        await ctx.reply(orderAdminService.buildTrackCodeSavedText(order));

        if (pendingTrackCode.sourceChatId && pendingTrackCode.sourceMessageId) {
          try {
            await ctx.telegram.editMessageText(
              pendingTrackCode.sourceChatId,
              pendingTrackCode.sourceMessageId,
              undefined,
              orderAdminService.buildOrderMessage(order),
              {
                reply_markup: orderAdminService.buildOrderKeyboard(order),
                link_preview_options: {
                  is_disabled: true,
                },
              },
            );
          } catch (error) {
            logger.warn('Failed to edit original manager order message after track code', {
              error: error instanceof Error ? error.message : String(error),
              orderId: pendingTrackCode.orderId,
            });
          }
        }
      } catch (error) {
        await ctx.reply(
          extractAxiosMessage(error) ??
            'Не удалось сохранить трек-код. Попробуйте ещё раз.',
        );
      }

      return;
    }

    const pendingOrderNumber = orderAdminService.getPendingOrderNumberInput(String(from.id));

    if (!pendingOrderNumber) {
      return next();
    }

    try {
      const order = await apiService.findOrderByNumber(text, getActor(ctx));
      orderAdminService.clearPendingIntent(String(from.id));
      await ctx.reply(orderAdminService.buildOrderMessage(order), {
        reply_markup: orderAdminService.buildOrderKeyboard(order),
        link_preview_options: {
          is_disabled: true,
        },
      });
    } catch (error) {
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Заказ с таким номером не найден.',
      );
    }
  });
};
