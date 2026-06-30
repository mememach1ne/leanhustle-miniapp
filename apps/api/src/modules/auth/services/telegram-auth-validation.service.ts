import type {
  TelegramLoginWidgetPayload,
  TelegramWebAppInitDataUnsafe,
  TelegramWebAppUser,
} from '@lean-poizon/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class TelegramAuthValidationService {
  private readonly logger = new Logger(TelegramAuthValidationService.name);
  private readonly configService: ConfigService;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  validate(initData: string): TelegramWebAppUser {
    const botToken =
      this.configService.get<string>('telegram.botToken') ??
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') ??
      process.env.TELEGRAM_BOT_TOKEN ??
      '';
    const rawMaxAge =
      this.configService.get<number | string>('telegram.authMaxAgeSeconds') ??
      this.configService.get<number | string>('TELEGRAM_AUTH_MAX_AGE_SECONDS') ??
      process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS ??
      300;
    const maxAgeSeconds =
      typeof rawMaxAge === 'number' ? rawMaxAge : Number(rawMaxAge || 300);

    if (!botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is missing for Telegram auth validation');
      throw new UnauthorizedException('Telegram auth is not configured');
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDateRaw = params.get('auth_date');
    const userRaw = params.get('user');
    const paramKeys = Array.from(params.keys()).sort();

    this.logger.debug(
      JSON.stringify({
        initDataExists: Boolean(initData),
        initDataLength: initData.length,
        parsedParamKeys: paramKeys,
        hashExists: Boolean(hash),
        authDateExists: Boolean(authDateRaw),
        userExists: Boolean(userRaw),
      }),
    );

    if (!hash || !authDateRaw || !userRaw) {
      throw new UnauthorizedException('Telegram initData is incomplete');
    }

    const parsedAuthDate = Number(authDateRaw);

    if (Number.isNaN(parsedAuthDate)) {
      throw new UnauthorizedException('Telegram auth_date is invalid');
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (parsedAuthDate > nowInSeconds + 30) {
      throw new UnauthorizedException('Telegram auth_date is invalid');
    }

    if (nowInSeconds - parsedAuthDate > maxAgeSeconds) {
      throw new UnauthorizedException('Telegram auth payload has expired');
    }

    const pairs = Array.from(params.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    const dataCheckString = pairs.join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (!this.safeCompare(calculatedHash, hash)) {
      this.logger.warn('Telegram initData signature validation failed');
      throw new UnauthorizedException('Telegram initData signature is invalid');
    }

    let parsedUser: TelegramWebAppInitDataUnsafe['user'];

    try {
      parsedUser = JSON.parse(userRaw) as TelegramWebAppInitDataUnsafe['user'];
    } catch {
      this.logger.warn('Telegram user payload JSON parse failed');
      throw new BadRequestException('Telegram user payload is invalid');
    }

    if (!parsedUser?.id) {
      this.logger.warn('Telegram user payload does not contain user id');
      throw new UnauthorizedException('Telegram user payload is invalid');
    }

    this.logger.log(`Telegram initData parsed user id=${parsedUser.id}`);

    return parsedUser;
  }

  /**
   * Validate a Telegram Login Widget payload (browser login, not Mini App).
   *
   * The scheme is similar to initData but the secret key derivation differs:
   *   secret = SHA256(botToken)            (raw 32 bytes)
   *   dataCheckString = sorted "key=value" of every field except `hash`
   *   expected = HMAC_SHA256(secret, dataCheckString) hex
   * See https://core.telegram.org/widgets/login#checking-authorization
   */
  validateLoginWidget(payload: TelegramLoginWidgetPayload): TelegramWebAppUser {
    const botToken =
      this.configService.get<string>('telegram.botToken') ??
      process.env.TELEGRAM_BOT_TOKEN ??
      '';
    if (!botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is missing for Login Widget validation');
      throw new UnauthorizedException('Telegram auth is not configured');
    }

    const { hash, ...fields } = payload;
    if (!hash || !payload.id || !payload.auth_date) {
      throw new UnauthorizedException('Telegram login payload is incomplete');
    }

    // Login-widget links rarely live longer than a few minutes, but the JWT
    // governs the real session, so allow a generous 1-day window to absorb
    // clock skew and slow redirects while still preventing stale replays.
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.auth_date > nowInSeconds + 30) {
      throw new UnauthorizedException('Telegram auth_date is invalid');
    }
    if (nowInSeconds - payload.auth_date > 86_400) {
      throw new UnauthorizedException('Telegram login payload has expired');
    }

    const dataCheckString = Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)] as const)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = createHash('sha256').update(botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (!this.safeCompare(calculatedHash, hash)) {
      this.logger.warn('Telegram login widget signature validation failed');
      throw new UnauthorizedException('Telegram login signature is invalid');
    }

    this.logger.log(`Telegram login widget parsed user id=${payload.id}`);

    return {
      id: payload.id,
      first_name: payload.first_name ?? '',
      last_name: payload.last_name,
      username: payload.username,
      photo_url: payload.photo_url,
    } as TelegramWebAppUser;
  }

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
