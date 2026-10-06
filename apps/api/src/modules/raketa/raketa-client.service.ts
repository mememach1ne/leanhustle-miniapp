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

/** RAKETA's carrier id for CDEK and its standard tariff. */
export const RAKETA_CDEK_TK_ID = '78cbeab6-821e-48c8-9c2e-028a1ea99805';
export const RAKETA_CDEK_TARIFF_CODE = 'STND';

export interface RaketaCity {
  id: string;
  city: string;
  region: string | null;
}

export interface RaketaPickupPoint {
  id: string;
  pvz_code: string;
  address: string;
  name?: string | null;
  work_time?: string | null;
  index?: string | null;
  GPS?: string | null;
  delivery_sub_type?: string | null;
}

interface RaketaOrderDetails extends RaketaOrder {
  seller?: { id: number } | null;
  additional_services?: unknown[];
  items?: Array<{
    id: string;
    link: string;
    item_title: string;
    discription_cn: string;
    count: number;
    price_cn: string;
  }>;
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
  private readonly cityCache = new Map<string, { value: RaketaCity[]; expiresAt: number }>();
  private readonly pvzCache = new Map<string, { value: RaketaPickupPoint[]; expiresAt: number }>();

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
   * Finds an order by its China track or its RAKETA number (RA…). The list
   * endpoint has neither field, so search by text and confirm on the card.
   */
  async findOrderByTrack(track: string): Promise<RaketaOrder | null> {
    const wanted = track.toUpperCase();
    const query = new URLSearchParams({ text: track, offset: '0' }).toString();
    const body = await this.request<{ data?: Array<{ id: string }> }>('GET', `/customer_orders?${query}`);
    for (const candidate of (body.data ?? []).slice(0, 10)) {
      const order = await this.getOrder(candidate.id);
      if (
        (order.china_track_number ?? '').toUpperCase() === wanted ||
        (order.raketa_track_number ?? '').toUpperCase() === wanted
      ) {
        return order;
      }
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

  /** City search in the RAKETA (FIAS) directory. Cached for an hour. */
  async searchCities(text: string): Promise<RaketaCity[]> {
    const key = text.trim().toLowerCase();
    const cached = this.cityCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const body = await this.request<{ data?: RaketaCity[] }>(
      'GET',
      `/city_list?${new URLSearchParams({ text: text.trim() }).toString()}`,
    );
    const value = (body.data ?? []).slice(0, 20);
    this.cityCache.set(key, { value, expiresAt: Date.now() + 60 * 60 * 1000 });
    return value;
  }

  /** CDEK pickup points in a city (tariff "Стандарт"). Cached for 12 hours. */
  async getCdekPickupPoints(cityId: string): Promise<RaketaPickupPoint[]> {
    const cached = this.pvzCache.get(cityId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const tariffs = await this.request<{ data?: Array<{ id: string; tariff_code: string }> }>(
      'GET',
      `/get_tariff_list/${RAKETA_CDEK_TK_ID}/pvz/${encodeURIComponent(cityId)}`,
    );
    const list = tariffs.data ?? [];
    const tariff = list.find((t) => t.tariff_code === RAKETA_CDEK_TARIFF_CODE) ?? list[0];
    if (!tariff) return [];
    const body = await this.request<{ data?: RaketaPickupPoint[] }>(
      'GET',
      `/pvz_list/${RAKETA_CDEK_TK_ID}/${encodeURIComponent(cityId)}/${tariff.id}`,
    );
    const value = body.data ?? [];
    this.pvzCache.set(cityId, { value, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    return value;
  }

  /** Creates a recipient (Cyrillic names, phone as 10 digits). Returns its id. */
  async createRecipient(input: {
    lastName: string;
    name: string;
    middleName: string | null;
    phone10: string;
  }): Promise<string> {
    const body = await this.request<{ recipient_id?: string }>('POST', '/customer_recipient', {
      name: input.name,
      last_name: input.lastName,
      middle_name: input.middleName ?? '',
      phone: input.phone10,
      avatar: '1',
    });
    if (!body.recipient_id) throw new RaketaApiError('RAKETA не вернула ID получателя.');
    return body.recipient_id;
  }

  /** Creates a CDEK pickup-point address. Returns its id. */
  async createCdekAddress(input: {
    title: string;
    cityId: string;
    city: string;
    region: string | null;
    pvzCode: string;
    pvzIndex: string | null;
    street: string;
  }): Promise<string> {
    const body = await this.request<{ address_id?: string }>('POST', '/customer_address', {
      title: input.title.slice(0, 190),
      country: 'Россия',
      city_id: input.cityId,
      city: input.city,
      region: input.region ?? input.city,
      tk: 'cdek',
      delivery_type: 'pvz',
      tariff_code: RAKETA_CDEK_TARIFF_CODE,
      pvz_code: input.pvzCode,
      index: input.pvzIndex ?? '',
      street: input.street,
      full_address: '',
      house_number: '',
      apartment: '',
      entrance_number: '',
      intercom_code: '',
      floor_number: '',
      is_apartment: false,
    });
    if (!body.address_id) throw new RaketaApiError('RAKETA не вернула ID адреса.');
    return body.address_id;
  }

  /** Groups several orders into one consolidation with recipient + address. */
  async createConsolidation(input: {
    title: string;
    orderIds: string[];
    recipientId: string;
    addressId: string;
  }): Promise<string> {
    const body = await this.request<{ consolidation_id?: string }>('POST', '/consolidation', {
      insurance: false,
      orders: input.orderIds.map((id) => ({ id })),
      customer_address_id: input.addressId,
      customer_recipient_id: input.recipientId,
      tc_tariff_token: null,
      additional_services: [],
      title: input.title.slice(0, 250),
      tk_city_list_id: null,
    });
    if (!body.consolidation_id) throw new RaketaApiError('RAKETA не вернула ID объединения.');
    return body.consolidation_id;
  }

  /** Sets recipient + address on a single (not consolidated) order. */
  async assignOrderDelivery(input: {
    orderId: string;
    declarantId: string;
    recipientId: string;
    addressId: string;
  }): Promise<void> {
    const res = await this.request<{ data: RaketaOrderDetails }>(
      'GET',
      `/customer_order/${encodeURIComponent(input.orderId)}`,
    );
    const order = res.data;
    await this.request('PUT', `/customer_order/${encodeURIComponent(input.orderId)}`, {
      title: order.title,
      china_track_number: order.china_track_number,
      seller_id: order.seller?.id ?? null,
      declarant_id: input.declarantId,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        link: item.link,
        item_title: item.item_title,
        discription_cn: item.discription_cn,
        count: item.count,
        price_cn: item.price_cn,
        additional_services: [],
      })),
      additional_services: (order.additional_services ?? []).map((service) => service),
      delivery_type: null,
      receive_type: null,
      customer_recipient_id: input.recipientId,
      customer_address_id: input.addressId,
      tc_tariff_token: null,
      consolidation_id: null,
      draft: false,
    });
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
