import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * One row from `/v5/asset/deposit/query-record`.
 *
 * Bybit returns more fields; we type only what we actually consume so the
 * shape stays small and easy to mock.
 */
export interface BybitDepositRecord {
  /** Stable id for this deposit row — used as idempotency key. */
  id: string;
  /** ISO-style millisecond timestamp from Bybit (string). */
  successAt: string;
  coin: string;
  /** chainType, e.g. "TRX", "BSC". */
  chain: string;
  amount: string;
  /** Address the deposit landed on (our master address). */
  toAddress: string;
  /** External transaction hash on the chain. */
  txID: string;
  /**
   * Bybit deposit status: 1=processing, 2=success, 3=failed.
   * We only care about 2 (success); anything else is ignored.
   */
  status: number;
}

interface BybitListResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

@Injectable()
export class BybitClientService {
  private readonly logger = new Logger(BybitClientService.name);
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  /** Cache (coin, chain) -> { address, tag }. Address never changes. */
  private readonly addressCache = new Map<string, { address: string; tag: string | null }>();

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.apiKey = configService.get<string>('integrations.bybitApiKey') ?? '';
    this.apiSecret = configService.get<string>('integrations.bybitApiSecret') ?? '';
    this.baseURL =
      configService.get<string>('integrations.bybitRestBase') ?? 'https://api.bybit.com';
  }

  /** True when env keys are present — guards endpoints that need real credentials. */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new HttpException(
        'Bybit интеграция не настроена: задайте BYBIT_API_KEY и BYBIT_API_SECRET в .env.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * V5 auth scheme:
   *   sign = HMAC_SHA256(secret, timestamp + apiKey + recvWindow + queryString | bodyString)
   * Headers: X-BAPI-API-KEY, X-BAPI-TIMESTAMP, X-BAPI-RECV-WINDOW, X-BAPI-SIGN.
   * For GET requests `queryString` is the URL-encoded query (without leading `?`).
   */
  private buildHeaders(payload: string): Record<string, string> {
    const timestamp = Date.now().toString();
    const recvWindow = '20000';
    const preSign = `${timestamp}${this.apiKey}${recvWindow}${payload}`;
    const sign = crypto
      .createHmac('sha256', this.apiSecret)
      .update(preSign)
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

  private encodeQuery(params: Record<string, string | number>): string {
    // Bybit signs the raw query string — order matters. We sort keys
    // alphabetically for deterministic output.
    return Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
      .join('&');
  }

  private async signedGet<T>(
    path: string,
    params: Record<string, string | number>,
    context: string,
  ): Promise<T | null> {
    const query = this.encodeQuery(params);
    const url = `${this.baseURL}${path}?${query}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(query),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.error(
          `Bybit ${context} HTTP ${response.status}: ${text.slice(0, 200)}`,
        );
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(
        `Bybit ${context} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch (and cache) the master-account deposit address for (coin, chain).
   * Returns null if Bybit doesn't expose an address for this chain (rare —
   * usually means the chain is not enabled on the account).
   */
  async getDepositAddress(
    coin: string,
    chain: string,
  ): Promise<{ address: string; tag: string | null } | null> {
    this.assertConfigured();
    const cacheKey = `${coin}:${chain}`;
    const cached = this.addressCache.get(cacheKey);
    if (cached) return cached;

    type Resp = BybitListResponse<{
      chains: Array<{
        chain: string;
        addressDeposit: string;
        tagDeposit?: string;
        chainType?: string;
      }>;
    }>;

    const data = await this.signedGet<Resp>(
      '/v5/asset/deposit/query-address',
      { coin, chainType: chain },
      `query-address ${coin}/${chain}`,
    );

    if (!data) return null;
    if (data.retCode !== 0) {
      this.logger.warn(
        `Bybit query-address ${coin}/${chain} returned ${data.retCode}: ${data.retMsg}`,
      );
      return null;
    }

    const chains = data.result?.chains ?? [];
    // Bybit sometimes returns multiple rows (per chainType variant).
    // Pick the one whose chain/chainType matches our request.
    const match =
      chains.find((c) => c.chainType === chain || c.chain === chain) ?? chains[0];
    if (!match?.addressDeposit) return null;

    const value = {
      address: match.addressDeposit,
      tag: match.tagDeposit?.trim() || null,
    };
    this.addressCache.set(cacheKey, value);
    return value;
  }

  /**
   * List successful deposits for (coin, chain) within a time window.
   * `startTime`/`endTime` are milliseconds since epoch. Bybit returns all
   * statuses; we filter for `status === 2` (success) below.
   */
  async listDeposits(
    coin: string,
    chain: string,
    startTime: number,
    endTime: number,
  ): Promise<BybitDepositRecord[]> {
    this.assertConfigured();
    type Resp = BybitListResponse<{
      rows: BybitDepositRecord[];
      nextPageCursor: string;
    }>;

    const data = await this.signedGet<Resp>(
      '/v5/asset/deposit/query-record',
      { coin, startTime, endTime, limit: 50 },
      `query-record ${coin}/${chain}`,
    );
    if (!data) return [];
    if (data.retCode !== 0) {
      this.logger.warn(
        `Bybit query-record ${coin} returned ${data.retCode}: ${data.retMsg}`,
      );
      return [];
    }

    const rows = data.result?.rows ?? [];
    return rows.filter(
      (row) => row.status === 2 && row.coin === coin && row.chain === chain,
    );
  }
}
