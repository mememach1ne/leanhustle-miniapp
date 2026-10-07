import type { ReferralPayoutAdminDto, ReferralSummaryDto } from '@lean-poizon/shared';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { OrderNotificationsService } from '../orders/services/order-notifications.service';
import { SettingsService } from '../settings/settings.service';

const BOT_USERNAME = 'lh_poizonbot';
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const round2 = (n: number) => Math.round(n * 100) / 100;

const newCode = () =>
  Array.from(randomBytes(8))
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join('');

/**
 * Referral program (part of «Лояльность»): every user has a link
 * t.me/lh_poizonbot?start=ref_<code>; a NEW user who comes through it is
 * tied to the referrer forever, and the referrer gets `referralPercent` % of
 * our commission on each of their orders (LedgerService). Payouts go through
 * a manager for now: the client requests, a manager pays and marks it.
 */
@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  /**
   * Bot: someone opened a ref link. Only a user we've never seen is tied to
   * the referrer (no stealing existing clients, no self-invites).
   */
  async attach(input: {
    code: string;
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  }): Promise<{ attached: boolean }> {
    const referrer = await this.prisma.user.findUnique({ where: { referralCode: input.code.toLowerCase() } });
    if (!referrer || referrer.telegramId === input.telegramId) return { attached: false };
    const existing = await this.prisma.user.findUnique({ where: { telegramId: input.telegramId } });
    if (existing) return { attached: false };
    try {
      await this.prisma.user.create({
        data: {
          telegramId: input.telegramId,
          username: input.username ?? null,
          firstName: input.firstName?.trim() || 'Пользователь',
          lastName: input.lastName ?? null,
          languageCode: input.languageCode ?? null,
          referredById: referrer.id,
          referredAt: new Date(),
        },
      });
    } catch (error) {
      // Created in parallel (e.g. opened the Mini App at the same moment) — not new any more.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { attached: false };
      throw error;
    }
    this.logger.log(`User ${input.telegramId} invited by ${referrer.telegramId}`);
    return { attached: true };
  }

  async getSummary(userId: string): Promise<ReferralSummaryDto> {
    const code = await this.ensureCode(userId);
    const settings = await this.settings.getCurrentSettings();
    const [invitedCount, buyers, rewards, openPayout] = await Promise.all([
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.user.count({ where: { referredById: userId, orders: { some: { paidAt: { not: null } } } } }),
      this.prisma.referralReward.findMany({
        where: { referrerId: userId },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.referralPayout.findFirst({ where: { userId, status: 'REQUESTED' }, orderBy: { createdAt: 'desc' } }),
    ]);
    const sum = (filter: (r: (typeof rewards)[number]) => boolean) =>
      round2(rewards.filter(filter).reduce((acc, r) => acc + Number(r.amountUsd), 0));

    return {
      link: `https://t.me/${BOT_USERNAME}?start=ref_${code}`,
      percent: Number(settings.referralPercent),
      minPayoutUsd: Number(settings.referralMinPayoutUsd),
      invitedCount,
      buyersCount: buyers,
      pendingUsd: sum((r) => r.status === 'PENDING'),
      availableUsd: sum((r) => r.status === 'AVAILABLE' && !r.payoutId),
      paidUsd: sum((r) => r.status === 'PAID'),
      openPayout: openPayout
        ? { amountUsd: Number(openPayout.amountUsd), createdAt: openPayout.createdAt.toISOString() }
        : null,
      recent: rewards.slice(0, 10).map((r) => ({
        orderNumber: r.order.orderNumber,
        amountUsd: Number(r.amountUsd),
        status: r.status as ReferralSummaryDto['recent'][number]['status'],
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** Client asks for a payout of everything available (≥ the minimum). Managers get a message. */
  async requestPayout(userId: string): Promise<ReferralSummaryDto> {
    const settings = await this.settings.getCurrentSettings();
    const min = Number(settings.referralMinPayoutUsd);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const payout = await this.prisma.$transaction(async (tx) => {
      const open = await tx.referralPayout.findFirst({ where: { userId, status: 'REQUESTED' } });
      if (open) throw new BadRequestException('Заявка на вывод уже отправлена — менеджер скоро свяжется с вами.');
      const available = await tx.referralReward.findMany({ where: { referrerId: userId, status: 'AVAILABLE', payoutId: null } });
      const amount = round2(available.reduce((acc, r) => acc + Number(r.amountUsd), 0));
      if (amount < min) throw new BadRequestException(`Вывод доступен от $${min}. Сейчас доступно $${amount}.`);
      const created = await tx.referralPayout.create({ data: { userId, amountUsd: new Prisma.Decimal(amount) } });
      await tx.referralReward.updateMany({
        where: { id: { in: available.map((r) => r.id) } },
        data: { payoutId: created.id },
      });
      return created;
    });

    const who = user.username ? `@${user.username}` : `${user.firstName} (id ${user.telegramId})`;
    await this.notifications
      .notifyManagers(
        `Реферальная программа: ${who} запросил вывод $${Number(payout.amountUsd).toFixed(2)}.\nСвяжитесь с клиентом, выплатите и отметьте «Выплачено» в админке → Прибыль.`,
      )
      .catch(() => undefined);
    return this.getSummary(userId);
  }

  async listOpenPayouts(): Promise<ReferralPayoutAdminDto[]> {
    const payouts = await this.prisma.referralPayout.findMany({
      where: { status: 'REQUESTED' },
      include: { user: { select: { id: true, telegramId: true, username: true, firstName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return payouts.map((p) => ({
      id: p.id,
      user: p.user,
      amountUsd: Number(p.amountUsd),
      status: p.status as ReferralPayoutAdminDto['status'],
      createdAt: p.createdAt.toISOString(),
      processedAt: p.processedAt?.toISOString() ?? null,
    }));
  }

  /** Staff: paid by hand → rewards PAID; rejected → they're available again. */
  async processPayout(id: string, result: 'PAID' | 'REJECTED', staff: StaffAccount): Promise<void> {
    const payout = await this.prisma.referralPayout.findUnique({ where: { id }, include: { user: true } });
    if (!payout) throw new NotFoundException('Заявка не найдена.');
    if (payout.status !== 'REQUESTED') throw new BadRequestException('Заявка уже обработана.');
    await this.prisma.$transaction([
      this.prisma.referralPayout.update({
        where: { id },
        data: { status: result, processedAt: new Date(), processedByStaffId: staff.id },
      }),
      result === 'PAID'
        ? this.prisma.referralReward.updateMany({ where: { payoutId: id }, data: { status: 'PAID' } })
        : this.prisma.referralReward.updateMany({ where: { payoutId: id }, data: { payoutId: null } }),
    ]);
  }

  private async ensureCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
    if (user.referralCode) return user.referralCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      try {
        await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
        return code;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
    }
    throw new Error('Could not generate a referral code');
  }
}
