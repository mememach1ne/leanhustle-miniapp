import type { AuthPayload, JwtAccessPayload } from '@lean-poizon/shared';
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
import { TelegramAuthValidationService } from './services/telegram-auth-validation.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly usersService: UsersService;
  private readonly jwtService: JwtService;
  private readonly telegramAuthValidationService: TelegramAuthValidationService;
  private readonly staffService: StaffService;

  constructor(
    @Inject(UsersService) usersService: UsersService,
    @Inject(JwtService) jwtService: JwtService,
    @Inject(TelegramAuthValidationService)
    telegramAuthValidationService: TelegramAuthValidationService,
    @Inject(StaffService) staffService: StaffService,
  ) {
    this.usersService = usersService;
    this.jwtService = jwtService;
    this.telegramAuthValidationService = telegramAuthValidationService;
    this.staffService = staffService;
  }

  async authenticateTelegram(dto: TelegramAuthDto): Promise<AuthPayload> {
    try {
      this.logger.log('Telegram auth validation start');
      const telegramUser = this.telegramAuthValidationService.validate(dto.initData);
      this.logger.log(`Telegram auth validation success for user ${telegramUser.id}`);

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
      this.logger.log(`Telegram auth jwt sign start for userId=${user.id}`);
      const accessToken = await this.jwtService.signAsync(payload);
      this.logger.log(`Telegram auth jwt sign success for userId=${user.id}`);

      // Check if user is also a staff member
      const staffRole = await this.resolveStaffRole(user.telegramId);

      return {
        accessToken,
        user: { ...user, staffRole },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn(`Telegram auth failed: ${error.message}`);
        throw error;
      }

      if (error instanceof BadRequestException) {
        this.logger.warn(`Telegram auth bad request: ${error.message}`);
        throw error;
      }

      this.logger.error(
        'Unexpected error during Telegram authentication',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Telegram authentication failed');
    }
  }

  async resolveStaffRole(telegramId: string): Promise<'ADMIN' | 'MANAGER' | null> {
    const staff = await this.staffService.getActiveStaffByTelegramIdentity({ telegramId });
    return staff ? (staff.role as 'ADMIN' | 'MANAGER') : null;
  }
}
