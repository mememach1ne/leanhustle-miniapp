import type { Telegraf } from 'telegraf';

import { ApiService } from '../services/api.service';
import { clientMessagesService } from '../services/client-messages.service';
import { NEWS_CHANNEL_USERNAME, orderAdminService } from '../services/order-admin.service';
import type { BotContext } from '../types/bot-context';

const SUBSCRIBED_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted']);
const LOGIN_PREFIX = 'login_';

const apiService = new ApiService();

/** Website login codes waiting for the user to pass the subscription gate. */
const pendingWebLogins = new Map<number, string>();

const extractLoginToken = (payload: string | undefined): string | null => {
  if (!payload?.startsWith(LOGIN_PREFIX)) return null;
  const token = payload.slice(LOGIN_PREFIX.length);
  return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null;
};

/** Confirm the website login for this Telegram user and offer a way back. */
const completeWebLogin = async (ctx: BotContext, token: string) => {
  const from = ctx.from;
  if (!from) return;

  try {
    const { returnUrl } = await apiService.confirmBotLogin({
      token,
      telegramId: String(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
    });
    const sent = await ctx.reply(
      [
        '✅ Вход на сайт подтверждён!',
        '',
        'Вернитесь на вкладку сайта — вход произойдёт автоматически. Или нажмите кнопку ниже.',
      ].join('\n'),
      { reply_markup: { inline_keyboard: [[{ text: '↩️ Вернуться на сайт', url: returnUrl }]] } },
    );
    if (ctx.chat) clientMessagesService.track(ctx.chat.id, sent.message_id);
  } catch (error) {
    console.error('[web-login] confirm failed:', error instanceof Error ? error.message : error);
    await ctx.reply(
      '⏳ Ссылка для входа устарела. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.',
    );
  }
};

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
    // Website login: t.me/<bot>?start=login_<code>. Clients pass the usual
    // subscription gate first; staff are confirmed right away.
    const loginToken = extractLoginToken(ctx.payload);
    if (loginToken && ctx.from) {
      if (!ctx.access) {
        if (ctx.chat) await clientMessagesService.clearChat(bot, ctx.chat.id);
        if (!(await isUserSubscribed(bot, ctx.from.id))) {
          pendingWebLogins.set(ctx.from.id, loginToken);
          await sendSubscriptionGate(ctx);
          return;
        }
      }
      await completeWebLogin(ctx, loginToken);
      return;
    }

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

    // Clean up any previous bot messages so the chat starts fresh.
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

    // --- Subscription check ---
    if (orderAdminService.isClientCheckSubscriptionCallback(data)) {
      const userId = ctx.from?.id;
      if (!userId || !chatId) {
        await ctx.answerCbQuery();
        return;
      }

      const subscribed = await isUserSubscribed(bot, userId);

      if (subscribed) {
        await ctx.answerCbQuery('✅ Подписка подтверждена');

        const pendingLogin = pendingWebLogins.get(userId);
        if (pendingLogin) {
          pendingWebLogins.delete(userId);
          await ctx.deleteMessage().catch(() => undefined);
          await completeWebLogin(ctx, pendingLogin);
          return;
        }

        // Replace gate message in-place with the welcome screen.
        await ctx.editMessageText(orderAdminService.getClientWelcomeText(), {
          parse_mode: 'HTML',
          reply_markup: orderAdminService.buildClientWelcomeKeyboard(),
        });
      } else {
        // Don't add a new message — show alert popup instead.
        await ctx.answerCbQuery(
          'Подписка не найдена. Подпишись на @lh_poizon и попробуй снова.',
          { show_alert: true },
        );
      }
      return;
    }

    // --- Download submenu ---
    if (orderAdminService.isClientDownloadAppCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(orderAdminService.getDownloadAppText(), {
        reply_markup: orderAdminService.buildDownloadAppKeyboard(),
      });
      return;
    }

    // --- Other marketplaces submenu ---
    if (orderAdminService.isClientOtherMarketplacesCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(orderAdminService.getOtherMarketplacesText(), {
        parse_mode: 'HTML',
        reply_markup: orderAdminService.buildOtherMarketplacesKeyboard(),
      });
      return;
    }

    // --- Guide submenu (video / text) ---
    if (orderAdminService.isClientGuideCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(orderAdminService.getGuideText(), {
        reply_markup: orderAdminService.buildGuideKeyboard(),
      });
      return;
    }

    // --- Reviews submenu (reviews / purchases channels) ---
    if (orderAdminService.isClientReviewsCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(orderAdminService.getReviewsText(), {
        reply_markup: orderAdminService.buildReviewsKeyboard(),
      });
      return;
    }

    // --- Back to welcome from any submenu ---
    if (orderAdminService.isClientBackToWelcomeCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(orderAdminService.getClientWelcomeText(), {
        parse_mode: 'HTML',
        reply_markup: orderAdminService.buildClientWelcomeKeyboard(),
      });
      return;
    }

    await ctx.answerCbQuery();
  });
};
