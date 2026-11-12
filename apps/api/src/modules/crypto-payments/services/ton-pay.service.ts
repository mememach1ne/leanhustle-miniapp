import { randomInt } from 'crypto';

import { OrderStatus as SharedOrderStatus } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, PaymentSource, Prisma, type TonPayment } from '@prisma/client';
import { Address } from '@ton/core';

import { PrismaService } from '../../../prisma/prisma.service';
import { OrderNotificationsService } from '../../orders/services/order-notifications.service';
import { SettingsService } from '../../settings/settings.service';
import { BybitClientService } from './bybit-client.service';
import { BybitTradeClient } from './bybit-trade.client';

/** On Bybit TON is listed as GRAM (renamed); the deposit chain is TON. */
const COIN = 'GRAM';
const CHAIN = 'TON';
const SYMBOL = 'GRAMUSDT';
const NANO = 1_000_000_000n;
const VALID_FOR_MS = 10 * 60 * 1000;
const VERIFY_FOR_MS = 30 * 60 * 1000;
const TONCENTER = 'https://toncenter.com/api/v3';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const sameAddress = (a: string, b: string) => {
  try {
    return Address.parse(a).equals(Address.parse(b));
  } catch {
    return false;
  }
};

/** A widget query relayed by the bot (raw Telegram `type` included). */
export interface TonWidgetQuery {
  id: string;
  fromId: string;
  data: string;
  chatId?: string;
  messageId?: number;
  type?: {
    type?: string;
    wallet_card?: { address?: string; amount?: string };
    wallet?: { address?: string };
    msg_hash?: string;
  };
}

/**
 * Paying for an order from the Telegram TON wallet, right in the order card
 * (Bot API 10.4 widgets):
 *  1. tap → widget query with the wallet card → we price the order in TON
 *     (Bybit GRAMUSDT bid + hidden markup), answer with a TON Connect
 *     transaction to our Bybit GRAM deposit address;
 *  2. the wallet sends it → `sent_transaction` query with msg_hash;
 *  3. we check the transaction on-chain (toncenter): our address, enough
 *     TON, not aborted → the order is paid (paidVia TON_WALLET);
 *  4. once Bybit credits the deposit, it's moved to the unified account
 *     and sold for USDT (separate trade key); failures go to the owner.
 */
@Injectable()
export class TonPayService {
  private readonly logger = new Logger(TonPayService.name);
  private verifying = false;
  private selling = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(BybitClientService) private readonly bybit: BybitClientService,
    @Inject(BybitTradeClient) private readonly trade: BybitTradeClient,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  get enabled(): boolean {
    return (process.env.TON_PAY ?? '').toLowerCase() !== 'off' && this.bybit.isConfigured();
  }

  /** Card query: «tp» (prepare) or the wallet's outcome «tp:<id>». Returns the answer data. */
  async handle(query: TonWidgetQuery): Promise<string> {
    try {
      if (query.type?.type === 'sent_transaction' || query.data.startsWith('tp:')) return await this.sent(query);
      return await this.prepare(query);
    } catch (error) {
      this.logger.warn(`TON pay query «${query.data}» failed: ${errorText(error)}`);
      return JSON.stringify({ e: 'Не получилось — попробуйте ещё раз' });
    }
  }

  private async prepare(query: TonWidgetQuery): Promise<string> {
    if (!this.enabled) return JSON.stringify({ e: 'Оплата из кошелька сейчас недоступна' });
    const order =
      query.chatId && query.messageId
        ? await this.prisma.order.findFirst({
            where: { widgetMessageId: query.messageId, user: { telegramId: query.chatId } },
          })
        : null;
    if (!order || query.fromId !== query.chatId) return JSON.stringify({ e: 'Заказ не найден' });
    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.PAYMENT_PENDING) {
      return JSON.stringify({ e: 'Заказ уже оплачен' });
    }
    const deposit = await this.bybit.getDepositAddress(COIN, CHAIN);
    if (!deposit) return JSON.stringify({ e: 'Оплата из кошелька сейчас недоступна' });

