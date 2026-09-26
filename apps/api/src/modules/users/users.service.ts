import { Inject, Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertTelegramUserDto } from './dto/upsert-telegram-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { mapUserToProfile } from './mappers/user-profile.mapper';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getProfile(query: UserQueryDto) {
    if (!query.telegramId) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        telegramId: query.telegramId,
      },
    });

    return user ? mapUserToProfile(user) : null;
  }

  async getProfileById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return user ? mapUserToProfile(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async upsertTelegramUser(dto: UpsertTelegramUserDto) {
    const safeFirstName = dto.firstName?.trim() || dto.username?.trim() || 'Telegram user';

    try {
      const createdOrUpdatedUser = await this.prisma.user.upsert({
        where: {
          telegramId: dto.telegramId,
        },
        create: {
          telegramId: dto.telegramId,
          username: dto.username,
          firstName: safeFirstName,
          lastName: dto.lastName,
          photoUrl: dto.photoUrl,
          languageCode: dto.languageCode,
        },
        update: {
          ...(dto.username !== undefined ? { username: dto.username } : {}),
          firstName: safeFirstName,
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
          ...(dto.languageCode !== undefined ? { languageCode: dto.languageCode } : {}),
          lastActiveAt: new Date(),
        },
      });

      return mapUserToProfile(createdOrUpdatedUser);
    } catch (error) {
      this.logger.error(
        `Telegram user upsert failed for telegramId=${dto.telegramId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
