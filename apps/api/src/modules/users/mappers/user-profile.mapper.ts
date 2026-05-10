import type { UserProfile } from '@lean-poizon/shared';
import type { User } from '@prisma/client';

export const mapUserToProfile = (
  user: User,
  staffRole?: 'ADMIN' | 'MANAGER' | null,
): UserProfile => {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    languageCode: user.languageCode,
    isChannelSubscriber: user.isChannelSubscriber,
    hasUsedSubscriberBenefit: user.hasUsedSubscriberBenefit,
    lastActiveAt: user.lastActiveAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
    staffRole: staffRole ?? null,
  };
};
