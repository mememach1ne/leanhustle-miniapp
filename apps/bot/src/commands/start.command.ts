import type { Telegraf } from 'telegraf';

import { NEWS_CHANNEL_USERNAME, orderAdminService } from '../services/order-admin.service';
import type { BotContext } from '../types/bot-context';

const SUBSCRIBED_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted']);

const isUserSubscribed = async (
  bot: Telegraf<BotContext>,
  userId: number,
): Promise<boolean> => {
  try {
    const member = await bot.telegram.getChatMember(NEWS_CHANNEL_USERNAME, userId);
    return SUBSCRIBED_STATUSES.has(member.status);
  } catch (error) {
    // If the bot is not in the channel or the API call fails, fail open
    // (let users in) so we don't lock everyone out on a misconfiguration.
    // The error is logged so operators can fix it.
    console.error('[subscription] getChatMember failed:', error);
    return true;
  }
};

const sendClientWelcome = async (ctx: BotContext) => {
  await ctx.reply(orderAdminService.getClientWelcomeText(), {
    parse_mode: 'HTML',
    reply_markup: orderAdminService.buildClientWelcomeKeyboard(),
  });
};

const sendSubscriptionGate = async (ctx: BotContext) => {
  await ctx.reply(orderAdminService.getSubscriptionRequiredText(), {
    reply_markup: orderAdminService.buildSubscriptionRequiredKeyboard(),
  });
};

export const registerStartCommand = (bot: Telegraf<BotContext>) => {
  bot.start(async (ctx) => {
    if (ctx.access) {
      const roleLabel = ctx.access.role === 'admin' ? 'Администратор' : 'Менеджер';
      await ctx.reply(orderAdminService.getWelcomeText(roleLabel), {
        reply_markup: orderAdminService.buildAdminPanelKeyboard(ctx.access.role),
      });
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const subscribed = await isUserSubscribed(bot, userId);

    if (!subscribed) {
      await sendSubscriptionGate(ctx);
      return;
    }

    await sendClientWelcome(ctx);
  });

  bot.action(/^client:.+$/, async (ctx) => {
    const data = ctx.match.input;

    if (orderAdminService.isClientCheckSubscriptionCallback(data)) {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.answerCbQuery();
        return;
      }

      const subscribed = await isUserSubscribed(bot, userId);

      if (subscribed) {
        await ctx.answerCbQuery('✅ Подписка подтверждена');
        await sendClientWelcome(ctx);
      } else {
        await ctx.answerCbQuery('Подписка не найдена', { show_alert: false });
        await ctx.reply(orderAdminService.getSubscriptionStillMissingText());
      }
      return;
    }

    if (orderAdminService.isClientDownloadAppCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.reply(orderAdminService.getDownloadAppText(), {
        reply_markup: orderAdminService.buildDownloadAppKeyboard(),
      });
      return;
    }

    if (orderAdminService.isClientOtherMarketplacesCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.reply(orderAdminService.getOtherMarketplacesText(), {
        reply_markup: orderAdminService.buildOtherMarketplacesKeyboard(),
      });
      return;
    }

    await ctx.answerCbQuery();
  });
};
