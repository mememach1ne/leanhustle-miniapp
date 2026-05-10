import type { Telegraf } from 'telegraf';

import { orderAdminService } from '../services/order-admin.service';
import type { BotContext } from '../types/bot-context';

export const registerStartCommand = (bot: Telegraf<BotContext>) => {
  bot.start(async (ctx) => {
    if (!ctx.access) {
      await ctx.reply(orderAdminService.getClientWelcomeText());
      return;
    }

    const roleLabel = ctx.access.role === 'admin' ? 'Администратор' : 'Менеджер';
    await ctx.reply(orderAdminService.getWelcomeText(roleLabel), {
      reply_markup: orderAdminService.buildAdminPanelKeyboard(ctx.access.role),
    });
  });
};
