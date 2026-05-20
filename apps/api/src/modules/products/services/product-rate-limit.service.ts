import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

const DAILY_LIMIT = 30;
const PER_MINUTE_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

@Injectable()
export class ProductRateLimitService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  /**
   * Throws 429 if the user has burned their daily / per-minute API quota.
   * Staff (admin/manager) bypass entirely. We count only events recorded
   * for cache MISSES (each row represents one real upstream API hit).
   */
  async assertAllowed(userId: string, telegramId: string): Promise<void> {
    const isStaff = await this.isStaff(telegramId);
    if (isStaff) return;

    const now = Date.now();
    const oneMinuteAgo = new Date(now - MINUTE_MS);
    const oneDayAgo = new Date(now - DAY_MS);

    const [minuteCount, dayCount] = await Promise.all([
      this.prisma.productResolveEvent.count({
        where: { userId, createdAt: { gte: oneMinuteAgo } },
      }),
      this.prisma.productResolveEvent.count({
        where: { userId, createdAt: { gte: oneDayAgo } },
      }),
    ]);

    if (minuteCount >= PER_MINUTE_LIMIT) {
      throw new HttpException(
        'Слишком много запросов подряд. Подожди минуту и попробуй снова.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (dayCount >= DAILY_LIMIT) {
      throw new HttpException(
        `Достигнут дневной лимит запросов (${DAILY_LIMIT}/день). Попробуй завтра или напиши менеджеру.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Record a successful external API call (cache miss). */
  async recordApiHit(userId: string, dwSpuId: string): Promise<void> {
    await this.prisma.productResolveEvent.create({
      data: { userId, dwSpuId },
    });
  }

  private async isStaff(telegramId: string): Promise<boolean> {
    const staff = await this.prisma.staffAccount.findFirst({
      where: { telegramId, isActive: true },
      select: { id: true },
    });
    return Boolean(staff);
  }
}
