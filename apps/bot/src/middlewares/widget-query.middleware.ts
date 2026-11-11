import type { MiddlewareFn } from 'telegraf';

import { ApiService } from '../services/api.service';
import type { BotContext } from '../types/bot-context';
import { logger } from '../utils/logger';

const apiService = new ApiService();

interface WidgetQueryUpdate {
  widget_query?: {
    id: string;
    from: { id: number };
    data: string;
    chat?: { id: number };
    message_id?: number;
  };
}

/**
 * Queries from the live order card (Telegram chat widget, Bot API 10.4).
 * Telegraf doesn't know this update type yet, so it's read from the raw
 * update and handed to the api, which refreshes the card and answers.
 */
export const widgetQueryMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const query = (ctx.update as WidgetQueryUpdate).widget_query;
  if (!query) {
    await next();
    return;
  }
  try {
    await apiService.widgetQuery({
      id: query.id,
      fromId: String(query.from.id),
      data: query.data,
      chatId: query.chat ? String(query.chat.id) : undefined,
      messageId: query.message_id,
    });
  } catch (error) {
    logger.warn('Widget query forwarding failed', { error: error instanceof Error ? error.message : String(error) });
  }
};
