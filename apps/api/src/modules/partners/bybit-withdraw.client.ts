import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Bybit V5 withdrawals for the partners' profit. Uses its OWN key pair
 * (BYBIT_WITHDRAW_API_KEY / _SECRET, "Withdrawal" permission, IP-bound,
 * address whitelist on) — the deposit-reading key stays read-only.
 */
@Injectable()
export class BybitWithdrawClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.apiKey = config.get<string>('integrations.bybitWithdrawApiKey') ?? '';
    this.apiSecret = config.get<string>('integrations.bybitWithdrawApiSecret') ?? '';
    this.baseUrl = config.get<string>('integrations.bybitRestBase') ?? 'https://api.bybit.com';
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  /** USDT from the Funding account; the network fee is taken from `amount`. Returns Bybit's withdrawal id. */
  async withdrawUsdt(input: { chain: string; address: string; amount: number; requestId: string }): Promise<string> {
    const body = JSON.stringify({
      coin: 'USDT',
      chain: input.chain,
      address: input.address,
      amount: input.amount.toFixed(2),
      timestamp: Date.now(),
      forceChain: 1,
      accountType: 'FUND',
      feeType: 1,
      requestId: input.requestId.replace(/-/g, '').slice(0, 32),
    });
    const res = await fetch(`${this.baseUrl}/v5/asset/withdraw/create`, {
      method: 'POST',
      headers: this.headers(body),
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as { retCode?: number; retMsg?: string; result?: { id?: string } } | null;
    if (!json || json.retCode !== 0 || !json.result?.id) {
      throw new Error(`Bybit: ${json?.retMsg ?? `HTTP ${res.status}`}`);
    }
    return String(json.result.id);
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
}
