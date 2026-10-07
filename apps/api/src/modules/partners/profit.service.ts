import type { PartnerDashboardDto, PartnerDto } from '@lean-poizon/shared';
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, type StaffAccount, StaffRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { OrderNotificationsService } from '../orders/services/order-notifications.service';
import { BybitWithdrawClient } from './bybit-withdraw.client';
import { ReferralService } from './referral.service';

/** USDT networks a partner can withdraw to (Bybit chain codes). */
export const PAYOUT_CHAINS = ['TRX', 'TON', 'BSC', 'ETH', 'SOL', 'ARBI'];
const MIN_WITHDRAW_USD = 10;
/** After the payout address changes, withdrawals wait this long (stolen-session protection). */
const ADDRESS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const who = (s: { username: string | null; firstName: string | null }) =>
  s.username ? `@${s.username}` : s.firstName ?? 'партнёр';

/**
 * Partners' profit: each partner (staff with a share %) gets their share of
 * every paid order's commission minus the referral bonus (LedgerService
 * writes the entries). Balances are withdrawn in USDT through Bybit — by a
 * button, and automatically on the 1st of each month to a saved address.
 */
@Injectable()
export class ProfitService {
  private readonly logger = new Logger(ProfitService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BybitWithdrawClient) private readonly bybit: BybitWithdrawClient,
    @Inject(ReferralService) private readonly referrals: ReferralService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  private assertPartner(staff: StaffAccount): void {
    if (staff.role !== StaffRole.ADMIN || (!staff.isOwner && staff.profitSharePercent === null)) {
      throw new ForbiddenException('Раздел «Прибыль» доступен только партнёрам.');
    }
  }

  private async balance(staffId: string): Promise<number> {
    const agg = await this.prisma.profitEntry.aggregate({ where: { staffId }, _sum: { amountUsd: true } });
    return round2(Number(agg._sum.amountUsd ?? 0));
  }

