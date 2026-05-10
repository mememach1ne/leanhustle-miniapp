import type { ChannelSubscriptionRefreshResponse } from '@lean-poizon/shared';
import { SubscriptionVerificationStatus } from '@lean-poizon/shared';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertTelegramUserDto } from './dto/upsert-telegram-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { mapUserToProfile } from './mappers/user-profile.mapper';
import { TelegramChannelMembershipService } from './telegram-channel-membership.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly prisma: PrismaService;
  private readonly telegramChannelMembershipService: TelegramChannelMembershipService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(TelegramChannelMembershipService)
    telegramChannelMembershipService: TelegramChannelMembershipService,
  ) {
    this.prisma = prisma;
    this.telegramChannelMembershipService = telegramChannelMembershipService;
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

  async refreshCurrentUserChannelSubscription(
    userId: string,
  ): Promise<ChannelSubscriptionRefreshResponse> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const membershipCheck = await this.telegramChannelMembershipService.checkMembership(
      user.telegramId,
    );

    const updatedUser =
      membershipCheck.verificationStatus === SubscriptionVerificationStatus.VERIFIED
        ? await this.prisma.user.update({
            where: { id: user.id },
            data: {
              isChannelSubscriber: membershipCheck.isChannelSubscriber,
              lastActiveAt: new Date(),
            },
          })
        : await this.prisma.user.update({
            where: { id: user.id },
            data: {
              lastActiveAt: new Date(),
            },
          });

    return {
      user: mapUserToProfile(updatedUser),
      verificationStatus: membershipCheck.verificationStatus,
      ...(membershipCheck.message ? { message: membershipCheck.message } : {}),
    };
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
          isChannelSubscriber: dto.isChannelSubscriber ?? false,
        },
        update: {
          ...(dto.username !== undefined ? { username: dto.username } : {}),
          firstName: safeFirstName,
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
          ...(dto.languageCode !== undefined ? { languageCode: dto.languageCode } : {}),
          ...(dto.isChannelSubscriber !== undefined
            ? { isChannelSubscriber: dto.isChannelSubscriber }
            : {}),
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
