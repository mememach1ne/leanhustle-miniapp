import type { MiddlewareFn } from 'telegraf';

import { ApiService } from '../services/api.service';
import { sendClientMenu } from '../services/client-menu';
import type { BotContext } from '../types/bot-context';

const apiService = new ApiService();

const isStartCommand = (ctx: BotContext) =>
  ctx.message && 'text' in ctx.message && ctx.message.text.trim().startsWith('/start');

const isClientCallbackQuery = (ctx: BotContext) =>
  Boolean(
    ctx.callbackQuery &&
      'data' in ctx.callbackQuery &&
      ctx.callbackQuery.data.startsWith('client:'),
  );

const PRODUCT_LINK_RE = /(dw4\.co|dewu\.com|poizon\.com|poizonresell\.com)/i;

/**
 * Hands a private message with Poizon links to the api, which builds the
 * multi-link «Расчёт» card. True when the message was taken.
 */
export async function forwardProductLinks(ctx: BotContext): Promise<boolean> {
  const from = ctx.from;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  if (!from || !ctx.chat || ctx.chat.type !== 'private' || !text || !PRODUCT_LINK_RE.test(text)) return false;
  try {
    const { handled } = await apiService.chatLinks({
      telegramId: String(from.id),
      chatId: String(ctx.chat.id),
      text,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
    });
    return handled;
  } catch {
    await ctx.reply('Не получилось посчитать ссылки — попробуйте ещё раз через минуту или откройте калькулятор в приложении.');
    return true;
  }
}

export const accessMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const from = ctx.from;

  if (!from) {
    return;
  }

  try {
    const staff = await apiService.getCurrentStaff({
      telegramId: String(from.id),
      username: from.username,
    });

    if (staff.isActive) {
      ctx.access = {
        role: staff.role === 'ADMIN' ? 'admin' : 'manager',
        staffId: staff.id,
      };
    }
  } catch {
    ctx.access = undefined;
  }

  // Staff bypass everything. Non-staff are allowed only:
  //   - /start command (welcome screen)
  //   - client:* callback queries (welcome screen buttons)
  if (ctx.access || isStartCommand(ctx) || isClientCallbackQuery(ctx)) {
    await next();
    return;
  }

  // Channel join requests, the bot being blocked etc. aren't conversations —
  // the welcome screen only goes to a private chat with a message or a tap.
  if (ctx.chat?.type !== 'private' || !(ctx.message || ctx.callbackQuery)) {
    return;
  }

  // Poizon links from a client → the multi-link «Расчёт» card in the chat.
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  if (text && /(dw4\.co|dewu\.com|poizon\.com|poizonresell\.com)/i.test(text)) {
    try {
      const { handled } = await apiService.chatLinks({
        telegramId: String(from.id),
        chatId: String(ctx.chat.id),
        text,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        languageCode: from.language_code,
      });
      if (handled) return;
    } catch {
      await ctx.reply('Не получилось посчитать ссылки — попробуйте ещё раз через минуту или откройте калькулятор в приложении.');
      return;
    }
  }

  await sendClientMenu(ctx);
};
