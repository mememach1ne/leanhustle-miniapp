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

    // Staff (admins and managers) skew the metrics — testing the app,
    // checking orders, etc. Pre-load the list of active staff Telegram
    // IDs and exclude them from every count + chart query.
    const staffTelegramIds = await this.getStaffTelegramIds();
    const excludeWhere =
      staffTelegramIds.length > 0
        ? { telegramId: { notIn: staffTelegramIds } }
        : {};

    const [onlineNow, online30m, dau, wau, mau, totalUsers, newToday] = await Promise.all([
      this.prisma.user.count({ where: { ...excludeWhere, lastActiveAt: { gte: since5m } } }),
      this.prisma.user.count({ where: { ...excludeWhere, lastActiveAt: { gte: since30m } } }),
      this.prisma.user.count({ where: { ...excludeWhere, lastActiveAt: { gte: since24h } } }),
      this.prisma.user.count({ where: { ...excludeWhere, lastActiveAt: { gte: since7d } } }),
      this.prisma.user.count({ where: { ...excludeWhere, lastActiveAt: { gte: since30d } } }),
      this.prisma.user.count({ where: excludeWhere }),
      this.prisma.user.count({ where: { ...excludeWhere, createdAt: { gte: since24h } } }),
    ]);

    const [hourly, daily] = await Promise.all([
      this.fetchHourlyActivity(since24h, staffTelegramIds),
      this.fetchDailyActivity(since30d, staffTelegramIds),
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

  private async getStaffTelegramIds(): Promise<string[]> {
    const rows = await this.prisma.staffAccount.findMany({
      where: { isActive: true, telegramId: { not: null } },
      select: { telegramId: true },
    });
    return rows
      .map((r) => r.telegramId)
      .filter((id): id is string => id !== null && id !== undefined);
  }

  /**
   * Returns the active-user count per hour over the last 24h.
   * "Active" = had lastActiveAt fall inside that hour. PostgreSQL
   * date_trunc + generate_series fills empty buckets with zero.
   * Staff users are excluded.
   */
  private async fetchHourlyActivity(
    since: Date,
    excludeTelegramIds: string[],
  ): Promise<AdminAnalyticsActivityPoint[]> {
    // Build an IN-clause friendly literal. Parameterising VARCHAR[]
    // with Prisma raw isn't straightforward, so we build a safe SQL
    // fragment by escaping single quotes in each id (they're numeric
    // anyway but defence-in-depth).
    const excludeClause = this.buildExcludeClause(excludeTelegramIds);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ bucket: Date; count: bigint }>
    >(
      `
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('hour', $1::timestamp),
          date_trunc('hour', NOW()),
          interval '1 hour'
        ) AS bucket
      )
      SELECT buckets.bucket,
             COUNT(DISTINCT users.id) AS count
      FROM buckets
      LEFT JOIN users
        ON date_trunc('hour', users.last_active_at) = buckets.bucket
        ${excludeClause}
      GROUP BY buckets.bucket
      ORDER BY buckets.bucket ASC
      `,
      since,
    );
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      activeUsers: Number(r.count),
    }));
  }

  private async fetchDailyActivity(
    since: Date,
    excludeTelegramIds: string[],
  ): Promise<AdminAnalyticsActivityPoint[]> {
    const excludeClause = this.buildExcludeClause(excludeTelegramIds);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ bucket: Date; count: bigint }>
    >(
      `
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('day', $1::timestamp),
          date_trunc('day', NOW()),
          interval '1 day'
        ) AS bucket
      )
      SELECT buckets.bucket,
             COUNT(DISTINCT users.id) AS count
      FROM buckets
      LEFT JOIN users
        ON date_trunc('day', users.last_active_at) = buckets.bucket
        ${excludeClause}
      GROUP BY buckets.bucket
      ORDER BY buckets.bucket ASC
      `,
      since,
    );
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      activeUsers: Number(r.count),
    }));
  }

  /**
   * Returns an "AND users.telegram_id NOT IN (...)" SQL fragment, or
   * an empty string if no exclusions are needed. The ids are validated
   * to be all-digit strings before inlining.
   */
  private buildExcludeClause(ids: string[]): string {
    if (ids.length === 0) return '';
    const safe = ids.filter((id) => /^\d+$/.test(id));
    if (safe.length === 0) return '';
    return `AND users.telegram_id NOT IN (${safe.map((id) => `'${id}'`).join(', ')})`;
  }
}
