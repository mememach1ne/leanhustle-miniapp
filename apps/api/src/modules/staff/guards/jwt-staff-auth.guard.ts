import type { JwtAccessPayload } from '@lean-poizon/shared';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { StaffService } from '../staff.service';

export interface StaffJwtRequest extends AuthenticatedRequest {
  staff?: import('@prisma/client').StaffAccount;
}

@Injectable()
export class JwtStaffAuthGuard implements CanActivate {
  private readonly jwtService: JwtService;
  private readonly configService: ConfigService;
  private readonly prisma: PrismaService;
  private readonly staffService: StaffService;

  constructor(
    @Inject(JwtService) jwtService: JwtService,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(StaffService) staffService: StaffService,
  ) {
    this.jwtService = jwtService;
    this.configService = configService;
    this.prisma = prisma;
    this.staffService = staffService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffJwtRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Authorization token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret:
          this.configService.get<string>('auth.jwtSecret') ??
          this.configService.get<string>('JWT_SECRET') ??
          process.env.JWT_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify staff access
      const staff = await this.staffService.getActiveStaffByTelegramIdentity({
        telegramId: user.telegramId,
      });

      if (!staff) {
        throw new ForbiddenException('Staff access is required');
      }

      request.user = user;
      request.auth = payload;
      request.staff = staff;

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired authorization token');
    }
  }

  private extractBearerToken(authorizationHeader?: string): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
