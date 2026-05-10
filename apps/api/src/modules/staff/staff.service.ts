import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { type StaffAccount,StaffRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StaffService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async findByTelegramIdentity(params: {
    telegramId?: string;
    username?: string;
  }): Promise<StaffAccount | null> {
    const username = params.username?.replace(/^@/, '').trim();

    if (params.telegramId) {
      const staffById = await this.prisma.staffAccount.findUnique({
        where: { telegramId: params.telegramId },
      });

      if (staffById) {
        return staffById;
      }
    }

    if (!username) {
      return null;
    }

    return this.prisma.staffAccount.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
    });
  }

  async hasStaffAccess(params: { telegramId?: string; username?: string }): Promise<boolean> {
    const staff = await this.findByTelegramIdentity(params);
    return Boolean(staff?.isActive);
  }

  async getActiveStaffByTelegramIdentity(params: {
    telegramId?: string;
    username?: string;
  }): Promise<StaffAccount | null> {
    const staff = await this.findByTelegramIdentity(params);

    if (!staff?.isActive) {
      return null;
    }

    return staff;
  }

  isAdmin(staff?: StaffAccount | null) {
    return staff?.role === StaffRole.ADMIN;
  }

  assertAdmin(staff?: StaffAccount | null) {
    if (!this.isAdmin(staff)) {
      throw new ForbiddenException('Только admin может выполнять это действие.');
    }
  }
}
