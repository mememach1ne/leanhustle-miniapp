import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const round2 = (n: number) => Math.round(n * 100) / 100;
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Our net commission on an order, USD — same formula as the profit report:
 * the commission part of the original total minus the subscriber discount.
 */
export function orderCommissionUsd(order: {
  originalTotalUsd: Prisma.Decimal;
  pricingCommissionPercent: Prisma.Decimal;
  benefitDiscountUsd: Prisma.Decimal;
}): number {
  const original = Number(order.originalTotalUsd);
  const pct = Number(order.pricingCommissionPercent);
  const gross = pct > 0 ? original * (pct / (100 + pct)) : 0;
  return round2(Math.max(0, gross - Number(order.benefitDiscountUsd)));
}

/**
 * Splits every paid order's commission, independent of how it was paid:
 *  - the referrer (if the client was invited) gets `referralPercent` % of it,
 *    available once the order is delivered;
 *  - each partner gets their share of what's left.
 * A cancelled order is reversed. Runs every 5 minutes; orders paid before the
 * ledger existed were marked accounted by the migration.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  @Cron('0 */5 * * * *')
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.accrue();
      await this.reverse();
      await this.release();
    } catch (error) {
      this.logger.warn(`Ledger run failed: ${errorText(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async accrue(): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: { paidAt: { not: null }, profitAccountedAt: null, status: { not: OrderStatus.CANCELLED } },
      include: { user: { select: { id: true, referredById: true } } },
      take: 200,
    });
    if (orders.length === 0) return;

    const settings = await this.settings.getCurrentSettings();
    const referralPercent = Number(settings.referralPercent);
    const partners = await this.prisma.staffAccount.findMany({
      where: { isActive: true, profitSharePercent: { not: null } },
      select: { id: true, profitSharePercent: true },
    });
    // No partners yet → wait (orders stay unaccounted and are split once shares are set).
    if (partners.length === 0) return;

    for (const order of orders) {
      try {
        const commission = orderCommissionUsd(order);
        const referrerId = order.user?.referredById ?? null;
        const referral = referrerId && referralPercent > 0 ? round2((commission * referralPercent) / 100) : 0;
        const net = Math.max(0, round2(commission - referral));

        await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.order.updateMany({
            where: { id: order.id, profitAccountedAt: null },
            data: { profitAccountedAt: new Date() },
          });
          if (claimed.count === 0) return;

          if (referrerId && referral > 0) {
            const delivered = order.status === OrderStatus.DELIVERED;
            await tx.referralReward.create({
              data: {
                referrerId,
                referredId: order.user!.id,
                orderId: order.id,
                commissionUsd: new Prisma.Decimal(commission),
                percent: new Prisma.Decimal(referralPercent),
                amountUsd: new Prisma.Decimal(referral),
                status: delivered ? 'AVAILABLE' : 'PENDING',
                availableAt: delivered ? new Date() : null,
              },
            });
          }
          for (const partner of partners) {
            const share = Number(partner.profitSharePercent);
            const amount = round2((net * share) / 100);
            if (amount === 0) continue;
            await tx.profitEntry.create({
              data: {
                staffId: partner.id,
                orderId: order.id,
                kind: 'ORDER',
                amountUsd: new Prisma.Decimal(amount),
                commissionUsd: new Prisma.Decimal(commission),
                referralUsd: new Prisma.Decimal(referral),
                sharePercent: new Prisma.Decimal(share),
              },
            });
          }
        });
      } catch (error) {
        this.logger.warn(`Ledger accrual for ${order.orderNumber}: ${errorText(error)}`);
      }
    }
  }

  /** Cancelled after being accounted → take the partner shares and the referral bonus back. */
  private async reverse(): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.CANCELLED, profitAccountedAt: { not: null }, profitReversedAt: null },
      include: { profitEntries: { where: { kind: 'ORDER' } }, referralReward: true },
      take: 200,
    });
    for (const order of orders) {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, profitReversedAt: null },
          data: { profitReversedAt: new Date() },
        });
        if (claimed.count === 0) return;
        for (const entry of order.profitEntries) {
          await tx.profitEntry.create({
            data: {
              staffId: entry.staffId,
              orderId: order.id,
              kind: 'REVERSAL',
              amountUsd: entry.amountUsd.negated(),
              note: `Заказ ${order.orderNumber} отменён`,
            },
          });
        }
        if (order.referralReward && order.referralReward.status !== 'PAID') {
          await tx.referralReward.update({ where: { id: order.referralReward.id }, data: { status: 'CANCELLED' } });
        }
      });
    }
  }

  /** Referral bonus becomes withdrawable once the order is delivered. */
  private async release(): Promise<void> {
    await this.prisma.referralReward.updateMany({
      where: { status: 'PENDING', order: { status: OrderStatus.DELIVERED } },
      data: { status: 'AVAILABLE', availableAt: new Date() },
    });
  }
}
