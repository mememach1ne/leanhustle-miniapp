import type { Telegraf } from 'telegraf';

import { clientMessagesService } from '../services/client-messages.service';
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
    console.error('[subscription] getChatMember failed:', error);
    return true;
  }
};

const sendClientWelcome = async (ctx: BotContext) => {
  const sent = await ctx.reply(orderAdminService.getClientWelcomeText(), {
    parse_mode: 'HTML',
    reply_markup: orderAdminService.buildClientWelcomeKeyboard(),
  });
  if (ctx.chat) {
    clientMessagesService.track(ctx.chat.id, sent.message_id);
  }
};

const sendSubscriptionGate = async (ctx: BotContext) => {
  const sent = await ctx.reply(orderAdminService.getSubscriptionRequiredText(), {
    reply_markup: orderAdminService.buildSubscriptionRequiredKeyboard(),
  });
  if (ctx.chat) {
    clientMessagesService.track(ctx.chat.id, sent.message_id);
  }
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
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) return;

    // Clean up the chat from previous bot messages.
    await clientMessagesService.clearChat(bot, chatId);

    const subscribed = await isUserSubscribed(bot, userId);

    if (!subscribed) {
      await sendSubscriptionGate(ctx);
      return;
    }

    await sendClientWelcome(ctx);
  });

  bot.action(/^client:.+$/, async (ctx) => {
    const data = ctx.match.input;
    const chatId = ctx.chat?.id;
    const sourceMessageId = ctx.callbackQuery?.message?.message_id;

    if (orderAdminService.isClientCheckSubscriptionCallback(data)) {
      const userId = ctx.from?.id;
      if (!userId || !chatId) {
        await ctx.answerCbQuery();
        return;
      }

      const subscribed = await isUserSubscribed(bot, userId);

      if (subscribed) {
        await ctx.answerCbQuery('✅ Подписка подтверждена');
        // Drop the subscription gate (and any leftover "still missing"
        // notices) before showing the welcome.
        await clientMessagesService.clearChat(bot, chatId);
        await sendClientWelcome(ctx);
      } else {
        await ctx.answerCbQuery('Подписка не найдена');
        // Don't pile up "still missing" notices: send one fresh and track it.
        const sent = await ctx.reply(orderAdminService.getSubscriptionStillMissingText());
        clientMessagesService.track(chatId, sent.message_id);
      }
      return;
    }

    if (orderAdminService.isClientDownloadAppCallback(data)) {
      await ctx.answerCbQuery();
      const sent = await ctx.reply(orderAdminService.getDownloadAppText(), {
        reply_markup: orderAdminService.buildDownloadAppKeyboard(),
      });
      if (chatId) clientMessagesService.track(chatId, sent.message_id);
      return;
    }

    if (orderAdminService.isClientOtherMarketplacesCallback(data)) {
      await ctx.answerCbQuery();
      const sent = await ctx.reply(orderAdminService.getOtherMarketplacesText(), {
        reply_markup: orderAdminService.buildOtherMarketplacesKeyboard(),
      });
      if (chatId) clientMessagesService.track(chatId, sent.message_id);
      return;
    }

    await ctx.answerCbQuery();
    // Touch unused variable to satisfy linter when no branch matched
    void sourceMessageId;
  });
};
