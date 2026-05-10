import type { UserProfile } from '@lean-poizon/shared';
import { Body, Controller, Get, Inject, Logger, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';

import { mapUserToProfile } from '../users/mappers/user-profile.mapper';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly authService: AuthService;

  constructor(@Inject(AuthService) authService: AuthService) {
    this.authService = authService;
  }

  @Post('telegram')
  async authenticateTelegram(@Body() dto: TelegramAuthDto) {
    this.logger.log('POST /auth/telegram request received');
    return this.authService.authenticateTelegram(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentProfile(@CurrentUser() user: User): Promise<UserProfile> {
    const staffRole = await this.authService.resolveStaffRole(user.telegramId);
    return mapUserToProfile(user, staffRole);
  }
}
