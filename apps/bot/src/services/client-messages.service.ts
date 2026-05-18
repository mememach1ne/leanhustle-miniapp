import type { Telegraf } from 'telegraf';

import type { BotContext } from '../types/bot-context';

/**
 * In-memory tracker for bot messages sent to each non-staff client.
 * Used to clean up the chat (e.g. delete previous welcome/menu on /start).
 *
 * State is lost on bot restart, which is acceptable: the worst case is
 * a few stale messages left in the chat until the next clear event.
 */
class ClientMessagesService {
  private readonly messagesByChat = new Map<number, Set<number>>();

  /** Track a message id so it can be deleted later via clearChat. */
  track(chatId: number, messageId: number): void {
    let set = this.messagesByChat.get(chatId);
    if (!set) {
      set = new Set();
      this.messagesByChat.set(chatId, set);
    }
    set.add(messageId);
  }

  /** Delete every tracked bot message in this chat. Silent on errors. */
  async clearChat(bot: Telegraf<BotContext>, chatId: number): Promise<void> {
    const set = this.messagesByChat.get(chatId);
    if (!set || set.size === 0) return;

    const ids = [...set];
    this.messagesByChat.delete(chatId);

    await Promise.all(
      ids.map((id) =>
        bot.telegram.deleteMessage(chatId, id).catch(() => {
          // Message already gone, older than 48h, or no rights — ignore.
        }),
      ),
    );
  }

  /** Delete a single tracked message (e.g. an old "not subscribed" notice). */
  async deleteMessage(
    bot: Telegraf<BotContext>,
    chatId: number,
    messageId: number,
  ): Promise<void> {
    const set = this.messagesByChat.get(chatId);
    set?.delete(messageId);

    await bot.telegram.deleteMessage(chatId, messageId).catch(() => {
      // ignore
    });
  }
}

export const clientMessagesService = new ClientMessagesService();
