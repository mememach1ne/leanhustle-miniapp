import { Module } from '@nestjs/common';

import { ChannelSubscriptionService } from './channel-subscription.service';
import { TelegramChannelMembershipService } from './telegram-channel-membership.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ChannelSubscriptionService, TelegramChannelMembershipService],
  exports: [UsersService, ChannelSubscriptionService, TelegramChannelMembershipService],
})
export class UsersModule {}
