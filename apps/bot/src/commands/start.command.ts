import type { Telegraf } from 'telegraf';

import { orderAdminService } from '../services/order-admin.service';
import type { BotContext } from '../types/bot-context';

export const registerStartCommand = (bot: Telegraf<BotContext>) => {
  bot.start(async (ctx) => {
    if (!ctx.access) {
      await ctx.reply(orderAdminService.getClientWelcomeText(), {
        parse_mode: 'HTML',
        reply_markup: orderAdminService.buildClientWelcomeKeyboard(),
      });
      return;
    }

    const roleLabel = ctx.access.role === 'admin' ? 'Администратор' : 'Менеджер';
    await ctx.reply(orderAdminService.getWelcomeText(roleLabel), {
      reply_markup: orderAdminService.buildAdminPanelKeyboard(ctx.access.role),
    });
  });

  bot.action(/^client:.+$/, async (ctx) => {
    const data = ctx.match.input;

    if (orderAdminService.isClientDownloadAppCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.reply(orderAdminService.getDownloadAppText(), {
        reply_markup: orderAdminService.buildDownloadAppKeyboard(),
      });
      return;
    }

    if (orderAdminService.isClientOtherMarketplacesCallback(data)) {
      await ctx.answerCbQuery();
      await ctx.reply(orderAdminService.getOtherMarketplacesText(), {
        reply_markup: orderAdminService.buildOtherMarketplacesKeyboard(),
      });
      return;
    }

    await ctx.answerCbQuery();
  });
};
