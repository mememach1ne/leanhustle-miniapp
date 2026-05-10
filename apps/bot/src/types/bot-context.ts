import type { Context } from 'telegraf';

import type { UserRole } from '@lean-poizon/shared';

export interface AccessMeta {
  role: Extract<UserRole, 'manager' | 'admin'>;
  staffId: string;
}

export interface BotContext extends Context {
  access?: AccessMeta;
}
