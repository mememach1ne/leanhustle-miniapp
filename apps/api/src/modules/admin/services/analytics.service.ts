import type { AdminAnalyticsResponse, AdminAnalyticsActivityPoint } from '@lean-poizon/shared';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

@Injectable()
export class AnalyticsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getActivity(): Promise<AdminAnalyticsResponse> {
    const now = Date.now();
    const since5m = new Date(now - 5 * MINUTE);
    const since30m = new Date(now - 30 * MINUTE);
    const since24h = new Date(now - DAY);
    const since7d = new Date(now - 7 * DAY);
    const since30d = new Date(now - 30 * DAY);

    const [onlineNow, online30m, dau, wau, mau, totalUsers, newToday] = await Promise.all([
      this.prisma.user.count({ where: { lastActiveAt: { gte: since5m } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since30m } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since24h } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since7d } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since30d } } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since24h } } }),
    ]);

    const [hourly, daily] = await Promise.all([
      this.fetchHourlyActivity(since24h),
      this.fetchDailyActivity(since30d),
    ]);

    return {
      onlineNow,
      online30m,
      dau,
      wau,
      mau,
      totalUsers,
      newToday,
      hourly,
      daily,
    };
  }

  /**
   * Returns the active-user count per hour over the last 24h.
   * "Active" = had lastActiveAt fall inside that hour. PostgreSQL
   * date_trunc + generate_series fills empty buckets with zero.
   */
  private async fetchHourlyActivity(since: Date): Promise<AdminAnalyticsActivityPoint[]> {
    const rows = await this.prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('hour', ${since}::timestamp),
          date_trunc('hour', NOW()),
          interval '1 hour'
        ) AS bucket
      )
      SELECT buckets.bucket,
             COUNT(DISTINCT users.id) AS count
      FROM buckets
      LEFT JOIN users
        ON date_trunc('hour', users.last_active_at) = buckets.bucket
      GROUP BY buckets.bucket
      ORDER BY buckets.bucket ASC
    `;
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      activeUsers: Number(r.count),
    }));
  }

  private async fetchDailyActivity(since: Date): Promise<AdminAnalyticsActivityPoint[]> {
    const rows = await this.prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('day', ${since}::timestamp),
          date_trunc('day', NOW()),
          interval '1 day'
        ) AS bucket
      )
      SELECT buckets.bucket,
             COUNT(DISTINCT users.id) AS count
      FROM buckets
      LEFT JOIN users
        ON date_trunc('day', users.last_active_at) = buckets.bucket
      GROUP BY buckets.bucket
      ORDER BY buckets.bucket ASC
    `;
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      activeUsers: Number(r.count),
    }));
  }
}
