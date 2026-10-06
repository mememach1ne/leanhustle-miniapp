import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RaketaOrderItemPayload {
  link: string;
  item_title: string;
  discription_cn: string;
  count: number;
  price_cn: string;
  additional_services: string[];
}

export interface RaketaCreateOrderPayload {
  title: string;
  china_track_number: string;
  seller_id: number;
  declarant_id: string;
  items: RaketaOrderItemPayload[];
  additional_services: string[];
  delivery_type: string | null;
  receive_type: string | null;
  customer_recipient_id: string | null;
  customer_address_id: string | null;
  tc_tariff_token: string | null;
  consolidation_id: string | null;
  draft: boolean;
}

export interface RaketaOrder {
  id: string;
  title: string;
  raketa_track_number?: string | null;
  china_track_number?: string | null;
  stage_name?: string | null;
}

interface RaketaDeclarant {
  id: string;
  display_name: string;
  is_external: boolean;
}

export class RaketaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * Thin client for the RAKETA forwarder cabinet API (my.raketacn.ru/api) —
 * the same endpoints the cabinet web app uses. Logs in with the account
 * from env (RAKETA_EMAIL / RAKETA_PASSWORD) and keeps the bearer token in
 * memory, logging in again when it expires.
 */
@Injectable()
export class RaketaClientService {
  private readonly logger = new Logger(RaketaClientService.name);
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private token: string | null = null;
  private loginInFlight: Promise<string> | null = null;
  private declarantId: string | null = null;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.baseUrl = (configService.get<string>('raketa.apiUrl') || 'https://my.raketacn.ru/api').replace(
      /\/$/,
      '',
    );
    this.email = configService.get<string>('raketa.email') ?? '';
    this.password = configService.get<string>('raketa.password') ?? '';
  }

  get isConfigured(): boolean {
    return Boolean(this.email && this.password);
  }

  /** Our own (non-external) declarant — the account owner. */
  async getOwnDeclarantId(): Promise<string> {
    if (this.declarantId) return this.declarantId;
    const body = await this.request<{ data: RaketaDeclarant[] }>('GET', '/declarants?page=1');
    const own = body.data.find((d) => !d.is_external) ?? body.data[0];
    if (!own) throw new RaketaApiError('В кабинете RAKETA нет ни одного декларанта.');
    this.declarantId = own.id;
    return own.id;
  }

  /** Creates an order; RAKETA answers `{ message, order_id }`. Returns the full order. */
  async createOrder(payload: RaketaCreateOrderPayload): Promise<RaketaOrder> {
    const body = await this.request<{ order_id?: string; data?: { id?: string } }>(
      'POST',
      '/customer_order',
      payload,
    );
    const id = body.order_id ?? body.data?.id;
    if (!id) throw new RaketaApiError('RAKETA не вернула ID созданного заказа.');
    try {
      return await this.getOrder(id);
    } catch {
      return { id, title: payload.title, china_track_number: payload.china_track_number };
    }
  }

  /**
   * Existing order with this China track number (to avoid duplicates on
   * retries). The list endpoint has no track field, so search by text and
   * confirm on the order card.
   */
  async findOrderByChinaTrack(chinaTrack: string): Promise<RaketaOrder | null> {
    const wanted = chinaTrack.toUpperCase();
    const query = new URLSearchParams({ text: chinaTrack, offset: '0' }).toString();
    const body = await this.request<{ data?: Array<{ id: string }> }>('GET', `/customer_orders?${query}`);
    for (const candidate of (body.data ?? []).slice(0, 10)) {
      const order = await this.getOrder(candidate.id);
      if ((order.china_track_number ?? '').toUpperCase() === wanted) return order;
    }
    return null;
  }

  /** Slow fallback: open the latest `limit` orders one by one and compare tracks. */
  async scanRecentOrdersForChinaTrack(chinaTrack: string, limit = 30): Promise<RaketaOrder | null> {
    const wanted = chinaTrack.toUpperCase();
    for (let offset = 0; offset < limit; offset += 10) {
      const body = await this.request<{ data?: Array<{ id: string }> }>(
        'GET',
        `/customer_orders?offset=${offset}`,
      );
      const list = body.data ?? [];
      for (const candidate of list) {
        const order = await this.getOrder(candidate.id);
        if ((order.china_track_number ?? '').toUpperCase() === wanted) return order;
      }
      if (list.length < 10) break;
    }
    return null;
  }

  async getOrder(id: string): Promise<RaketaOrder> {
    const body = await this.request<{ data: RaketaOrder }>('GET', `/customer_order/${encodeURIComponent(id)}`);
    return body.data;
  }

  private async login(): Promise<string> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Интеграция с RAKETA не настроена: добавьте RAKETA_EMAIL и RAKETA_PASSWORD в apps/api/.env.',
      );
    }
    this.loginInFlight ??= (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/auth/login`, {
          method: 'POST',
          signal: AbortSignal.timeout(20_000),
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email: this.email, password: this.password }),
        });
        const body = (await res.json().catch(() => ({}))) as { access_token?: string; message?: unknown };
        if (!res.ok || !body.access_token) {
          throw new RaketaApiError(
            `Не удалось войти в кабинет RAKETA (HTTP ${res.status}). Проверьте логин/пароль или не включили ли капчу.`,
            res.status,
          );
        }
        this.logger.log('Logged in to RAKETA cabinet');
        this.token = body.access_token;
        return body.access_token;
      } finally {
        this.loginInFlight = null;
      }
    })();
    return this.loginInFlight;
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, retry = true): Promise<T> {
    const token = this.token ?? (await this.login());
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && retry) {
      this.token = null;
      return this.request<T>(method, path, body, false);
    }

    const json = (await res.json().catch(() => null)) as
      | (T & { errors?: unknown; message?: unknown })
      | null;
    if (!res.ok || !json) {
      throw new RaketaApiError(`RAKETA ${method} ${path}: ${describeError(json) ?? `HTTP ${res.status}`}`, res.status);
    }
    return json;
  }
}

/** Flattens Laravel-style `{ message, errors: { field: [msg] } }` into one line. */
function describeError(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const { message, errors } = body as { message?: unknown; errors?: unknown };
  const parts: string[] = [];
  if (typeof message === 'string' && message) parts.push(message);
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    for (const [field, msgs] of Object.entries(errors as Record<string, unknown>)) {
      parts.push(`${field}: ${Array.isArray(msgs) ? msgs.join(', ') : String(msgs)}`);
    }
  } else if (Array.isArray(errors) && errors.length) {
    parts.push(errors.map(String).join(', '));
  }
  return parts.length ? parts.join('; ').slice(0, 500) : null;
}
