import { Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RefreshChannelSubscriptionDto } from './dto/refresh-channel-subscription.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  private readonly usersService: UsersService;

  constructor(@Inject(UsersService) usersService: UsersService) {
    this.usersService = usersService;
  }

  @Get('me')
  async getProfile(@CurrentUser() user: User) {
    return this.usersService.getProfileById(user.id);
  }

  @Post('me/channel-subscription/refresh')
  async refreshChannelSubscription(
    @CurrentUser() user: User,
  ): Promise<RefreshChannelSubscriptionDto> {
    return this.usersService.refreshCurrentUserChannelSubscription(user.id);
  }
}
