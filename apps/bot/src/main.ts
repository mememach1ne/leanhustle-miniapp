import { Telegraf } from 'telegraf';

import { registerOrderActions } from './actions/order.actions';
import { registerAdminPanelCommands } from './commands/admin-panel.command';
import { registerOrderManagementCommands } from './commands/order-management.command';
import { registerSettingsCommands } from './commands/settings.command';
import { registerStartCommand } from './commands/start.command';
import { accessMiddleware } from './middlewares/access.middleware';
import type { BotContext } from './types/bot-context';
import { botEnv } from './utils/env';
import { logger } from './utils/logger';

async function bootstrap() {
  if (!botEnv.token) {
    logger.warn('TELEGRAM_BOT_TOKEN is not set. Bot bootstrap skipped.');
    return;
  }

  const bot = new Telegraf<BotContext>(botEnv.token);

  bot.use(accessMiddleware);

  registerStartCommand(bot);
  registerAdminPanelCommands(bot);
  registerOrderManagementCommands(bot);
  registerSettingsCommands(bot);
  registerOrderActions(bot);

  bot.catch((error, ctx) => {
    logger.error('Unhandled bot error', {
      error: error instanceof Error ? error.message : String(error),
      updateType: ctx.updateType,
    });
  });

  await bot.launch();
  logger.info('LEAN HUSTLE POIZON bot started');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

void bootstrap();
