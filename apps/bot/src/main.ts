import { Telegraf } from 'telegraf';

import { registerOrderActions } from './actions/order.actions';
import { registerAdminPanelCommands } from './commands/admin-panel.command';
import { registerOrderManagementCommands } from './commands/order-management.command';
import { registerSettingsCommands } from './commands/settings.command';
import { registerStartCommand } from './commands/start.command';
import { accessMiddleware, forwardProductLinks } from './middlewares/access.middleware';
import { messageLogMiddleware } from './middlewares/message-log.middleware';
import { widgetQueryMiddleware } from './middlewares/widget-query.middleware';
import type { BotContext } from './types/bot-context';
import { botEnv } from './utils/env';
import { logger } from './utils/logger';

async function bootstrap() {
  if (!botEnv.token) {
    logger.warn('TELEGRAM_BOT_TOKEN is not set. Bot bootstrap skipped.');
    return;
  }

  const bot = new Telegraf<BotContext>(botEnv.token);

  // Before the access check: card queries aren't conversations.
  bot.use(widgetQueryMiddleware);
  bot.use(messageLogMiddleware);
  bot.use(accessMiddleware);

  registerStartCommand(bot);
  registerAdminPanelCommands(bot);
  registerOrderManagementCommands(bot);
  registerSettingsCommands(bot);
  registerOrderActions(bot);
  // Last in the chain: staff links that no admin flow took → the «Расчёт» card too.
  bot.on('text', async (ctx) => {
    await forwardProductLinks(ctx);
  });

  bot.catch((error, ctx) => {
    logger.error('Unhandled bot error', {
      error: error instanceof Error ? error.message : String(error),
      updateType: ctx.updateType,
    });
  });

  // Explicit list: without it Telegram keeps the previously set one, which
  // predates widget_query (live order card, Bot API 10.4).
  await bot.launch({
    allowedUpdates: [
      'message',
      'edited_message',
      'callback_query',
      'my_chat_member',
      'widget_query',
    ] as never,
  });
  logger.info('LEAN HUSTLE POIZON bot started');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

void bootstrap();
