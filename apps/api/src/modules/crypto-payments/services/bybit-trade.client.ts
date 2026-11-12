import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Bybit V5 with a separate key that may only trade on spot and move funds
 * between our own accounts (BYBIT_TRADE_API_KEY / _SECRET, no withdrawals,
 * IP-bound). Used to sell GRAM (TON) received from the Telegram wallet for USDT.
 */
@Injectable()
export class BybitTradeClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.baseUrl = config.get<string>('integrations.bybitRestBase') ?? 'https://api.bybit.com';
    this.apiKey = process.env.BYBIT_TRADE_API_KEY ?? '';
    this.apiSecret = process.env.BYBIT_TRADE_API_SECRET ?? '';
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  /** Best bid of a spot pair (public). */
  async bid(symbol: string): Promise<number> {
    const res = await fetch(`${this.baseUrl}/v5/market/tickers?category=spot&symbol=${encodeURIComponent(symbol)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { result?: { list?: Array<{ bid1Price?: string }> } } | null;
    const bid = Number(body?.result?.list?.[0]?.bid1Price);
    if (!Number.isFinite(bid) || bid <= 0) throw new Error(`Bybit: нет цены ${symbol}`);
    return bid;
  }

  /** Funding → Unified (spot trades from the unified account; deposits land on funding). */
  async toUnified(coin: string, amount: string): Promise<void> {
    await this.post('/v5/asset/transfer/inter-transfer', {
      transferId: randomUUID(),
      coin,
      amount,
      fromAccountType: 'FUND',
      toAccountType: 'UNIFIED',
    });
  }

  /** Market sell of `qty` base coin; returns the order id. */
  async marketSell(symbol: string, qty: string): Promise<string> {
    const result = (await this.post('/v5/order/create', {
      category: 'spot',
      symbol,
      side: 'Sell',
      orderType: 'Market',
      qty,
      marketUnit: 'baseCoin',
    })) as { orderId?: string };
    if (!result.orderId) throw new Error('Bybit не вернул id ордера');
    return result.orderId;
  }

  /** Filled amounts of a spot order (quote = USDT received). */
  async order(orderId: string): Promise<{ status: string; qty: number; quote: number } | null> {
    const result = (await this.get('/v5/order/history', { category: 'spot', orderId })) as {
      list?: Array<{ orderStatus: string; cumExecQty: string; cumExecValue: string }>;
    };
    const o = result.list?.[0];
    return o ? { status: o.orderStatus, qty: Number(o.cumExecQty), quote: Number(o.cumExecValue) } : null;
  }

  private headers(payload: string): Record<string, string> {
    const timestamp = Date.now().toString();
    const recvWindow = '20000';
    const sign = crypto
      .createHmac('sha256', this.apiSecret)
      .update(`${timestamp}${this.apiKey}${recvWindow}${payload}`)
      .digest('hex');
    return {
      'X-BAPI-API-KEY': this.apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'X-BAPI-SIGN': sign,
      'X-BAPI-SIGN-TYPE': '2',
      'Content-Type': 'application/json',
    };
  }

  private async post(path: string, body: Record<string, unknown>): Promise<unknown> {
    const payload = JSON.stringify(body);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: this.headers(payload),
      body: payload,
    });
    return this.unwrap(res, path);
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const query = Object.keys(params)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    const res = await fetch(`${this.baseUrl}${path}?${query}`, {
      signal: AbortSignal.timeout(15_000),
      headers: this.headers(query),
    });
    return this.unwrap(res, path);
  }

  private async unwrap(res: Response, path: string): Promise<unknown> {
    const body = (await res.json().catch(() => null)) as { retCode?: number; retMsg?: string; result?: unknown } | null;
    if (!res.ok || !body || body.retCode !== 0) {
      throw new Error(`Bybit ${path}: ${body?.retMsg ?? `HTTP ${res.status}`}`);
    }
    return body.result;
  }
}
