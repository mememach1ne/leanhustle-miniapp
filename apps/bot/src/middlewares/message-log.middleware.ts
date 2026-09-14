import type { MiddlewareFn } from 'telegraf';

import type { BotContext } from '../types/bot-context';
import { entitiesToHtml } from '../utils/entities-to-html';
import { logger } from '../utils/logger';

/**
 * Logs incoming text messages together with a ready-to-use Telegram-HTML
 * reconstruction. Useful for capturing marketing copy that contains premium
 * (custom) emoji: send the text to the bot, then copy the `html` field from the
 * logs straight into the code (send it with `parse_mode: 'HTML'`).
 *
 * Registered before accessMiddleware so it captures every text message,
 * including from non-staff users.
 */
export const messageLogMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const message = ctx.message;
  if (message && 'text' in message) {
    logger.info('Incoming text message', {
      from: ctx.from?.id,
      username: ctx.from?.username,
      text: message.text,
      html: entitiesToHtml(message.text, message.entities),
    });
  }
  await next();
};
