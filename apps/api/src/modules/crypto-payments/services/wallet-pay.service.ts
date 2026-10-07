import type { WalletInvoiceDto, WalletOptionDto, WalletProvider } from '@lean-poizon/shared';
import { OrderStatus as SharedOrderStatus } from '@lean-poizon/shared';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, PaymentSource, Prisma, type WalletInvoice } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { OrderNotificationsService } from '../../orders/services/order-notifications.service';
import { SettingsService } from '../../settings/settings.service';

const INVOICE_TTL_SECONDS = 60 * 60;
const TITLES: Record<WalletProvider, string> = { CRYPTOBOT: 'CryptoBot', XROCKET: 'xRocket' };

type RemoteStatus = 'active' | 'paid' | 'expired';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Goods payment through Telegram wallets — @CryptoBot (Crypto Pay API) and
 * @xRocket (Rocket Pay). Money lands on the app balance in the bot right
 * away. The wallet's fee is added on top of the order total and paid by the
 * client (rate from the admin settings). Paid invoices are picked up by a
 * poll every 20 s (no webhook setup needed).
 */
@Injectable()
export class WalletPayService {
  private readonly logger = new Logger(WalletPayService.name);
  private readonly cfg: { cryptoBotToken: string; cryptoBotApiUrl: string; xRocketToken: string; xRocketApiUrl: string };
  private polling = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.cfg = {
      cryptoBotToken: config.get<string>('wallets.cryptoBotToken') ?? '',
      cryptoBotApiUrl: (config.get<string>('wallets.cryptoBotApiUrl') ?? 'https://pay.crypt.bot/api').replace(/\/$/, ''),
      xRocketToken: config.get<string>('wallets.xRocketToken') ?? '',
      xRocketApiUrl: (config.get<string>('wallets.xRocketApiUrl') ?? 'https://pay.api.xrocket.exchange').replace(/\/$/, ''),
    };
  }

  private enabled(provider: WalletProvider): boolean {
    return provider === 'CRYPTOBOT' ? Boolean(this.cfg.cryptoBotToken) : Boolean(this.cfg.xRocketToken);
  }

  private async feePercent(provider: WalletProvider): Promise<number> {
    const s = await this.settings.getCurrentSettings();
    return Number(provider === 'CRYPTOBOT' ? s.cryptoBotFeePercent : s.xRocketFeePercent);
  }

  /** Wallets the client can pick (only configured ones), with the fee and the total for this order. */
  async getOptions(userId: string, orderId: string): Promise<WalletOptionDto[]> {
    const order = await this.ownOrder(userId, orderId);
    const options: WalletOptionDto[] = [];
    for (const provider of ['CRYPTOBOT', 'XROCKET'] as WalletProvider[]) {
      if (!this.enabled(provider)) continue;
      const feePercent = await this.feePercent(provider);
      options.push({
        provider,
        title: TITLES[provider],
        feePercent,
        amountUsdt: withFee(Number(order.totalUsd), feePercent),
      });
    }
    return options;
  }

  async getLatest(userId: string, orderId: string): Promise<WalletInvoiceDto | null> {
    await this.ownOrder(userId, orderId);
    const invoice = await this.prisma.walletInvoice.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
    return invoice ? toDto(invoice) : null;
  }

  /** Creates (or reuses a live) invoice in the chosen wallet. */
  async createInvoice(userId: string, orderId: string, provider: WalletProvider): Promise<WalletInvoiceDto> {
    if (!this.enabled(provider)) throw new BadRequestException('Этот способ оплаты сейчас недоступен.');
    const order = await this.ownOrder(userId, orderId);
    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Оплата доступна только на этапе ожидания оплаты товара.');
    }

    const live = await this.prisma.walletInvoice.findFirst({
      where: { orderId, provider, status: 'PENDING', expiresAt: { gt: new Date(Date.now() + 5 * 60_000) } },
      orderBy: { createdAt: 'desc' },
    });
    const feePercent = await this.feePercent(provider);
    const baseUsd = Number(order.totalUsd);
    const amountUsdt = withFee(baseUsd, feePercent);
    if (live && Number(live.amountUsdt) === amountUsdt) return toDto(live);

    const description = `Заказ ${order.orderNumber} — LEAN HUSTLE POIZON`;
    let remote: { id: string; url: string };
    try {
      remote =
        provider === 'CRYPTOBOT'
          ? await this.cryptoBotCreate(amountUsdt, description, order.id)
          : await this.xRocketCreate(amountUsdt, description, order.id);
    } catch (error) {
      this.logger.warn(`${provider} invoice for ${order.orderNumber} failed: ${errorText(error)}`);
      throw new BadRequestException(`Не удалось создать счёт в ${TITLES[provider]}. Попробуйте другой способ оплаты.`);
    }

    const invoice = await this.prisma.walletInvoice.create({
      data: {
        orderId: order.id,
        provider,
        externalId: remote.id,
        payUrl: remote.url,
        baseUsd: new Prisma.Decimal(baseUsd),
        feePercent: new Prisma.Decimal(feePercent),
        amountUsdt: new Prisma.Decimal(amountUsdt),
        expiresAt: new Date(Date.now() + INVOICE_TTL_SECONDS * 1000),
      },
    });

    if (order.status === OrderStatus.CREATED) {
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAYMENT_PENDING } }),
        this.prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: OrderStatus.CREATED,
            toStatus: OrderStatus.PAYMENT_PENDING,
            comment: `Клиент выбрал оплату через ${TITLES[provider]}: ${amountUsdt.toFixed(2)} USDT (включая комиссию ${feePercent}%).`,
          },
        }),
      ]);
    }
    return toDto(invoice);
  }

  @Cron('*/20 * * * * *')
  async pollInvoices(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const pending = await this.prisma.walletInvoice.findMany({ where: { status: 'PENDING' }, take: 100 });
      if (pending.length === 0) return;
      for (const provider of ['CRYPTOBOT', 'XROCKET'] as WalletProvider[]) {
        const list = pending.filter((i) => i.provider === provider);
        if (list.length === 0 || !this.enabled(provider)) continue;
        let statuses: Map<string, RemoteStatus>;
        try {
          statuses =
            provider === 'CRYPTOBOT'
              ? await this.cryptoBotStatuses(list.map((i) => i.externalId))
              : await this.xRocketStatuses(list.map((i) => i.externalId));
        } catch (error) {
          this.logger.warn(`${provider} status check failed: ${errorText(error)}`);
          continue;
        }
        for (const invoice of list) {
          const status = statuses.get(invoice.externalId);
          if (status === 'paid') await this.markPaid(invoice).catch((e) => this.logger.warn(errorText(e)));
          else if (status === 'expired' || (!status && invoice.expiresAt < new Date())) {
            await this.prisma.walletInvoice.update({ where: { id: invoice.id }, data: { status: 'EXPIRED' } });
          }
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private async markPaid(invoice: WalletInvoice): Promise<void> {
    const provider = invoice.provider as WalletProvider;
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.walletInvoice.updateMany({
        where: { id: invoice.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() },
      });
      if (claimed.count === 0) return null;
      const order = await tx.order.findUniqueOrThrow({
        where: { id: invoice.orderId },
        include: { user: { select: { telegramId: true } } },
      });
      const waiting = order.status === OrderStatus.CREATED || order.status === OrderStatus.PAYMENT_PENDING;
      if (waiting) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID_AWAITING_PURCHASE,
            paidAt: new Date(),
            paidVia: provider === 'CRYPTOBOT' ? PaymentSource.CRYPTOBOT : PaymentSource.XROCKET,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: OrderStatus.PAID_AWAITING_PURCHASE,
            comment: `Автооплата через ${TITLES[provider]}: ${Number(invoice.amountUsdt).toFixed(2)} USDT (комиссия ${Number(invoice.feePercent)}% оплачена клиентом).`,
          },
        });
      }
      return { order, waiting };
    });
    if (!result) return;
    this.logger.log(`${provider} invoice ${invoice.externalId} paid for ${result.order.orderNumber}`);
    if (!result.waiting) {
      await this.notifications.notifyManagers(
        `${TITLES[provider]}: по заказу ${result.order.orderNumber} пришла оплата ${Number(invoice.amountUsdt).toFixed(2)} USDT, но заказ уже не ждал оплаты — проверьте, не двойная ли это оплата.`,
        result.order.id,
      );
      return;
    }
    if (result.order.user?.telegramId) {
      await this.notifications
        .notifyUserAboutStatusChange(result.order.user.telegramId, result.order.orderNumber, SharedOrderStatus.PAID_AWAITING_PURCHASE, null, { orderId: result.order.id })
        .catch(() => undefined);
    }
    await this.notifications
      .notifyManagersAboutAutoPayment(result.order.orderNumber, Number(invoice.amountUsdt), TITLES[provider])
      .catch(() => undefined);
  }

  private async ownOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, userId: true, status: true, totalUsd: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден.');
    if (order.userId !== userId) throw new ForbiddenException();
    return order;
  }

  // ---------------- Crypto Pay (@CryptoBot) ----------------

  private async cryptoBot<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.cfg.cryptoBotApiUrl}/${method}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Crypto-Pay-API-Token': this.cfg.cryptoBotToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; error?: unknown } | null;
    if (!body?.ok || body.result === undefined) {
      throw new Error(`CryptoBot ${method}: ${JSON.stringify(body?.error ?? `HTTP ${res.status}`).slice(0, 200)}`);
    }
    return body.result;
  }

  private async cryptoBotCreate(amount: number, description: string, orderId: string) {
    const r = await this.cryptoBot<{ invoice_id: number; bot_invoice_url?: string; pay_url?: string }>('createInvoice', {
      currency_type: 'crypto',
      asset: 'USDT',
      amount: amount.toFixed(2),
      description,
      payload: orderId,
      expires_in: INVOICE_TTL_SECONDS,
      allow_comments: false,
      allow_anonymous: false,
    });
    const url = r.bot_invoice_url ?? r.pay_url;
    if (!url) throw new Error('CryptoBot did not return an invoice URL');
    return { id: String(r.invoice_id), url };
  }

  private async cryptoBotStatuses(ids: string[]): Promise<Map<string, RemoteStatus>> {
    const r = await this.cryptoBot<{ items?: Array<{ invoice_id: number; status: RemoteStatus }> }>('getInvoices', {
      invoice_ids: ids.join(','),
      count: Math.min(1000, ids.length),
    });
    return new Map((r.items ?? []).map((i) => [String(i.invoice_id), i.status]));
  }

  // ---------------- xRocket Pay API (@xRocket, Bearer token) ----------------

  private async xRocket<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.cfg.xRocketApiUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${this.cfg.xRocketToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as (T & { title?: string; detail?: string }) | null;
    if (!res.ok || !json) {
      // Errors are RFC 9457 problem details: { type, title, detail }.
      throw new Error(`xRocket ${path}: ${json?.detail ?? json?.title ?? `HTTP ${res.status}`}`.slice(0, 300));
    }
    return json;
  }

  private async xRocketCreate(amount: number, description: string, orderId: string) {
    const r = await this.xRocket<{ id: string; links?: { telegramBotLink?: string; webLink?: string } }>(
      'POST',
      '/api/v1/invoices',
      {
        priceAmount: amount.toFixed(2),
        priceCurrency: 'USDT',
        payCurrencies: ['USDT'],
        payoutCurrency: 'USDT',
        numPayments: 1,
        description,
        clientInvoiceId: `${orderId}-${Date.now()}`,
        expiresIn: INVOICE_TTL_SECONDS * 1000,
        // We add the fee to the amount ourselves — don't let xRocket charge it again.
        isFeePaidByUser: false,
      },
    );
    const url = r.links?.telegramBotLink ?? r.links?.webLink;
    if (!r.id || !url) throw new Error('xRocket did not return an invoice link');
    return { id: String(r.id), url };
  }

  private async xRocketStatuses(ids: string[]): Promise<Map<string, RemoteStatus>> {
    const out = new Map<string, RemoteStatus>();
    for (const id of ids) {
      const r = await this.xRocket<{ status: string }>(
        'GET',
        `/api/v1/invoice?${new URLSearchParams({ invoiceId: id })}`,
      );
      out.set(
        id,
        r.status === 'paid' ? 'paid' : r.status === 'expired' || r.status === 'cancelled' ? 'expired' : 'active',
      );
    }
    return out;
  }
}

/** Order total + the wallet's fee, rounded up to a cent. */
function withFee(baseUsd: number, feePercent: number): number {
  return Math.ceil(baseUsd * (1 + feePercent / 100) * 100) / 100;
}

function toDto(i: WalletInvoice): WalletInvoiceDto {
  return {
    id: i.id,
    provider: i.provider as WalletProvider,
    payUrl: i.payUrl,
    baseUsd: Number(i.baseUsd),
    feePercent: Number(i.feePercent),
    amountUsdt: Number(i.amountUsdt),
    status: i.status as WalletInvoiceDto['status'],
    expiresAt: i.expiresAt.toISOString(),
  };
}
