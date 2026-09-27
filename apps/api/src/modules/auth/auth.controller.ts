import type { UserProfile } from '@lean-poizon/shared';
import { Body, Controller, Get, Inject, Logger, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';

import { mapUserToProfile } from '../users/mappers/user-profile.mapper';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ConfirmBotLoginDto, StartBotLoginDto } from './dto/bot-login.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { InternalBotTokenGuard } from './guards/internal-bot-token.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { BotLoginService } from './services/bot-login.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly authService: AuthService;
  private readonly botLoginService: BotLoginService;

  constructor(
    @Inject(AuthService) authService: AuthService,
    @Inject(BotLoginService) botLoginService: BotLoginService,
  ) {
    this.authService = authService;
    this.botLoginService = botLoginService;
  }

  /** Website: get a one-time code + bot deep link to log in through the bot. */
  @Post('bot-login/start')
  @Throttle({ short: { ttl: 60000, limit: 20 } })
  startBotLogin(@Body() dto: StartBotLoginDto) {
    return this.botLoginService.start(dto.origin);
  }

  /** Website: poll until the bot confirms; then returns the JWT + user. */
  @Get('bot-login/status/:token')
  @Throttle({ short: { ttl: 60000, limit: 60 } })
  getBotLoginStatus(@Param('token') token: string) {
    return this.botLoginService.status(token);
  }

  /** Bot only (internal token): confirm the code for the Telegram user it's talking to. */
  @Post('bot-login/confirm')
  @UseGuards(InternalBotTokenGuard)
  async confirmBotLogin(@Body() dto: ConfirmBotLoginDto) {
    return this.authService.confirmBotLogin(dto);
  }

  @Post('telegram')
  @Throttle({ short: { ttl: 60000, limit: 20 } })
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
