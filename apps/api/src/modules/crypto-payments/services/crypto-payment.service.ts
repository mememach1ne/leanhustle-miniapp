import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CryptoPaymentStatus,
  OrderStatus as PrismaOrderStatus,
  Prisma,
} from '@prisma/client';
import type { CryptoPaymentIntentDto } from '@lean-poizon/shared';
import { OrderStatus as SharedOrderStatus, PaymentNetwork } from '@lean-poizon/shared';

import { PrismaService } from '../../../prisma/prisma.service';
import { OrderNotificationsService } from '../../orders/services/order-notifications.service';
import { BybitClientService } from './bybit-client.service';

const USDT_COIN = 'USDT';

/**
 * How long a freshly created intent lives. Read from config; defaults to
 * 60 minutes. Customers very rarely take longer than that to send a
 * deposit; longer windows pile up dead PENDING rows and risk collisions.
 */
const DEFAULT_TTL_MINUTES = 60;

@Injectable()
export class CryptoPaymentService {
  private readonly logger = new Logger(CryptoPaymentService.name);
  private readonly ttlMinutes: number;
  private readonly enabledNetworks: PaymentNetwork[];

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BybitClientService) private readonly bybit: BybitClientService,
    @Inject(OrderNotificationsService)
    private readonly orderNotifications: OrderNotificationsService,
    @Inject(ConfigService) configService: ConfigService,
  ) {
    this.ttlMinutes =
      configService.get<number>('integrations.bybitPaymentTtlMinutes') ??
      DEFAULT_TTL_MINUTES;
    const list =
      configService.get<string[]>('integrations.bybitEnabledNetworks') ?? [];
    this.enabledNetworks = list.length
      ? (list.filter((value) => isPaymentNetwork(value)) as PaymentNetwork[])
      : Object.values(PaymentNetwork);
  }

  /** Returns the list of networks we currently surface to the customer. */
  getEnabledNetworks(): PaymentNetwork[] {
    return [...this.enabledNetworks];
  }

  /**
   * Create (or reuse) a payment intent for an order. If a PENDING intent
   * already exists for the same (order, network) we return it as-is. If a
   * PENDING intent exists for a *different* network we cancel it first so
   * we don't keep multiple addresses live for the same order.
   *
   * Owner-only: the order must belong to the calling user.
   */
  async createIntentForCurrentUser(
    userId: string,
    orderId: string,
    network: PaymentNetwork,
  ): Promise<CryptoPaymentIntentDto> {
    if (!this.enabledNetworks.includes(network)) {
      throw new BadRequestException('Эта сеть временно недоступна для оплаты.');
    }
    if (!this.bybit.isConfigured()) {
      throw new BadRequestException(
        'Криптоплатежи временно отключены. Свяжитесь с менеджером.',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        totalUsd: true,
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.userId !== userId) throw new ForbiddenException();
    if (
      order.status !== PrismaOrderStatus.CREATED &&
      order.status !== PrismaOrderStatus.PAYMENT_PENDING
    ) {
      throw new BadRequestException(
        'Оплата доступна только на этапе ожидания оплаты товара.',
      );
    }

    // Reuse a live intent for the same (order, network).
    const existing = await this.prisma.cryptoPayment.findFirst({
      where: { orderId: order.id, network, status: CryptoPaymentStatus.PENDING },
    });
    if (existing && existing.expiresAt > new Date()) {
      return this.mapToDto(existing, order.orderNumber);
    }

    // Cancel any stale PENDING for this order on other networks — the user
    // explicitly switched.
    await this.prisma.cryptoPayment.updateMany({
      where: { orderId: order.id, status: CryptoPaymentStatus.PENDING },
      data: { status: CryptoPaymentStatus.CANCELLED },
    });

    const addressInfo = await this.bybit.getDepositAddress(USDT_COIN, network);
    if (!addressInfo) {
      throw new BadRequestException(
        'Не удалось получить депозит-адрес от Bybit. Попробуйте другую сеть или свяжитесь с менеджером.',
      );
    }

    const expectedAmount = await this.generateUniqueAmount(
      network,
      Number(order.totalUsd),
    );

    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60_000);

    const intent = await this.prisma.cryptoPayment.create({
      data: {
        orderId: order.id,
        network,
        address: addressInfo.address,
        addressTag: addressInfo.tag,
        expectedAmountUsdt: new Prisma.Decimal(expectedAmount.toFixed(6)),
        expiresAt,
      },
    });

    // Move CREATED -> PAYMENT_PENDING and log to history. We don't call
    // updateStatusByStaff because there's no staff actor here; this is a
    // client-driven transition.
    if (order.status === PrismaOrderStatus.CREATED) {
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: order.id },
          data: { status: PrismaOrderStatus.PAYMENT_PENDING },
        }),
        this.prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: PrismaOrderStatus.CREATED,
            toStatus: PrismaOrderStatus.PAYMENT_PENDING,
            comment: `Клиент выбрал оплату USDT · ${network}. Ждём депозит на ${addressInfo.address}.`,
          },
        }),
      ]);
    }

    return this.mapToDto(intent, order.orderNumber);
  }

  async getLatestIntentForCurrentUser(
    userId: string,
    orderId: string,
  ): Promise<CryptoPaymentIntentDto | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, userId: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.userId !== userId) throw new ForbiddenException();

    const intent = await this.prisma.cryptoPayment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!intent) return null;
    return this.mapToDto(intent, order.orderNumber);
  }

  /**
   * Polling job. Runs every 30 seconds. Fetches all successful USDT
   * deposits in the recent window and matches each against live PENDING
   * intents by amount (amounts are globally unique — see
   * generateUniqueAmount).
   *
   * Bybit gives us no webhooks, so this is the only path that flips an
   * order to PAID_AWAITING_PURCHASE.
   */
  @Cron('*/30 * * * * *')
  async pollPendingDeposits(): Promise<void> {
    if (!this.bybit.isConfigured()) return;

    const now = new Date();
    const pending = await this.prisma.cryptoPayment.findMany({
      where: { status: CryptoPaymentStatus.PENDING, expiresAt: { gt: now } },
      include: {
        order: { select: { id: true, orderNumber: true, userId: true } },
      },
    });
    if (pending.length === 0) return;

    // Look back generously so a late-confirmed deposit still matches even if
    // the customer paid a while before the intent expired.
    const startTime = Date.now() - 6 * 60 * 60 * 1000; // 6h
    const endTime = Date.now();

    const deposits = await this.bybit.listSuccessfulDeposits(
      USDT_COIN,
      startTime,
      endTime,
    );
    if (deposits.length === 0) return;

    for (const deposit of deposits) {
      // Already consumed? The unique index on bybitDepositId guards us, but
      // skipping early saves a roundtrip.
      const seen = await this.prisma.cryptoPayment.findFirst({
        where: { bybitDepositId: deposit.id },
        select: { id: true },
      });
      if (seen) continue;

      const depositAmount = Number(deposit.amount);
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) continue;

      const match = pending.find(
        (intent) =>
          Math.abs(Number(intent.expectedAmountUsdt) - depositAmount) < 0.0005,
      );
      if (!match) continue;

      try {
        await this.applyMatch(match.id, deposit.id, deposit.txID);
        this.logger.log(
          `Matched deposit ${deposit.id} (${deposit.chain}, ${deposit.amount}) -> order ${match.order.orderNumber}.`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to apply match for deposit ${deposit.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /**
   * Sweep PENDING intents whose TTL ran out. Runs every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleIntents(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.cryptoPayment.updateMany({
      where: { status: CryptoPaymentStatus.PENDING, expiresAt: { lt: now } },
      data: { status: CryptoPaymentStatus.EXPIRED },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale crypto payment intent(s).`);
    }
  }

  // ─── private helpers ──────────────────────────────────────────

  /**
   * Build a unique USDT amount per (network) for the unique-amount matching
   * strategy. Uses the integer dollar part of totalUsd and a 2-digit
   * fractional unique suffix.
   *
   * The amount must be unique across ALL networks (not just the one being
   * created) because the matcher reads every chain's deposits and matches
   * purely by amount. We pick a fractional 0.10..0.99 not currently in use
   * by any live PENDING payment. If all slots at this dollar floor are
   * taken we bump the floor by $1 and retry.
   */
  private async generateUniqueAmount(
    network: PaymentNetwork,
    totalUsd: number,
  ): Promise<number> {
    void network; // amounts are globally unique, not per-network
    const live = await this.prisma.cryptoPayment.findMany({
      where: { status: CryptoPaymentStatus.PENDING },
      select: { expectedAmountUsdt: true },
    });
    const taken = new Set(
      live.map((row) => Number(row.expectedAmountUsdt).toFixed(2)),
    );

    let floor = Math.ceil(totalUsd); // round up to whole dollar
    for (let bump = 0; bump < 20; bump += 1) {
      // Try every cents slot at this floor in random order.
      const cents = shuffle(range(10, 99));
      for (const c of cents) {
        const candidate = floor + c / 100;
        if (!taken.has(candidate.toFixed(2))) return candidate;
      }
      floor += 1;
    }
    // Astronomically improbable fallback.
    return floor + 0.42;
  }

  /**
   * Mark the intent matched, transition the order to PAID_AWAITING_PURCHASE
   * and notify customer + managers. Runs in a single transaction.
   */
  private async applyMatch(
    intentId: string,
    bybitDepositId: string,
    txHash: string,
  ): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      const intent = await tx.cryptoPayment.findUnique({
        where: { id: intentId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              user: { select: { telegramId: true } },
            },
          },
        },
      });
      if (!intent) return null;
      if (intent.status !== CryptoPaymentStatus.PENDING) return null;

      await tx.cryptoPayment.update({
        where: { id: intent.id },
        data: {
          status: CryptoPaymentStatus.MATCHED,
          matchedAt: new Date(),
          txHash,
          bybitDepositId,
        },
      });

      // Only advance the order status if it's still waiting for payment.
      // Staff might have manually moved it forward, in which case we just
      // record the match and stop.
      if (
        intent.order.status === PrismaOrderStatus.PAYMENT_PENDING ||
        intent.order.status === PrismaOrderStatus.CREATED
      ) {
        await tx.order.update({
          where: { id: intent.order.id },
          data: {
            status: PrismaOrderStatus.PAID_AWAITING_PURCHASE,
            paidAt: new Date(),
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: intent.order.id,
            fromStatus: intent.order.status,
            toStatus: PrismaOrderStatus.PAID_AWAITING_PURCHASE,
            comment: `Депозит USDT · ${intent.network} получен. Сумма ${Number(
              intent.expectedAmountUsdt,
            ).toFixed(2)}. tx: ${txHash}`,
          },
        });
      }

      return {
        orderId: intent.order.id,
        orderNumber: intent.order.orderNumber,
        userTelegramId: intent.order.user.telegramId,
        transitioned:
          intent.order.status === PrismaOrderStatus.PAYMENT_PENDING ||
          intent.order.status === PrismaOrderStatus.CREATED,
      };
    });

    if (!result || !result.transitioned) return;

    try {
      await this.orderNotifications.notifyUserAboutStatusChange(
        result.userTelegramId,
        result.orderNumber,
        SharedOrderStatus.PAID_AWAITING_PURCHASE,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify customer about matched crypto payment: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private mapToDto(
    intent: {
      id: string;
      orderId: string;
      network: string;
      address: string;
      addressTag: string | null;
      expectedAmountUsdt: Prisma.Decimal;
      status: CryptoPaymentStatus;
      createdAt: Date;
      matchedAt: Date | null;
      expiresAt: Date;
      txHash: string | null;
    },
    orderNumber: string,
  ): CryptoPaymentIntentDto {
    return {
      id: intent.id,
      orderId: intent.orderId,
      orderNumber,
      network: intent.network as PaymentNetwork,
      address: intent.address,
      addressTag: intent.addressTag,
      expectedAmountUsdt: Number(intent.expectedAmountUsdt),
      status: intent.status as CryptoPaymentIntentDto['status'],
      createdAt: intent.createdAt.toISOString(),
      expiresAt: intent.expiresAt.toISOString(),
      matchedAt: intent.matchedAt ? intent.matchedAt.toISOString() : null,
      txHash: intent.txHash,
    };
  }
}

function isPaymentNetwork(value: string): value is PaymentNetwork {
  return (Object.values(PaymentNetwork) as string[]).includes(value);
}

/** Inclusive integer range [from, to]. */
function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
