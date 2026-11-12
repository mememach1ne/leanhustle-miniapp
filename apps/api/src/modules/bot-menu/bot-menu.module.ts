import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { BotMenuService } from './bot-menu.service';

/** /start menu as a Telegram widget. */
@Module({
  imports: [UsersModule],
  providers: [BotMenuService],
  exports: [BotMenuService],
})
export class BotMenuModule {}
