import axios from 'axios';
import type { Telegraf } from 'telegraf';

import type { UpdateBusinessSettingsRequest } from '@lean-poizon/shared';

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

const assertAdminOrReply = async (ctx: BotContext) => {
  if (canEditSettings(ctx)) {
    return true;
  }

  await ctx.reply('Изменять бизнес-настройки может только admin.');
  return false;
};

const applySettingsPatch = async (
  ctx: BotContext,
  payload: UpdateBusinessSettingsRequest,
  changedFields: string[],
) => {
  const settings = await apiService.updateStaffSettings(payload, getActor(ctx));
  orderAdminService.clearPendingIntent(String(ctx.from?.id));

  await ctx.reply(orderAdminService.buildSettingsUpdatedText(settings, changedFields), {
    reply_markup: orderAdminService.buildSettingsKeyboard(canEditSettings(ctx)),
  });
};

export const registerSettingsCommands = (bot: Telegraf<BotContext>) => {
  bot.command('settings', async (ctx) => {
    try {
      const settings = await apiService.getStaffSettings(getActor(ctx));
      await ctx.reply(orderAdminService.buildSettingsMessage(settings, canEditSettings(ctx)), {
        reply_markup: orderAdminService.buildSettingsKeyboard(canEditSettings(ctx)),
      });
    } catch (error) {
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось загрузить текущие бизнес-настройки.',
      );
    }
  });

  bot.command('settings_audit', async (ctx) => {
    try {
      const logs = await apiService.getStaffSettingsAudit(getActor(ctx));
      await ctx.reply(orderAdminService.buildSettingsAuditMessage(logs));
    } catch (error) {
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось загрузить историю изменений.',
      );
    }
  });

  bot.command('set_rate', async (ctx) => {
    if (!(await assertAdminOrReply(ctx)) || !ctx.from) {
      return;
    }

    orderAdminService.beginRateFieldInput(String(ctx.from.id));
    await ctx.reply(orderAdminService.buildRateFieldPrompt(), {
      reply_markup: orderAdminService.buildRateFieldKeyboard(),
    });
  });

  bot.command('set_commission', async (ctx) => {
    if (!(await assertAdminOrReply(ctx)) || !ctx.from) {
      return;
    }

    orderAdminService.beginCommissionInput(String(ctx.from.id));
    await ctx.reply(orderAdminService.buildCommissionPrompt());
  });

  bot.command('set_delivery', async (ctx) => {
    if (!(await assertAdminOrReply(ctx)) || !ctx.from) {
      return;
    }

    orderAdminService.beginDeliveryInput(String(ctx.from.id));
    await ctx.reply(orderAdminService.buildDeliveryPrompt());
  });

  bot.action(/^settings_action:.+$/, async (ctx) => {
    const action = orderAdminService.decodeSettingsActionCallback(ctx.match.input);

    if (!action) {
      await ctx.answerCbQuery('Не удалось распознать действие.', { show_alert: true });
      return;
    }

    try {
      switch (action) {
        case 'audit': {
          const logs = await apiService.getStaffSettingsAudit(getActor(ctx));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildSettingsAuditMessage(logs));
          return;
        }
        case 'set_rate': {
          if (!(await assertAdminOrReply(ctx)) || !ctx.from) {
            await ctx.answerCbQuery();
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
          if (!(await assertAdminOrReply(ctx)) || !ctx.from) {
            await ctx.answerCbQuery();
            return;
          }

          orderAdminService.beginCommissionInput(String(ctx.from.id));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildCommissionPrompt());
          return;
        }
        case 'set_delivery': {
          if (!(await assertAdminOrReply(ctx)) || !ctx.from) {
            await ctx.answerCbQuery();
            return;
          }

          orderAdminService.beginDeliveryInput(String(ctx.from.id));
          await ctx.answerCbQuery();
          await ctx.reply(orderAdminService.buildDeliveryPrompt());
          return;
        }
      }
    } catch (error) {
      await ctx.answerCbQuery('Не удалось выполнить действие.', { show_alert: true });
      await ctx.reply(
        extractAxiosMessage(error) ?? 'Не удалось выполнить действие с настройками.',
      );
    }
  });

  bot.action(/^settings_rate:.+$/, async (ctx) => {
    const field = orderAdminService.decodeSettingsRateCallback(ctx.match.input);

    if (!field) {
      await ctx.answerCbQuery('Не удалось распознать курс.', { show_alert: true });
      return;
    }

    if (!(await assertAdminOrReply(ctx)) || !ctx.from) {
      await ctx.answerCbQuery();
      return;
    }

    orderAdminService.beginRateValueInput(String(ctx.from.id), field);
    await ctx.answerCbQuery();
    await ctx.reply(orderAdminService.buildRateValuePrompt(field));
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

    const managerId = String(from.id);

    const pendingRateField = orderAdminService.getPendingRateFieldInput(managerId);

    if (pendingRateField) {
      const field = orderAdminService.parseRateFieldInput(text);

      if (!field) {
        await ctx.reply(
          'Не удалось распознать курс. Используйте CNY_USD, CNY_RUB или EUR_RUB.',
          {
            reply_markup: orderAdminService.buildRateFieldKeyboard(),
          },
        );
        return;
      }

      orderAdminService.beginRateValueInput(managerId, field);
      await ctx.reply(orderAdminService.buildRateValuePrompt(field));
      return;
    }

    const pendingRateValue = orderAdminService.getPendingRateValueInput(managerId);

    if (pendingRateValue) {
      const parsed = orderAdminService.parseNumericInput(text);

      if (parsed === null) {
        await ctx.reply('Не удалось распознать число. Введите значение ещё раз.');
        return;
      }

      try {
        await applySettingsPatch(
          ctx,
          {
            [pendingRateValue.field]: parsed,
          },
          [pendingRateValue.field],
        );
      } catch (error) {
        await ctx.reply(
          extractAxiosMessage(error) ?? 'Не удалось обновить курс. Попробуйте ещё раз.',
        );
      }

      return;
    }

    const pendingCommission = orderAdminService.getPendingCommissionInput(managerId);

    if (pendingCommission) {
      const parsed = orderAdminService.parseNumericInput(text);

      if (parsed === null) {
        await ctx.reply('Не удалось распознать число. Введите комиссию ещё раз.');
        return;
      }

      try {
        await applySettingsPatch(
          ctx,
          {
            commissionPercent: parsed,
          },
          ['commissionPercent'],
        );
      } catch (error) {
        await ctx.reply(
          extractAxiosMessage(error) ?? 'Не удалось обновить комиссию. Попробуйте ещё раз.',
        );
      }

      return;
    }

    const pendingDelivery = orderAdminService.getPendingDeliveryInput(managerId);

    if (pendingDelivery) {
      const parsed = orderAdminService.parseNumericInput(text);

      if (parsed === null) {
        await ctx.reply('Не удалось распознать число. Введите стоимость доставки ещё раз.');
        return;
      }

      try {
        await applySettingsPatch(
          ctx,
          {
            deliveryPricePerKgRub: parsed,
          },
          ['deliveryPricePerKgRub'],
        );
      } catch (error) {
        await ctx.reply(
          extractAxiosMessage(error) ?? 'Не удалось обновить стоимость доставки.',
        );
      }

      return;
    }

    return next();
  });
};
