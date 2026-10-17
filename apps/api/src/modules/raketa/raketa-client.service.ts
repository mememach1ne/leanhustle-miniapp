import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** An item service as the cabinet sends it (photo report). */
export interface RaketaItemServicePayload {
  item_additional_service_list_id: string;
  need_comment: boolean;
  comment: string;
  price: string | null;
  name: string;
}

/** An order service as the cabinet sends it (extra packaging). */
export interface RaketaOrderServicePayload {
  id: string;
  additional_service_list_id: string;
  name: string;
  price: string | null;
  selected: true;
  [key: string]: unknown;
}

export interface RaketaOrderItemPayload {
  link: string;
  item_title: string;
  discription_cn: string;
  count: number;
  price_cn: string;
  additional_services: unknown[];
}

export interface RaketaCreateOrderPayload {
  title: string;
  china_track_number: string;
  seller_id: number;
  declarant_id: string;
  items: RaketaOrderItemPayload[];
  additional_services: unknown[];
  delivery_type: string | null;
  receive_type: string | null;
  customer_recipient_id: string | null;
  customer_address_id: string | null;
  tc_tariff_token: string | null;
  consolidation_id: string | null;
  draft: boolean;
  /** "Защита от рисков" (1% of the goods value). */
  insurance?: boolean;
}

export interface RaketaOrder {
  id: string;
  title: string;
  raketa_track_number?: string | null;
  china_track_number?: string | null;
  /** CDEK track for the RF leg (appears once paid). */
  tk_track_number?: string | null;
  stage_name?: string | null;
}

