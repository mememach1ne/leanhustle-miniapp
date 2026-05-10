import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StaffAccount } from '@prisma/client';

import { StaffService } from '../staff.service';

interface HeaderMap {
  [key: string]: string | string[] | undefined;
}

export interface StaffBotRequest {
  headers: HeaderMap;
  staff?: StaffAccount;
}

@Injectable()
export class StaffBotAuthGuard implements CanActivate {
  private readonly configService: ConfigService;
  private readonly staffService: StaffService;

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(StaffService) staffService: StaffService,
  ) {
    this.configService = configService;
    this.staffService = staffService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffBotRequest>();
    const internalBotToken = this.readHeader(request, 'x-internal-bot-token');
    const telegramId = this.readHeader(request, 'x-telegram-id');
    const username = this.readHeader(request, 'x-telegram-username');
    const expectedBotToken =
      this.configService.get<string>('bot.internalApiToken') ??
      this.configService.get<string>('BOT_INTERNAL_API_TOKEN') ??
      process.env.BOT_INTERNAL_API_TOKEN ??
      '';

    if (!expectedBotToken || internalBotToken !== expectedBotToken) {
      throw new UnauthorizedException('Invalid internal bot token.');
    }

    const staff = await this.staffService.getActiveStaffByTelegramIdentity({
      telegramId,
      username,
    });

    if (!staff) {
      throw new UnauthorizedException('Staff access is required.');
    }

    request.staff = staff;
    return true;
  }

  private readHeader(request: StaffBotRequest, headerName: string): string | undefined {
    const value = request.headers[headerName];

    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value[0];
    }

    return undefined;
  }
}
