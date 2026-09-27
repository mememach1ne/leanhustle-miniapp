import type {
  AuthPayload,
  JwtAccessPayload,
  TelegramWebAppUser,
} from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { StaffService } from '../staff/staff.service';
import { UsersService } from '../users/users.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { ConfirmBotLoginDto } from './dto/bot-login.dto';
import { BotLoginService } from './services/bot-login.service';
import { TelegramAuthValidationService } from './services/telegram-auth-validation.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly usersService: UsersService;
  private readonly jwtService: JwtService;
  private readonly telegramAuthValidationService: TelegramAuthValidationService;
  private readonly staffService: StaffService;
  private readonly botLoginService: BotLoginService;

  constructor(
    @Inject(UsersService) usersService: UsersService,
    @Inject(JwtService) jwtService: JwtService,
    @Inject(TelegramAuthValidationService)
    telegramAuthValidationService: TelegramAuthValidationService,
    @Inject(StaffService) staffService: StaffService,
    @Inject(BotLoginService) botLoginService: BotLoginService,
  ) {
    this.usersService = usersService;
    this.jwtService = jwtService;
    this.telegramAuthValidationService = telegramAuthValidationService;
    this.staffService = staffService;
    this.botLoginService = botLoginService;
  }

  /**
   * Website login via the bot: the bot vouches for the Telegram user (it's
   * the one talking to them), so no hash check is needed — the request is
   * authenticated by the internal bot token instead.
   */
  async confirmBotLogin(dto: ConfirmBotLoginDto): Promise<{ returnUrl: string }> {
    this.botLoginService.assertPending(dto.token);
    try {
      const auth = await this.issueAuthForTelegramUser({
        id: Number(dto.telegramId),
        username: dto.username,
        first_name: dto.firstName ?? dto.username ?? 'Telegram user',
        last_name: dto.lastName,
        language_code: dto.languageCode,
      });
      this.logger.log(`Bot login confirmed for telegramId=${dto.telegramId}`);
      return this.botLoginService.confirm(dto.token, auth);
    } catch (error) {
      throw this.normalizeAuthError(error);
    }
  }

  async authenticateTelegram(dto: TelegramAuthDto): Promise<AuthPayload> {
    try {
      this.logger.log('Telegram auth validation start');
      const telegramUser = this.telegramAuthValidationService.validate(dto.initData);
      this.logger.log(`Telegram auth validation success for user ${telegramUser.id}`);
      return await this.issueAuthForTelegramUser(telegramUser);
    } catch (error) {
      throw this.normalizeAuthError(error);
    }
  }

  private async issueAuthForTelegramUser(
    telegramUser: TelegramWebAppUser,
  ): Promise<AuthPayload> {
    this.logger.log(`Telegram auth upsert user start for telegramId=${telegramUser.id}`);
    const user = await this.usersService.upsertTelegramUser({
      telegramId: String(telegramUser.id),
      username: telegramUser.username,
      firstName: telegramUser.first_name || telegramUser.username || 'Telegram user',
      lastName: telegramUser.last_name,
      photoUrl: telegramUser.photo_url,
      languageCode: telegramUser.language_code,
    });
    this.logger.log(`Telegram auth upsert user success for userId=${user.id}`);

    const payload: JwtAccessPayload = {
      sub: user.id,
      telegramId: user.telegramId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const staffRole = await this.resolveStaffRole(user.telegramId);

    return {
      accessToken,
      user: { ...user, staffRole },
    };
  }

  private normalizeAuthError(error: unknown): Error {
    if (error instanceof UnauthorizedException) {
      this.logger.warn(`Telegram auth failed: ${error.message}`);
      return error;
    }
    if (error instanceof BadRequestException) {
      this.logger.warn(`Telegram auth bad request: ${error.message}`);
      return error;
    }
    this.logger.error(
      'Unexpected error during Telegram authentication',
      error instanceof Error ? error.stack : String(error),
    );
    return new InternalServerErrorException('Telegram authentication failed');
  }

  async resolveStaffRole(telegramId: string): Promise<'ADMIN' | 'MANAGER' | null> {
    const staff = await this.staffService.getActiveStaffByTelegramIdentity({ telegramId });
    return staff ? (staff.role as 'ADMIN' | 'MANAGER') : null;
  }
}