/** Public tracking of a RAKETA number (RA… item / RAC… consolidation). */
export interface RaketaTracking {
  /** Events, oldest first: { id: 'china_arrived_at_RAKETA_warehouse_in_China', name, created_at }. */
  events: Array<{ id: string; name: string; at: string }>;
  /** RAKETA's 7 milestones (Создан … Доставлен) with their state. */
  line: Array<{ name: string; active: boolean }>;
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

export interface RaketaOrderDetails extends RaketaOrder {
  /** The consolidation this order is in (null when it ships alone). */
  consolidation_id?: string | null;
  seller?: { id: number } | null;
  additional_services?: unknown[];
  items?: Array<{
    id: string;
    link: string;
    item_title: string;
    discription_cn: string;
    count: number;
    price_cn: string;
    /** Item services; a photo report carries its photo URLs in \`items\`. */
    additional_services?: Array<{
      item_additional_service_list_id?: string;
      name?: string;
      items?: unknown[];
      [key: string]: unknown;
    }>;
  }>;
}

/** Carriers of the RF leg as RAKETA names them (tk) and their ids. */
export const RAKETA_TK = {
  cdek: '78cbeab6-821e-48c8-9c2e-028a1ea99805',
  pochta: '380dcf2c-dd8a-4b10-8a65-62a4f8fbc667',
  raketa: '9e2f24eb-f7ee-4dde-9dc0-327cf7e7b3ed',
} as const;
export type RaketaCarrier = keyof typeof RAKETA_TK;

/** A pickup point or a door, with the carrier and tariff (STND | EXPR | ECON). */
export interface RaketaAddressInput {
  title: string;
  cityId: string;
  city: string;
  region: string | null;
  carrier: RaketaCarrier;
  kind: 'pvz' | 'courier';
  tariff: string;
  pvzCode?: string | null;
  pvzIndex?: string | null;
  /** Pickup point address text (pvz). */
  street: string;
  courier?: {
    fullAddress: string;
    street: string;
    house: string;
    index: string;
    apartment?: string | null;
    entrance?: string | null;
    floor?: string | null;
    intercom?: string | null;
    privateHouse?: boolean;
  } | null;
}

/** RAKETA's catalog of extra services. */
export interface RaketaServiceCatalog {
  order: Array<{ id: string; name: string; img: string; price: string | null; is_insurance?: boolean; [key: string]: unknown }>;
  item: Array<{ id: string; name: string; img: string; price: string | null; need_comment?: boolean }>;
}

/** House suggestion from RAKETA's address directory (for a courier). */
export interface RaketaAddressSuggestion {
  street_with_type: string | null;
  full_adress: string;
  index: string | null;
  city: string | null;
  street: string | null;
  house_number: string | null;
}

export interface RaketaConsolidation {
  id: string;
  title?: string | null;
  /** RAC… — the consolidation's own tracking number. */
  raketa_track_number?: string | null;
  /** CDEK track for the RF leg (appears once paid). */
  tk_track_number?: string | null;
  stage_name?: string | null;
  pay_date?: string | null;
  orders?: Array<{ id: string; stage_name?: string | null }>;
  controls?: { consolidation_close?: boolean } | null;
}

/** One line of RAKETA's price ("Международная доставка", "Доставка по РФ", пошлина, услуги). */
export interface RaketaPriceLine {
  id?: string | null;
  name: string;
  sum: number | string | null;
  count?: number | null;
}

export interface RaketaPrice {
  price?: RaketaPriceLine[];
  services?: RaketaPriceLine[];
  discounts?: RaketaPriceLine[];
  total?: number | string | null;
  controls?: {
    pay_button?: boolean;
    await_price?: boolean;
    paid_button?: boolean;
    select_tk?: boolean;
  } | null;
}

/** RAKETA's stage of an order that has arrived at the China warehouse. */
export const RAKETA_STAGE_AT_WAREHOUSE = 'На складе в Китае';

/** "1 234,50 ₽" / "+1234.5" / 1234.5 → 1234.5 */
export function parseMoney(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s| /g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
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
  private readonly carriersCache = new Map<string, { value: { pvz: RaketaCarrier[]; kd: RaketaCarrier[] }; expiresAt: number }>();
  private servicesCache: { value: RaketaServiceCatalog; expiresAt: number } | null = null;
  private readonly trackingCache = new Map<string, { value: RaketaTracking; expiresAt: number }>();

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
  getCdekPickupPoints(cityId: string): Promise<RaketaPickupPoint[]> {
    return this.getPickupPoints('cdek', cityId);
  }

  /** Pickup points of a carrier in a city (CDEK / post offices / RAKETA's own). Cached for 12 hours. */
  async getPickupPoints(carrier: RaketaCarrier, cityId: string): Promise<RaketaPickupPoint[]> {
    const key = `${carrier}:${cityId}`;
    const cached = this.pvzCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const tk = RAKETA_TK[carrier];
    const tariffs = await this.request<{ data?: Array<{ id: string; tariff_code: string }> }>(
      'GET',
      `/get_tariff_list/${tk}/pvz/${encodeURIComponent(cityId)}`,
    );
    const list = tariffs.data ?? [];
    const tariff = list.find((t) => t.tariff_code === RAKETA_CDEK_TARIFF_CODE) ?? list[0];
    if (!tariff) return [];
    const body = await this.request<{ data?: RaketaPickupPoint[] }>(
      'GET',
      `/pvz_list/${tk}/${encodeURIComponent(cityId)}/${tariff.id}`,
    );
    const value = body.data ?? [];
    this.pvzCache.set(key, { value, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    return value;
  }

  /** Carriers that deliver to a city: with pickup points (pvz) and by courier (kd). Cached for 12 hours. */
  async getCityCarriers(cityId: string): Promise<{ pvz: RaketaCarrier[]; kd: RaketaCarrier[] }> {
    const cached = this.carriersCache.get(cityId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const body = await this.request<{ data?: { pvz?: Array<{ id: string }>; kd?: Array<{ id: string }> } }>(
      'GET',
      `/tk_by_city/${encodeURIComponent(cityId)}`,
    );
    const known = (list?: Array<{ id: string }>) =>
      (Object.keys(RAKETA_TK) as RaketaCarrier[]).filter((c) => (list ?? []).some((x) => x.id === RAKETA_TK[c]));
    const value = { pvz: known(body.data?.pvz), kd: known(body.data?.kd) };
    this.carriersCache.set(cityId, { value, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    return value;
  }

  /** House suggestions for a courier address («Москва Тверская 13»). */
  async suggestAddress(text: string): Promise<RaketaAddressSuggestion[]> {
    const body = await this.request<RaketaAddressSuggestion[] | { data?: RaketaAddressSuggestion[] }>(
      'GET',
      `/get_address?address=${encodeURIComponent(text)}`,
    );
    return Array.isArray(body) ? body : (body.data ?? []);
  }

  /** Whether a carrier's courier serves this postal index in the city. */
  async courierServes(carrier: RaketaCarrier, cityId: string, index: string): Promise<boolean> {
    try {
      await this.request('GET', `/kd_list/${RAKETA_TK[carrier]}/${encodeURIComponent(cityId)}/${encodeURIComponent(index)}`);
      return true;
    } catch (error) {
      if (error instanceof RaketaApiError && error.status === 422) return false;
      throw error;
    }
  }

  /** Extra services (packaging, photo report…). Cached for 6 hours. */
  async getServiceCatalog(): Promise<RaketaServiceCatalog> {
    if (this.servicesCache && this.servicesCache.expiresAt > Date.now()) return this.servicesCache.value;
    const body = await this.request<{
      data?: { additional_service_list?: RaketaServiceCatalog['order']; item_additional_service_list?: RaketaServiceCatalog['item'] };
    }>('GET', '/get_additional_service_list');
    const value = { order: body.data?.additional_service_list ?? [], item: body.data?.item_additional_service_list ?? [] };
    this.servicesCache = { value, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
    return value;
  }

  /** Order service «extra packaging» (box / crate) in the cabinet's format. */
  async packagingService(kind: 'box' | 'crate'): Promise<RaketaOrderServicePayload> {
    const img = kind === 'box' ? 'box' : 'package';
    const s = (await this.getServiceCatalog()).order.find((x) => x.img === img);
    if (!s) throw new RaketaApiError(`В RAKETA нет услуги «${kind === 'box' ? 'Дополнительная коробка' : 'Обрешётка'}».`);
    return { ...s, additional_service_list_id: s.id, selected: true };
  }

  /** Item service «photo report» (basic / individual with a comment) in the cabinet's format. */
  async photoReportService(kind: 'basic' | 'individual', comment?: string | null): Promise<RaketaItemServicePayload> {
    const img = kind === 'basic' ? 'photoreport' : 'individual_photoreport';
    const s = (await this.getServiceCatalog()).item.find((x) => x.img === img);
    if (!s) throw new RaketaApiError('В RAKETA нет услуги «Фотоотчёт».');
    return {
      item_additional_service_list_id: s.id,
      need_comment: Boolean(s.need_comment),
      comment: s.need_comment ? (comment ?? '').slice(0, 500) : '',
      price: s.price,
      name: s.name,
    };
  }

  /** Existing recipient with the same full name and phone, or a new one. */
  async findOrCreateRecipient(input: {
    lastName: string;
    name: string;
    middleName: string | null;
    phone10: string;
  }): Promise<string> {
    const norm = (v?: string | null) => (v ?? '').trim().toLowerCase().replace(/ё/g, 'е');
    for (let offset = 0; offset < 30; offset++) {
      const body = await this.request<{
        data?: Array<{ id: string; name: string; last_name: string; middle_name: string | null; phone: string }>;
      }>('GET', `/customer_recipients?${new URLSearchParams({ offset: String(offset), text: input.lastName })}`);
      const list = body.data ?? [];
      const hit = list.find(
        (r) =>
          norm(r.last_name) === norm(input.lastName) &&
          norm(r.name) === norm(input.name) &&
          norm(r.middle_name) === norm(input.middleName) &&
          (r.phone ?? '').replace(/\D/g, '').endsWith(input.phone10),
      );
      if (hit) return hit.id;
      if (list.length < 10) break;
    }
    return this.createRecipient(input);
  }

  /** Existing (active) CDEK address for this pickup point, or a new one. */
  findOrCreateCdekAddress(input: Parameters<RaketaClientService['createCdekAddress']>[0]): Promise<string> {
    return this.findOrCreateAddress({ ...input, carrier: 'cdek', kind: 'pvz', tariff: RAKETA_CDEK_TARIFF_CODE });
  }

  /**
   * Existing (active) address with the same carrier, kind, tariff and point
   * (or door), or a new one. The tariff lives in the address — that's how
   * RAKETA knows Стандарт vs Экспресс.
   */
  async findOrCreateAddress(input: RaketaAddressInput): Promise<string> {
    const pvz = (input.pvzCode ?? '').toUpperCase();
    const door = input.courier;
    let firstId: string | undefined;
    for (let offset = 0; offset < 30; offset++) {
      const body = await this.request<{
        data?: Array<{
          id: string;
          tk: string;
          delivery_type: string | null;
          tariff_code: string | null;
          pvz_code: string | null;
          index: string | null;
          house_number: string | null;
          apartment: string | null;
          street: string | null;
          city_id: string | null;
          disabled?: boolean;
        }>;
      }>('GET', `/customer_addresses_full?offset=${offset}`);
      const list = body.data ?? [];
      // Stop if the endpoint ignores paging and keeps returning the same page.
      if (offset > 0 && list[0]?.id === firstId) break;
      firstId ??= list[0]?.id;
      const hit = list.find((a) => {
        if (a.disabled || a.tk !== input.carrier || (a.tariff_code ?? 'STND') !== input.tariff) return false;
        if (input.kind === 'pvz') return a.delivery_type === 'pvz' && (a.pvz_code ?? '').toUpperCase() === pvz;
        return (
          a.delivery_type === 'kd' &&
          a.city_id === input.cityId &&
          (a.index ?? '') === (door?.index ?? '') &&
          (a.street ?? '') === (door?.street ?? '') &&
          (a.house_number ?? '') === (door?.house ?? '') &&
          (a.apartment ?? '') === (door?.apartment ?? '')
        );
      });
      if (hit) return hit.id;
      if (list.length < 10) break;
    }
    return this.createAddress(input);
  }

  /** Creates a pickup-point or courier address with its carrier and tariff. Returns its id. */
  async createAddress(input: RaketaAddressInput): Promise<string> {
    const door = input.courier;
    const isDoor = input.kind === 'courier';
    const body = await this.request<{ address_id?: string }>('POST', '/customer_address', {
      title: input.title.slice(0, 190),
      country: 'Россия',
      city_id: input.cityId,
      city: input.city,
      region: input.region ?? input.city,
      tk: input.carrier,
      delivery_type: isDoor ? 'kd' : 'pvz',
      tariff_code: input.tariff,
      pvz_code: isDoor ? '' : (input.pvzCode ?? ''),
      index: isDoor ? (door?.index ?? '') : (input.pvzIndex ?? ''),
      street: isDoor ? (door?.street ?? '') : input.street,
      full_address: isDoor ? (door?.fullAddress ?? '') : '',
      house_number: isDoor ? (door?.house ?? '') : '',
      apartment: isDoor && !door?.privateHouse ? (door?.apartment ?? '') : '',
      entrance_number: isDoor && !door?.privateHouse ? (door?.entrance ?? '') : '',
      intercom_code: isDoor && !door?.privateHouse ? (door?.intercom ?? '') : '',
      floor_number: isDoor && !door?.privateHouse ? (door?.floor ?? '') : '',
      is_apartment: Boolean(isDoor && door?.privateHouse),
    });
    if (!body.address_id) throw new RaketaApiError('RAKETA не вернула ID адреса.');
    return body.address_id;
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
  createCdekAddress(input: {
    title: string;
    cityId: string;
    city: string;
    region: string | null;
    pvzCode: string;
    pvzIndex: string | null;
    street: string;
  }): Promise<string> {
    return this.createAddress({ ...input, carrier: 'cdek', kind: 'pvz', tariff: RAKETA_CDEK_TARIFF_CODE });
  }

  /** Groups several orders into one consolidation with recipient + address. */
  async createConsolidation(input: {
    title: string;
    orderIds: string[];
    recipientId: string;
    addressId: string;
    insurance?: boolean;
  }): Promise<string> {
    const body = await this.request<{ consolidation_id?: string }>('POST', '/consolidation', {
      insurance: Boolean(input.insurance),
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
    insurance?: boolean;
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
        // Keep ordered services (photo report) — an empty list would cancel them.
        additional_services: item.additional_services ?? [],
      })),
      additional_services: (order.additional_services ?? []).map((service) => service),
      delivery_type: null,
      receive_type: null,
      customer_recipient_id: input.recipientId,
      customer_address_id: input.addressId,
      tc_tariff_token: null,
      consolidation_id: null,
      draft: false,
      insurance: Boolean(input.insurance),
    });
  }

  /**
   * Adds an item to an existing order — several goods that Poizon sent under
   * one China track live in one RAKETA order. Only before recipient/address
   * are set (the caller checks). `title` replaces the order title if given.
   */
  async addOrderItem(input: {
    orderId: string;
    declarantId: string;
    item: RaketaOrderItemPayload;
    title?: string;
  }): Promise<void> {
    const res = await this.request<{ data: RaketaOrderDetails & Record<string, unknown> }>(
      'GET',
      `/customer_order/${encodeURIComponent(input.orderId)}`,
    );
    const order = res.data;
    const same = (x: { link: string; item_title: string }) =>
      x.link === input.item.link && x.item_title === input.item.item_title;
    // Retry-safe: an earlier attempt may have added it already (response lost).
    if ((order.items ?? []).some(same)) return;
    const before = (order.items ?? []).length;
    const keep = (key: string) => (typeof order[key] === 'string' ? (order[key] as string) : null);
    await this.request('PUT', `/customer_order/${encodeURIComponent(input.orderId)}`, {
      title: (input.title ?? order.title).slice(0, 190),
      china_track_number: order.china_track_number,
      seller_id: order.seller?.id ?? null,
      declarant_id: input.declarantId,
      items: [
        ...(order.items ?? []).map((item) => ({
          id: item.id,
          link: item.link,
          item_title: item.item_title,
          discription_cn: item.discription_cn,
          count: item.count,
          price_cn: item.price_cn,
          additional_services: item.additional_services ?? [],
        })),
        input.item,
      ],
      additional_services: (order.additional_services ?? []).map((service) => service),
      delivery_type: null,
      receive_type: null,
      customer_recipient_id: keep('customer_recipient_id'),
      customer_address_id: keep('customer_address_id'),
      tc_tariff_token: null,
      consolidation_id: keep('consolidation_id'),
      draft: false,
      insurance: Boolean(order.insurance),
    });
    // Re-read: the item must be there now, exactly once more.
    const after = await this.getOrderDetails(input.orderId);
    if ((after.items ?? []).length !== before + 1 || !(after.items ?? []).some(same)) {
      throw new RaketaApiError(`RAKETA не добавила вещь в заказ ${after.raketa_track_number ?? input.orderId} — проверьте его в кабинете.`);
    }
  }

  /** Full order card: items, consolidation, tracks. */
  async getOrderDetails(id: string): Promise<RaketaOrderDetails> {
    const body = await this.request<{ data: RaketaOrderDetails }>('GET', `/customer_order/${encodeURIComponent(id)}`);
    return body.data;
  }

  async getOrder(id: string): Promise<RaketaOrder> {
    const body = await this.request<{ data: RaketaOrder }>('GET', `/customer_order/${encodeURIComponent(id)}`);
    return body.data;
  }

  /**
   * Public tracking (the cabinet's «Отследить заказ» widget, no login).
   * Cached for 10 minutes per number.
   */
  async getTracking(trackNumber: string): Promise<RaketaTracking> {
    const key = trackNumber.trim().toUpperCase();
    const cached = this.trackingCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const origin = this.baseUrl.replace(/\/api$/, '');
    const res = await fetch(`${origin}/api/get_statuses?${new URLSearchParams({ track_number: key })}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    });
    const body = (await res.json().catch(() => null)) as {
      data?: Array<{ id?: string; name?: string; created_at?: string }>;
      line?: Array<{ name?: string; active?: boolean }>;
    } | null;
    if (!res.ok || !body) throw new RaketaApiError(`RAKETA tracking ${key}: HTTP ${res.status}`, res.status);
    const value: RaketaTracking = {
      events: (body.data ?? [])
        .filter((e) => e.id && e.name)
        .map((e) => ({ id: String(e.id), name: String(e.name), at: String(e.created_at ?? '') })),
      line: (body.line ?? []).map((l) => ({ name: String(l.name ?? ''), active: Boolean(l.active) })),
    };
    if (this.trackingCache.size > 2000) this.trackingCache.clear();
    this.trackingCache.set(key, { value, expiresAt: Date.now() + 10 * 60 * 1000 });
    return value;
  }

  /** Not-yet-paid consolidations (all of them, ours or created by hand). */
  async listUnpaidConsolidations(maxPages = 3): Promise<Array<{ id: string; title?: string | null }>> {
    const result: Array<{ id: string; title?: string | null }> = [];
    for (let offset = 0; offset < maxPages; offset++) {
      const body = await this.request<{ data?: Array<{ id: string; title?: string | null }> }>(
        'GET',
        `/consolidations?${new URLSearchParams({ offset: String(offset), not_paid: 'true' })}`,
      );
      const list = body.data ?? [];
      result.push(...list.filter((c) => !result.some((r) => r.id === c.id)));
      if (list.length < 10) break;
    }
    return result;
  }

  async getConsolidation(id: string): Promise<RaketaConsolidation> {
    const body = await this.request<{ data: { consolidation: RaketaConsolidation } }>(
      'GET',
      `/consolidation/${encodeURIComponent(id)}`,
    );
    return body.data.consolidation;
  }

  /** The cabinet's «Собрать»: the warehouse packs the orders into one parcel. */
  async closeConsolidation(id: string): Promise<void> {
    await this.request('POST', `/close_consolidation/${encodeURIComponent(id)}`, {});
  }

  /**
   * Price lines + total + pay controls of a consolidation or a single order.
   * RAKETA sends amounts in kopecks (300865 = 3 008,65 ₽); returned in rubles.
   */
  async getPrice(kind: 'consolidation' | 'order', id: string): Promise<RaketaPrice> {
    const body = await this.request<{ data: RaketaPrice }>('GET', `/price/${kind}/${encodeURIComponent(id)}`);
    const toRub = (value: unknown) => {
      const kopecks = parseMoney(value);
      return kopecks === null ? null : Math.round(kopecks) / 100;
    };
    const lines = (list?: RaketaPriceLine[]) => list?.map((line) => ({ ...line, sum: toRub(line.sum) }));
    return {
      ...body.data,
      price: lines(body.data.price),
      services: lines(body.data.services),
      discounts: lines(body.data.discounts),
      total: toRub(body.data.total),
    };
  }

  /** Pays a consolidation / single order from the RAKETA balance. */
  async pay(kind: 'consolidation' | 'order', id: string): Promise<void> {
    await this.request('POST', `/pay/${encodeURIComponent(id)}/${kind}`, {});
  }

  /** Balance top-up: returns the payment page URL (anyone can pay it). */
  async createTopUp(amountRub: number): Promise<string> {
    const body = await this.request<{ returnUrl?: string; data?: { returnUrl?: string } }>('POST', '/billing', {
      amount: { value: String(amountRub) },
    });
    const url = body.returnUrl ?? body.data?.returnUrl;
    if (!url || !/^https:\/\//.test(url)) throw new RaketaApiError('RAKETA не вернула ссылку на оплату.');
    return url;
  }

  /**
   * Main (money) balance in rubles, without loyalty points. Client top-ups
   * only show up here — RAKETA's billing history lists charges and points.
   */
  async getMainBalance(): Promise<number> {
    const body = await this.request<{
      message?: { balance_details?: { main?: number | string } };
      data?: { balance_details?: { main?: number | string } };
    }>('GET', '/auth/me/');
    const main = parseMoney((body.message ?? body.data)?.balance_details?.main);
    if (main === null) throw new RaketaApiError('RAKETA не вернула баланс.');
    return main;
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
      const reason = describeError(json);
      // An expired token sometimes comes back as 400/403 «Срок действия токена истек» — log in again once.
      if (retry && reason && /токен|token/i.test(reason)) {
        this.token = null;
        return this.request<T>(method, path, body, false);
      }
      throw new RaketaApiError(`RAKETA ${method} ${path}: ${reason ?? `HTTP ${res.status}`}`, res.status);
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
