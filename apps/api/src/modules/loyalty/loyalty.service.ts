import type { LoyaltyStatusDto, LoyaltyTier } from '@lean-poizon/shared';
import { DEFAULT_LOYALTY_TIERS } from '@lean-poizon/shared';
import { Inject, Injectable } from '@nestjs/common';
import { type BusinessSettings, OrderStatus, Prisma, type User } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

/**
 * Orders that count towards a user's lifetime loyalty spend: everything that
 * has actually been paid for. Unpaid drafts (CREATED / PAYMENT_PENDING) and
 * cancelled orders are excluded so the tier can't be inflated for free.
 */
const LOYALTY_QUALIFYING_STATUSES: OrderStatus[] = [
  OrderStatus.PAID_AWAITING_PURCHASE,
  OrderStatus.PURCHASED,
  OrderStatus.DELIVERY_PAYMENT_PENDING,
  OrderStatus.DELIVERY_PAID,
  OrderStatus.DUTY_PAYMENT_PENDING,
  OrderStatus.DUTY_PAID,
  OrderStatus.TRACK_CODE_RECEIVED,
  OrderStatus.DELIVERED,
];

interface ResolvedLadder {
  currentTier: LoyaltyTier | null;
  nextTier: LoyaltyTier | null;
  amountToNextUsd: number | null;
  discountPercentPoints: number;
}

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class LoyaltyService {
  private readonly prisma: PrismaService;
  private readonly settingsService: SettingsService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(SettingsService) settingsService: SettingsService,
  ) {
    this.prisma = prisma;
    this.settingsService = settingsService;
  }

  /** Cumulative goods spend (USD) over the user's paid, non-cancelled orders. */
  async getSpentUsd(userId: string, client: PrismaClientLike = this.prisma): Promise<number> {
    const aggregate = await client.order.aggregate({
      where: {
        userId,
        status: { in: LOYALTY_QUALIFYING_STATUSES },
      },
      _sum: { totalUsd: true },
    });

    return Number(aggregate._sum.totalUsd ?? 0);
  }

  /**
   * Effective commission discount (percentage points) for a user right now.
   * Returns 0 when the program is off or the user isn't a channel subscriber.
   */
  async getDiscountPercentPoints(
    user: Pick<User, 'id' | 'isChannelSubscriber'>,
    settings?: BusinessSettings,
    client: PrismaClientLike = this.prisma,
  ): Promise<number> {
    const resolvedSettings = settings ?? (await this.settingsService.getCurrentSettings());

    if (!resolvedSettings.loyaltyEnabled || !user.isChannelSubscriber) {
      return 0;
    }

    const spentUsd = await this.getSpentUsd(user.id, client);
    const tiers = this.readTiers(resolvedSettings);

    return this.resolveLadder(spentUsd, tiers).discountPercentPoints;
  }

  /** Full loyalty status for the profile teaser. */
  async getStatus(user: Pick<User, 'id' | 'isChannelSubscriber'>): Promise<LoyaltyStatusDto> {
    const settings = await this.settingsService.getCurrentSettings();
    const tiers = this.readTiers(settings);
    const enabled = settings.loyaltyEnabled;
    const eligible = enabled && user.isChannelSubscriber;

    if (!eligible) {
      return {
        enabled,
        eligible: false,
        spentUsd: 0,
        discountPercentPoints: 0,
        currentTier: null,
        nextTier: tiers[0] ?? null,
        amountToNextUsd: tiers[0]?.thresholdUsd ?? null,
        tiers,
      };
    }

    const spentUsd = await this.getSpentUsd(user.id);
    const ladder = this.resolveLadder(spentUsd, tiers);

    return {
      enabled,
      eligible: true,
      spentUsd,
      discountPercentPoints: ladder.discountPercentPoints,
      currentTier: ladder.currentTier,
      nextTier: ladder.nextTier,
      amountToNextUsd: ladder.amountToNextUsd,
      tiers,
    };
  }

  /** Resolve which tier a given spend falls into (tiers must be threshold-sorted). */
  private resolveLadder(spentUsd: number, tiers: LoyaltyTier[]): ResolvedLadder {
    const sorted = [...tiers].sort((a, b) => a.thresholdUsd - b.thresholdUsd);

    let currentTier: LoyaltyTier | null = null;
    let nextTier: LoyaltyTier | null = null;

    for (const tier of sorted) {
      if (spentUsd >= tier.thresholdUsd) {
        currentTier = tier;
      } else {
        nextTier = tier;
        break;
      }
    }

    const amountToNextUsd = nextTier
      ? Math.max(0, Math.round((nextTier.thresholdUsd - spentUsd) * 100) / 100)
      : null;

    return {
      currentTier,
      nextTier,
      amountToNextUsd,
      discountPercentPoints: currentTier?.discountPercentPoints ?? 0,
    };
  }

  /** Read + normalize the tier ladder stored on business settings. */
  private readTiers(settings: BusinessSettings): LoyaltyTier[] {
    const value = settings.loyaltyTiers;

    if (!Array.isArray(value)) {
      return DEFAULT_LOYALTY_TIERS;
    }

    const tiers: LoyaltyTier[] = [];

    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const key = typeof record.key === 'string' ? record.key : '';
      const name = typeof record.name === 'string' ? record.name : '';
      const thresholdUsd = Number(record.thresholdUsd);
      const discountPercentPoints = Number(record.discountPercentPoints);

      if (!key || !name || !Number.isFinite(thresholdUsd) || !Number.isFinite(discountPercentPoints)) {
        continue;
      }

      tiers.push({ key, name, thresholdUsd, discountPercentPoints });
    }

    if (tiers.length === 0) {
      return DEFAULT_LOYALTY_TIERS;
    }

    return tiers.sort((a, b) => a.thresholdUsd - b.thresholdUsd);
  }
}