    const settings = await this.settings.getCurrentSettings();
    const markup = Number(settings.tonMarkupPercent ?? 0.5);
    const rate = await this.trade.bid(SYMBOL);
    const usd = Number(order.totalUsd);
    // Round up to 0.01 TON, plus a few micro-TON so the Bybit deposit is easy to match.
    const ton = Math.ceil(((usd * (1 + markup / 100)) / rate) * 100) / 100;
    const amountNano = BigInt(Math.round(ton * 100)) * (NANO / 100n) + BigInt(randomInt(1, 1000)) * 1000n;

    // An older unpaid offer for this order isn't valid any more.
    await this.prisma.tonPayment.updateMany({
      where: { orderId: order.id, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    const validUntil = new Date(Date.now() + VALID_FOR_MS);
    const payment = await this.prisma.tonPayment.create({
      data: {
        orderId: order.id,
        amountNano,
        usdAmount: new Prisma.Decimal(usd),
        tonUsdRate: new Prisma.Decimal(rate),
        markupPercent: new Prisma.Decimal(markup),
        toAddress: deposit.address,
        validUntil,
      },
    });
    return JSON.stringify({
      i: payment.id,
      t: {
        valid_until: Math.floor(validUntil.getTime() / 1000),
        messages: [{ address: deposit.address, amount: amountNano.toString() }],
      },
    });
  }

  private async sent(query: TonWidgetQuery): Promise<string> {
    const id = query.data.startsWith('tp:') ? query.data.slice(3) : '';
    const msgHash = query.type?.msg_hash;
    const payment = /^[0-9a-f-]{36}$/i.test(id) ? await this.prisma.tonPayment.findUnique({ where: { id } }) : null;
    if (!payment || !msgHash) return JSON.stringify({ e: 'Платёж не найден — напишите менеджеру' });
    if (payment.status === 'PENDING' || payment.status === 'EXPIRED') {
      await this.prisma.tonPayment.update({
        where: { id: payment.id },
        data: { status: 'SENT', msgHash, fromAddress: query.type?.wallet?.address ?? null },
      });
    }
    void this.verifyOne(payment.id);
    return JSON.stringify({ s: 'checking' });
  }

  /** Every 15 s: check sent transactions on-chain; drop stale offers. */
  @Cron('*/15 * * * * *')
  async verifyAll(): Promise<void> {
    if (this.verifying) return;
    this.verifying = true;
    try {
      await this.prisma.tonPayment.updateMany({
        where: { status: 'PENDING', validUntil: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
        data: { status: 'EXPIRED' },
      });
      const sent = await this.prisma.tonPayment.findMany({ where: { status: 'SENT' } });
      for (const p of sent) await this.verifyOne(p.id);
    } catch (error) {
      this.logger.warn(`TON verify cycle failed: ${errorText(error)}`);
    } finally {
      this.verifying = false;
    }
  }

  private async verifyOne(id: string): Promise<void> {
    const payment = await this.prisma.tonPayment.findUnique({ where: { id } });
    if (!payment || payment.status !== 'SENT' || !payment.msgHash) return;
    let found: { ok: boolean; txHash?: string; reason?: string } | null;
    try {
      found = await this.findOnChain(payment);
    } catch (error) {
      this.logger.warn(`TON check ${payment.id}: ${errorText(error)}`);
      return;
    }
    if (!found) {
      if (Date.now() - payment.updatedAt.getTime() > VERIFY_FOR_MS) await this.fail(payment, 'транзакция не найдена в сети за 30 минут');
      return;
    }
    if (!found.ok) {
      await this.fail(payment, found.reason ?? 'транзакция не прошла проверку');
      return;
    }
    await this.markPaid(payment, found.txHash ?? null);
  }

  /**
   * The user's wallet transaction for msg_hash must send at least the
   * amount to our deposit address and not be aborted. Null = not yet seen.
   */
  private async findOnChain(payment: TonPayment): Promise<{ ok: boolean; txHash?: string; reason?: string } | null> {
    const hash = payment.msgHash as string;
    const hex = /^[0-9a-f]{64}$/i.test(hash) ? hash : Buffer.from(hash, 'base64').toString('hex');
    const res = await fetch(`${TONCENTER}/transactionsByMessage?msg_hash=${encodeURIComponent(hex)}&direction=in`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`toncenter HTTP ${res.status}`);
    const body = (await res.json()) as {
      transactions?: Array<{
        hash: string;
        description?: { aborted?: boolean; compute_ph?: { success?: boolean } };
        out_msgs?: Array<{ destination?: string; value?: string }>;
      }>;
    };
    const tx = body.transactions?.[0];
    if (!tx) return null;
    if (tx.description?.aborted || tx.description?.compute_ph?.success === false) {
      return { ok: false, reason: 'транзакция в сети не выполнилась' };
    }
    const paid = (tx.out_msgs ?? []).find(
      (m) => m.destination && sameAddress(m.destination, payment.toAddress) && BigInt(m.value ?? '0') >= payment.amountNano,
    );
    if (!paid) return { ok: false, reason: 'в транзакции нет перевода нужной суммы на наш адрес' };
    return { ok: true, txHash: tx.hash };
  }

  private async markPaid(payment: TonPayment, txHash: string | null): Promise<void> {
    const ton = Number(payment.amountNano) / 1e9;
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.tonPayment.updateMany({
        where: { id: payment.id, status: 'SENT' },
        data: { status: 'PAID', paidAt: new Date(), txHash },
      });
      if (claimed.count === 0) return null;
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { user: { select: { telegramId: true } } },
      });
      const waiting = order.status === OrderStatus.CREATED || order.status === OrderStatus.PAYMENT_PENDING;
      if (waiting) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID_AWAITING_PURCHASE, paidAt: new Date(), paidVia: PaymentSource.TON_WALLET },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: OrderStatus.PAID_AWAITING_PURCHASE,
            comment: `Оплата из TON-кошелька Telegram: ${ton.toFixed(4)} TON по курсу ${Number(payment.tonUsdRate)} $ (надбавка ${Number(payment.markupPercent)}%), транзакция ${txHash ?? '—'}.`,
          },
        });
      }
      return { order, waiting };
    });
    if (!result) return;
    this.logger.log(`TON payment ${payment.id}: ${result.order.orderNumber} paid ${ton} TON`);
    if (!result.waiting) {
      await this.notifications.notifyManagers(
        `TON-кошелёк: по заказу ${result.order.orderNumber} пришло ${ton.toFixed(2)} TON, но заказ уже не ждал оплаты — проверьте, не двойная ли это оплата.`,
        result.order.id,
      );
      return;
    }
    if (result.order.user?.telegramId) {
      await this.notifications
        .notifyUserAboutStatusChange(result.order.user.telegramId, result.order.orderNumber, SharedOrderStatus.PAID_AWAITING_PURCHASE, null, {
          orderId: result.order.id,
        })
        .catch(() => undefined);
    }
    await this.notifications
      .notifyManagersAboutAutoPayment(result.order.orderNumber, Number(payment.usdAmount), 'TON-кошелёк Telegram')
      .catch(() => undefined);
  }

  private async fail(payment: TonPayment, reason: string): Promise<void> {
    await this.prisma.tonPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', sellError: reason } });
    const order = await this.prisma.order.findUnique({ where: { id: payment.orderId }, select: { orderNumber: true } });
    await this.notifyOwner(
      `TON-кошелёк: платёж по заказу ${order?.orderNumber ?? payment.orderId} не подтвердился (${reason}). msg_hash ${payment.msgHash ?? '—'}, кошелёк ${payment.fromAddress ?? '—'}. Проверьте вручную.`,
      payment.orderId,
    );
  }

  /** Every minute: sell credited GRAM for USDT on Bybit. */
  @Cron('0 * * * * *')
  async sellAll(): Promise<void> {
    if (this.selling || !this.trade.isConfigured || !this.bybit.isConfigured()) return;
    this.selling = true;
    try {
      const unsold = await this.prisma.tonPayment.findMany({
        where: { status: 'PAID', soldAt: null, sellError: null },
        orderBy: { paidAt: 'asc' },
      });
      if (unsold.length === 0) return;
      const since = Math.min(...unsold.map((p) => p.createdAt.getTime())) - 10 * 60 * 1000;
      const deposits = await this.bybit.listSuccessfulDeposits(COIN, since, Date.now());
      for (const payment of unsold) {
        const ton = Number(payment.amountNano) / 1e9;
        const used = await this.prisma.tonPayment.findMany({
          where: { bybitDepositId: { not: null } },
          select: { bybitDepositId: true },
        });
        const usedIds = new Set(used.map((u) => u.bybitDepositId));
        const deposit = deposits.find(
          (d) => !usedIds.has(d.id) && Math.abs(Number(d.amount) - ton) < 0.0000015 && Number(d.successAt) >= payment.createdAt.getTime() - 60_000,
        );
        if (!deposit) {
          // Bybit usually credits in minutes; after 2 hours tell the owner.
          if (payment.paidAt && Date.now() - payment.paidAt.getTime() > 2 * 60 * 60 * 1000) {
            await this.sellFailed(payment, 'Bybit не зачислил депозит за 2 часа');
          }
          continue;
        }
        await this.prisma.tonPayment.update({ where: { id: payment.id }, data: { bybitDepositId: deposit.id } });
        try {
          // Deposits usually land on Unified already; the transfer only matters if Bybit put it on Funding.
          await this.trade.toUnified(COIN, deposit.amount).catch((error) => {
            this.logger.log(`TON payment ${payment.id}: no Funding→Unified transfer (${errorText(error)})`);
          });
          const qty = (Math.floor(Number(deposit.amount) * 100) / 100).toFixed(2);
          const bid = await this.trade.bid(SYMBOL);
          if (Number(qty) * bid < 5) {
            await this.sellFailed(payment, `сумма ${qty} TON меньше минимальной продажи Bybit ($5) — продайте вместе со следующими`);
            continue;
          }
          const orderId = await this.trade.marketSell(SYMBOL, qty);
          let filled: Awaited<ReturnType<BybitTradeClient['order']>> = null;
          for (let i = 0; i < 5 && (!filled || filled.status !== 'Filled'); i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            filled = await this.trade.order(orderId).catch(() => null);
          }
          await this.prisma.tonPayment.update({
            where: { id: payment.id },
            data: { soldAt: new Date(), soldUsdt: filled ? new Prisma.Decimal(filled.quote) : null },
          });
          this.logger.log(`TON payment ${payment.id}: sold ${qty} GRAM for ${filled?.quote ?? '?'} USDT`);
        } catch (error) {
          await this.sellFailed(payment, errorText(error));
        }
      }
    } catch (error) {
      this.logger.warn(`TON sell cycle failed: ${errorText(error)}`);
    } finally {
      this.selling = false;
    }
  }

  private async sellFailed(payment: TonPayment, reason: string): Promise<void> {
    await this.prisma.tonPayment.update({ where: { id: payment.id }, data: { sellError: reason.slice(0, 500) } });
    const order = await this.prisma.order.findUnique({ where: { id: payment.orderId }, select: { orderNumber: true } });
    await this.notifyOwner(
      `TON-кошелёк: не удалось продать TON по заказу ${order?.orderNumber ?? ''} на Bybit (${reason}). Заказ оплачен; продайте вручную.`,
      payment.orderId,
    );
  }

  private async notifyOwner(text: string, orderId?: string): Promise<void> {
    const owners = await this.prisma.staffAccount.findMany({
      where: { isOwner: true, isActive: true, telegramId: { not: null } },
      select: { telegramId: true },
    });
    await this.notifications.notifyTelegramIds(owners.map((o) => o.telegramId as string), text, orderId).catch(() => undefined);
  }
}
