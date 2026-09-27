import { timingSafeEqual } from 'crypto';

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Allows only requests from our own bot (shared BOT_INTERNAL_API_TOKEN), no staff check. */
@Injectable()
export class InternalBotTokenGuard implements CanActivate {
  private readonly configService: ConfigService;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = request.headers['x-internal-bot-token'];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    const expected =
      this.configService.get<string>('bot.internalApiToken') ??
      process.env.BOT_INTERNAL_API_TOKEN ??
      '';

    if (!expected || !provided) {
      throw new UnauthorizedException('Invalid internal bot token.');
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal bot token.');
    }
    return true;
  }
}