  async dashboard(staffInput: StaffAccount): Promise<PartnerDashboardDto> {
    const staff = await this.prisma.staffAccount.findUniqueOrThrow({ where: { id: staffInput.id } });
    this.assertPartner(staff);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [balanceUsd, month, entries, withdrawals, referralPayouts] = await Promise.all([
      this.balance(staff.id),
      this.prisma.profitEntry.aggregate({
        where: { staffId: staff.id, kind: { in: ['ORDER', 'REVERSAL'] }, createdAt: { gte: monthStart } },
        _sum: { amountUsd: true },
      }),
      this.prisma.profitEntry.findMany({
        where: { staffId: staff.id },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.profitWithdrawal.findMany({ where: { staffId: staff.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.referrals.listOpenPayouts(),
    ]);

    const blockedUntil =
      staff.payoutAddressChangedAt && Date.now() - staff.payoutAddressChangedAt.getTime() < ADDRESS_COOLDOWN_MS
        ? new Date(staff.payoutAddressChangedAt.getTime() + ADDRESS_COOLDOWN_MS).toISOString()
        : null;

    const dto: PartnerDashboardDto = {
      me: {
        ...toPartner(staff),
        balanceUsd,
        earnedThisMonthUsd: round2(Number(month._sum.amountUsd ?? 0)),
        payoutChain: staff.payoutChain,
        payoutAddress: staff.payoutAddress,
        withdrawBlockedUntil: blockedUntil,
      },
      withdrawEnabled: this.bybit.isConfigured,
      minWithdrawUsd: MIN_WITHDRAW_USD,
      chains: PAYOUT_CHAINS,
      entries: entries.map((e) => ({
        id: e.id,
        kind: e.kind as PartnerDashboardDto['entries'][number]['kind'],
        orderNumber: e.order?.orderNumber ?? null,
        amountUsd: Number(e.amountUsd),
        commissionUsd: e.commissionUsd === null ? null : Number(e.commissionUsd),
        referralUsd: e.referralUsd === null ? null : Number(e.referralUsd),
        sharePercent: e.sharePercent === null ? null : Number(e.sharePercent),
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amountUsd: Number(w.amountUsd),
        chain: w.chain,
        address: w.address,
        trigger: w.trigger as 'MANUAL' | 'MONTHLY',
        status: w.status as 'PENDING' | 'SENT' | 'FAILED',
        error: w.error,
        createdAt: w.createdAt.toISOString(),
      })),
      referralPayouts,
    };

    if (staff.isOwner) {
      const admins = await this.prisma.staffAccount.findMany({
        where: { role: StaffRole.ADMIN, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      dto.partners = await Promise.all(
        admins
          .filter((a) => a.profitSharePercent !== null)
          .map(async (a) => ({ ...toPartner(a), balanceUsd: await this.balance(a.id) })),
      );
      dto.candidates = admins.filter((a) => a.profitSharePercent === null).map(toPartner);
    }
    return dto;
  }

  /** Owner: set the partners and their shares (must add up to 100 %). */
  async setShares(ownerInput: StaffAccount, shares: Array<{ staffId: string; sharePercent: number | null }>): Promise<PartnerDashboardDto> {
    const owner = await this.prisma.staffAccount.findUniqueOrThrow({ where: { id: ownerInput.id } });
    if (!owner.isOwner) throw new ForbiddenException('Доли партнёров меняет только владелец.');
    const active = shares.filter((s) => s.sharePercent !== null && s.sharePercent > 0);
    const total = round2(active.reduce((acc, s) => acc + (s.sharePercent ?? 0), 0));
    if (active.length > 0 && total !== 100) throw new BadRequestException(`Сумма долей должна быть 100%, сейчас ${total}%.`);

    const admins = await this.prisma.staffAccount.findMany({ where: { id: { in: shares.map((s) => s.staffId) }, role: StaffRole.ADMIN } });
    if (admins.length !== shares.length) throw new BadRequestException('Партнёром можно сделать только администратора.');

    await this.prisma.$transaction(
      shares.map((s) =>
        this.prisma.staffAccount.update({
          where: { id: s.staffId },
          data: { profitSharePercent: s.sharePercent && s.sharePercent > 0 ? new Prisma.Decimal(s.sharePercent) : null },
        }),
      ),
    );
    const summary = active
      .map((s) => `${who(admins.find((a) => a.id === s.staffId)!)} — ${s.sharePercent}%`)
      .join(', ');
    await this.notifyPartners(`Прибыль: владелец изменил доли партнёров: ${summary || 'партнёров нет'}.`);
    return this.dashboard(owner);
  }

  async setPayoutAddress(staffInput: StaffAccount, chain: string, address: string): Promise<PartnerDashboardDto> {
    const staff = await this.prisma.staffAccount.findUniqueOrThrow({ where: { id: staffInput.id } });
    this.assertPartner(staff);
    const cleanChain = chain.trim().toUpperCase();
    const cleanAddress = address.trim();
    if (!PAYOUT_CHAINS.includes(cleanChain)) throw new BadRequestException('Неизвестная сеть.');
    if (!/^[A-Za-z0-9:_-]{20,128}$/.test(cleanAddress)) throw new BadRequestException('Проверьте адрес кошелька.');
    if (staff.payoutChain === cleanChain && staff.payoutAddress === cleanAddress) return this.dashboard(staff);

    await this.prisma.staffAccount.update({
      where: { id: staff.id },
      data: { payoutChain: cleanChain, payoutAddress: cleanAddress, payoutAddressChangedAt: new Date() },
    });
    await this.notifyPartners(
      `Прибыль: ${who(staff)} изменил адрес вывода на USDT ${cleanChain} ${cleanAddress.slice(0, 6)}…${cleanAddress.slice(-6)}. Выводы на него будут доступны через 24 часа. Если это были не вы — срочно напишите партнёру.`,
    );
    return this.dashboard(staff);
  }

  /** Button «Вывести»: the whole balance to the saved address. */
  async withdrawNow(staffInput: StaffAccount): Promise<PartnerDashboardDto> {
    const staff = await this.prisma.staffAccount.findUniqueOrThrow({ where: { id: staffInput.id } });
    this.assertPartner(staff);
    await this.withdraw(staff, 'MANUAL');
    return this.dashboard(staff);
  }

  /** 1st of the month, 10:00 server time: withdraw every partner's balance to their saved address. */
  @Cron('0 0 10 1 * *')
  async monthlyWithdrawals(): Promise<void> {
    if (!this.bybit.isConfigured) return;
    const partners = await this.prisma.staffAccount.findMany({
      where: { isActive: true, profitSharePercent: { not: null }, payoutAddress: { not: null } },
    });
    for (const partner of partners) {
      try {
        await this.withdraw(partner, 'MONTHLY');
      } catch (error) {
        this.logger.warn(`Monthly withdrawal for ${partner.id} skipped: ${errorText(error)}`);
      }
    }
  }

  private async withdraw(staff: StaffAccount, trigger: 'MANUAL' | 'MONTHLY'): Promise<void> {
    if (!this.bybit.isConfigured) {
      throw new BadRequestException('Вывод через Bybit ещё не настроен на сервере.');
    }
    if (!staff.payoutChain || !staff.payoutAddress) throw new BadRequestException('Сначала сохраните адрес кошелька.');
    if (staff.payoutAddressChangedAt && Date.now() - staff.payoutAddressChangedAt.getTime() < ADDRESS_COOLDOWN_MS) {
      throw new BadRequestException('Адрес недавно изменён — вывод станет доступен через 24 часа после изменения.');
    }
    if (this.inFlight.has(staff.id)) throw new BadRequestException('Вывод уже выполняется.');
    this.inFlight.add(staff.id);
    try {
      // Reserve the balance first (withdrawal entry), so a double click can't spend it twice.
      const withdrawal = await this.prisma.$transaction(async (tx) => {
        const agg = await tx.profitEntry.aggregate({ where: { staffId: staff.id }, _sum: { amountUsd: true } });
        const amount = round2(Number(agg._sum.amountUsd ?? 0));
        if (amount < MIN_WITHDRAW_USD) {
          throw new BadRequestException(`Вывод доступен от $${MIN_WITHDRAW_USD}. Сейчас на балансе $${amount}.`);
        }
        const created = await tx.profitWithdrawal.create({
          data: {
            staffId: staff.id,
            amountUsd: new Prisma.Decimal(amount),
            chain: staff.payoutChain!,
            address: staff.payoutAddress!,
            trigger,
          },
        });
        await tx.profitEntry.create({
          data: {
            staffId: staff.id,
            kind: 'WITHDRAWAL',
            amountUsd: new Prisma.Decimal(-amount),
            withdrawalId: created.id,
            note: `Вывод USDT ${created.chain}`,
          },
        });
        return created;
      });

      try {
        const bybitId = await this.bybit.withdrawUsdt({
          chain: withdrawal.chain,
          address: withdrawal.address,
          amount: Number(withdrawal.amountUsd),
          requestId: withdrawal.id,
        });
        await this.prisma.profitWithdrawal.update({ where: { id: withdrawal.id }, data: { status: 'SENT', bybitWithdrawId: bybitId } });
        await this.notifyPartners(
          `Прибыль: ${who(staff)} — выведено $${Number(withdrawal.amountUsd).toFixed(2)} USDT (${withdrawal.chain})${trigger === 'MONTHLY' ? ', ежемесячный вывод' : ''}.`,
        );
      } catch (error) {
        const message = errorText(error).slice(0, 500);
        // Give the money back to the balance.
        await this.prisma.$transaction([
          this.prisma.profitWithdrawal.update({ where: { id: withdrawal.id }, data: { status: 'FAILED', error: message } }),
          this.prisma.profitEntry.create({
            data: {
              staffId: staff.id,
              kind: 'ADJUSTMENT',
              amountUsd: withdrawal.amountUsd,
              withdrawalId: withdrawal.id,
              note: 'Возврат: вывод не прошёл',
            },
          }),
        ]);
        await this.notifyPartners(`Прибыль: вывод ${who(staff)} на $${Number(withdrawal.amountUsd).toFixed(2)} не прошёл — ${message}`);
        throw new BadRequestException(`Bybit не принял вывод: ${message}`);
      }
    } finally {
      this.inFlight.delete(staff.id);
    }
  }

  /** Every partner (and the owner) gets money-related events in Telegram. */
  private async notifyPartners(text: string): Promise<void> {
    const partners = await this.prisma.staffAccount.findMany({
      where: { isActive: true, OR: [{ isOwner: true }, { profitSharePercent: { not: null } }], telegramId: { not: null } },
      select: { telegramId: true },
    });
    await this.notifications
      .notifyTelegramIds(partners.map((p) => p.telegramId as string), text)
      .catch(() => undefined);
  }
}

function toPartner(s: StaffAccount): PartnerDto {
  return {
    staffId: s.id,
    username: s.username,
    firstName: s.firstName,
    isOwner: s.isOwner,
    sharePercent: s.profitSharePercent === null ? null : Number(s.profitSharePercent),
  };
}
