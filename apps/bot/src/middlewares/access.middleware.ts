import type { MiddlewareFn } from 'telegraf';

import { ApiService } from '../services/api.service';
import { orderAdminService } from '../services/order-admin.service';
import type { BotContext } from '../types/bot-context';

const apiService = new ApiService();

const isStartCommand = (ctx: BotContext) =>
  ctx.message && 'text' in ctx.message && ctx.message.text.trim().startsWith('/start');

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

  if (ctx.access || isStartCommand(ctx)) {
    await next();
    return;
  }

  await ctx.reply(orderAdminService.getClientWelcomeText());
};
