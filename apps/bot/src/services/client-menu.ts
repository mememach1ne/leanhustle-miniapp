import type { BotContext } from '../types/bot-context';
import { ApiService } from './api.service';
import { clientMessagesService } from './client-messages.service';
import { orderAdminService } from './order-admin.service';

const apiService = new ApiService();

/**
 * The client's main menu: a widget (api sends it, deleting the previous
 * one); if widgets aren't available — the old text menu with buttons.
 */
export async function sendClientMenu(ctx: BotContext): Promise<void> {
  if (ctx.from && ctx.chat?.type === 'private') {
    try {
      const { sent } = await apiService.sendMenu({
        telegramId: String(ctx.from.id),
        chatId: String(ctx.chat.id),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        languageCode: ctx.from.language_code,
      });
      if (sent) return;
    } catch {
      // fall back to the text menu
    }
  }
  const message = await ctx.reply(orderAdminService.getClientWelcomeText(), {
    parse_mode: 'HTML',
    reply_markup: orderAdminService.buildClientWelcomeKeyboard(),
  });
  if (ctx.chat) clientMessagesService.track(ctx.chat.id, message.message_id);
}
