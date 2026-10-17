import type { DeliveryCarrier, DeliveryKind } from '@lean-poizon/shared';
import { DELIVERY_TARIFF_LABELS, deliveryMethodTitle } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { RAKETA_TK, RaketaClientService } from '../../raketa/raketa-client.service';
import { DELIVERY_HUBS, type DeliveryHub, hubForRegion } from '../data/delivery-hubs';
import type { DeliveryPriceBand } from '../data/delivery-price-table.data';

const CALC_URL = 'https://calculator.my.raketacn.ru/api';
const MOSCOW_CITY_ID = DELIVERY_HUBS.moscow.cityId;
const VOLUMETRIC_DIVISOR = 5000;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COURIER_CHECK_TTL_MS = 12 * 60 * 60 * 1000;

/** The table price is for this option to Moscow. */
export const BASE_OPTION_KEY = 'cdek:pvz:STND';

const chargeKg = (p: { l: number; w: number; h: number; kg: number }) =>
  Math.max(p.kg, (p.l * p.w * p.h) / VOLUMETRIC_DIVISOR);

/**
 * Reference parcels (T-shirt, kids' shoes, adult sneakers, a heavy jacket box).
 * Carriers aren't linear in weight (light parcels hit a regional minimum), so
 * the RF leg is interpolated piecewise between these. Changing the list
 * invalidates stored rows (length check below).
 */
const REFS = [
  { l: 30, w: 22, h: 4, kg: 0.25 },
  { l: 26, w: 18, h: 12, kg: 0.5 },
  { l: 38, w: 26, h: 15.5, kg: 1.4 },
  { l: 48, w: 38, h: 22, kg: 2.5 },
];
const REF_KG = REFS.map(chargeKg);
/** Days are quoted for the sneakers box. */
const DAYS_REF = 2;

/** RAKETA tariff names → codes (the address carries the code). Others (Тяжеловес) aren't offered. */
const TARIFF_CODES: Record<string, string> = { Стандарт: 'STND', Экспресс: 'EXPR', Эконом: 'ECON' };

/** One way to deliver to a city: RF-leg rubles per reference parcel + days. */
interface OptionRates {
  carrier: DeliveryCarrier;
  kind: DeliveryKind;
  tariff: string;
  speed: string;
  rates: number[];
  daysMin: number | null;
  daysMax: number | null;
}

/** Everything the calculator offers for a city, keyed "carrier:pvz|courier:TARIFF". */
interface CityQuotes {
  v: 2;
  options: Record<string, OptionRates>;
}

/** Turns a Moscow table price into the price for the client's city and option. */
export type DeliveryAdjuster = (band: DeliveryPriceBand, moscowRub: number) => number;

/** An option the client can pick for an address. */
export interface DeliveryOptionQuote {
  key: string;
  carrier: DeliveryCarrier;
  kind: DeliveryKind;
  tariff: string;
  speed: string;
  title: string;
  daysMin: number | null;
  daysMax: number | null;
  /** Null = the Moscow table price as is. */
  adjust: DeliveryAdjuster | null;
}

/** What an address needs for the option list. */
export interface DeliveryDestination {
  cityId?: string | null;
  city?: string | null;
  region?: string | null;
  carrier?: string | null;
  kind?: string | null;
  /** Postal index of the door (courier only). */
  courierIndex?: string | null;
}

export const optionKey = (carrier: string, kind: string, tariff: string) => `${carrier}:${kind}:${tariff}`;

export function optionTitle(carrier: DeliveryCarrier, kind: DeliveryKind, speed: string): string {
  const tariff = Object.keys(DELIVERY_TARIFF_LABELS).find((k) => DELIVERY_TARIFF_LABELS[k] === speed) ?? speed;
  return deliveryMethodTitle(carrier, kind, tariff);
}

/**
 * Delivery prices by region and by delivery method.
 *
 * The delivery table is priced to Moscow, CDEK pickup point, «Стандарт».
 * Only the RF leg differs between cities and methods, so per city we ask the
 * public RAKETA calculator for four reference parcels (every carrier that
 * serves the city, all its pickup/courier tariffs) once every 30 days, store
 * it in `delivery_city_rates` and shift every band by the difference of the
 * interpolated RF legs.
 *
 * Price level: the nearest million-plus city of the region (`delivery-hubs.ts`)
 * when it has the same option, else the city itself (e.g. the partner's own
 * points in the Far East). Availability and days: the client's own city.
 * No address → Moscow.
 */
@Injectable()
export class RegionalDeliveryService {
  private readonly logger = new Logger(RegionalDeliveryService.name);
  private readonly memory = new Map<string, { quotes: CityQuotes; at: number }>();
  private readonly inFlight = new Map<string, Promise<CityQuotes>>();
  private readonly courierChecks = new Map<string, { ok: boolean; at: number }>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaketaClientService) private readonly raketa: RaketaClientService,
  ) {}

  /**
   * Price point for a client's region and the adjuster for it (CDEK pickup
   * point, «Стандарт»); the adjuster is null for Moscow (or when the
   * calculator is down — Moscow prices then).
   */
  async forRegion(
    region: string | null | undefined,
    city?: string | null,
  ): Promise<{ hub: DeliveryHub; adjust: DeliveryAdjuster | null }> {
    const hub = hubForRegion(region, city);
    if (hub.cityId === MOSCOW_CITY_ID) return { hub, adjust: null };
    try {
      const [hubQuotes, moscow] = await Promise.all([this.getQuotes(hub.cityId), this.getQuotes(MOSCOW_CITY_ID)]);
      const adjust = makeAdjuster(hubQuotes.options[BASE_OPTION_KEY], moscow.options[BASE_OPTION_KEY]);
      return { hub: adjust ? hub : DELIVERY_HUBS.moscow, adjust };
    } catch (error) {
      this.logger.warn(`Regional rates for ${hub.name} unavailable: ${String(error)}`);
      return { hub: DELIVERY_HUBS.moscow, adjust: null };
    }
  }

  /**
   * Ways to deliver to an address, cheapest first within a carrier. An
   * address without a directory city gets CDEK «Стандарт» by region only.
   * A courier address gets the carriers whose courier serves its index.
   */
  async optionsFor(dest: DeliveryDestination): Promise<{ hub: DeliveryHub; options: DeliveryOptionQuote[] }> {
    const kind: DeliveryKind = dest.kind === 'courier' ? 'courier' : 'pvz';
    const carrier = (dest.carrier as DeliveryCarrier | null) ?? 'cdek';

    const fallback = async () => {
      const { hub, adjust } = await this.forRegion(dest.region, dest.city);
      return {
        hub,
        options: [
          {
            key: BASE_OPTION_KEY,
            carrier: 'cdek' as const,
            kind: 'pvz' as const,
            tariff: 'STND',
            speed: 'Стандарт',
            title: optionTitle('cdek', 'pvz', 'Стандарт'),
            daysMin: null,
            daysMax: null,
            adjust,
          },
        ],
      };
    };
    if (!dest.cityId) return fallback();

    const hub = hubForRegion(dest.region, dest.city);
    let city: CityQuotes;
    let hubQuotes: CityQuotes;
    let moscow: CityQuotes;
    try {
      [city, hubQuotes, moscow] = await Promise.all([
        this.getQuotes(dest.cityId),
        this.getQuotes(hub.cityId),
        this.getQuotes(MOSCOW_CITY_ID),
      ]);
    } catch (error) {
      this.logger.warn(`Delivery options for ${dest.city ?? dest.cityId} unavailable: ${String(error)}`);
      return fallback();
    }
    const base = moscow.options[BASE_OPTION_KEY];
    if (!base) return fallback();

    let candidates = Object.entries(city.options).filter(
      ([, o]) => o.kind === kind && (kind === 'courier' || o.carrier === carrier),
    );
    if (kind === 'courier') {
      const index = (dest.courierIndex ?? '').trim();
      const served = await Promise.all(
        candidates.map(([, o]) => (index ? this.courierServes(o.carrier, dest.cityId as string, index) : false)),
      );
      candidates = candidates.filter((_, i) => served[i]);
    }

    const options = candidates.map(([key, o]) => {
      // Price level of the hub when it has this option; the city's own otherwise.
      const priced = hubQuotes.options[key] ?? o;
      const isBase = key === BASE_OPTION_KEY && hub.cityId === MOSCOW_CITY_ID;
      return {
        key,
        carrier: o.carrier,
        kind: o.kind,
        tariff: o.tariff,
        speed: o.speed,
        title: optionTitle(o.carrier, o.kind, o.speed),
        daysMin: o.daysMin,
        daysMax: o.daysMax,
        adjust: isBase ? null : makeAdjuster(priced, base),
      };
    });
    // An «Экспресс» that isn't faster than «Стандарт» (it happens near China) is just noise.
    const filtered = options.filter((o) => {
      if (o.tariff !== 'EXPR') return true;
      const std = options.find((x) => x.carrier === o.carrier && x.kind === o.kind && x.tariff === 'STND');
      return !std || std.daysMax === null || o.daysMax === null || o.daysMax < std.daysMax;
    });
    const order = (o: DeliveryOptionQuote) => ['cdek', 'pochta', 'raketa'].indexOf(o.carrier) * 10 + (o.tariff === 'EXPR' ? 1 : 0);
    filtered.sort((a, b) => order(a) - order(b));
    return { hub, options: filtered };
  }

  /** Fire-and-forget: fetch a city's (and its hub's) quotes ahead of checkout. */
  warm(region: string | null | undefined, city?: string | null, cityId?: string | null): void {
    void this.forRegion(region, city);
    if (cityId) void this.getQuotes(cityId).catch(() => undefined);
  }

  private async courierServes(carrier: DeliveryCarrier, cityId: string, index: string): Promise<boolean> {
    const key = `${carrier}:${cityId}:${index}`;
    const cached = this.courierChecks.get(key);
    if (cached && Date.now() - cached.at < COURIER_CHECK_TTL_MS) return cached.ok;
    try {
      const ok = await this.raketa.courierServes(carrier, cityId, index);
      this.courierChecks.set(key, { ok, at: Date.now() });
      return ok;
    } catch (error) {
      this.logger.warn(`Courier check ${key} failed: ${String(error)}`);
      return false;
    }
  }

  private async getQuotes(cityId: string): Promise<CityQuotes> {
    const cached = this.memory.get(cityId);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.quotes;

    const row = await this.prisma.deliveryCityRate.findUnique({ where: { cityId } });
    const stored = isQuotes(row?.points) ? row.points : null;
    if (row && stored && Date.now() - row.updatedAt.getTime() < TTL_MS) {
      this.memory.set(cityId, { quotes: stored, at: row.updatedAt.getTime() });
      return stored;
    }

    let pending = this.inFlight.get(cityId);
    if (!pending) {
      pending = (async () => {
        try {
          const quotes = await this.fetchQuotes(cityId);
          if (!quotes.options[BASE_OPTION_KEY] && cityId === MOSCOW_CITY_ID) {
            throw new Error('calculator returned no CDEK pickup tariff for Moscow');
          }
          await this.prisma.deliveryCityRate.upsert({
            where: { cityId },
            create: { cityId, points: quotes as object },
            update: { points: quotes as object },
          });
          this.memory.set(cityId, { quotes, at: Date.now() });
          return quotes;
        } catch (error) {
          // Stale numbers are still better than Moscow prices.
          if (stored) return stored;
          throw error;
        } finally {
          this.inFlight.delete(cityId);
        }
      })();
      this.inFlight.set(cityId, pending);
    }
    return pending;
  }

  /** All carriers × tariffs for the reference parcels (≈ up to 12 calls in parallel). */
  private async fetchQuotes(cityId: string): Promise<CityQuotes> {
    const byCity = await this.calc<{ data?: { pvz?: Array<{ id: string }>; kd?: Array<{ id: string }> } }>(
      `/tk_by_city/${encodeURIComponent(cityId)}`,
    );
    const ids = new Set([...(byCity?.data?.pvz ?? []), ...(byCity?.data?.kd ?? [])].map((t) => t.id));
    const carriers = (Object.keys(RAKETA_TK) as DeliveryCarrier[]).filter((c) => ids.has(RAKETA_TK[c]));

    const options: Record<string, OptionRates> = {};
    await Promise.all(
      carriers.map(async (carrier) => {
        const perRef = await Promise.all(REFS.map((ref) => this.fetchLegs(carrier, cityId, ref)));
        // Keep options every reference parcel has a price for.
        for (const [key, first] of Object.entries(perRef[0])) {
          if (!perRef.every((r) => r[key])) continue;
          options[key] = {
            ...first,
            rates: perRef.map((r) => r[key].rub),
            daysMin: perRef[DAYS_REF][key].daysMin,
            daysMax: perRef[DAYS_REF][key].daysMax,
          };
        }
      }),
    );
    if (Object.keys(options).length === 0) throw new Error(`calculator returned no tariffs for ${cityId}`);
    return { v: 2, options };
  }

  /** RF leg of every pickup/courier tariff of a carrier for a parcel, in rubles. */
  private async fetchLegs(
    carrier: DeliveryCarrier,
    cityId: string,
    p: { l: number; w: number; h: number; kg: number },
  ): Promise<Record<string, Omit<OptionRates, 'rates'> & { rub: number }>> {
    const query = new URLSearchParams({
      city_id: cityId,
      sumoc: '0',
      length: String(p.l),
      width: String(p.w),
      height: String(p.h),
      weight: String(p.kg),
      is_insurance: 'false',
    });
    type Tariff = {
      tariff_name?: string;
      price_delivery_ru?: number;
      min?: number;
      max?: number;
      unavailable_reason?: unknown;
    };
    const body = await this.calc<{
      russian_transportation_price?: Record<string, { pvz?: Tariff[]; kd?: Tariff[] }>;
    }>(`/tk_calculate/${RAKETA_TK[carrier]}?${query}`);
    const out: Record<string, Omit<OptionRates, 'rates'> & { rub: number }> = {};
    for (const types of Object.values(body?.russian_transportation_price ?? {})) {
      for (const [type, kind] of [
        ['pvz', 'pvz'],
        ['kd', 'courier'],
      ] as const) {
        for (const t of types[type] ?? []) {
          const tariff = TARIFF_CODES[t.tariff_name ?? ''];
          if (!tariff || t.unavailable_reason || typeof t.price_delivery_ru !== 'number') continue;
          out[optionKey(carrier, kind, tariff)] = {
            carrier,
            kind,
            tariff,
            speed: t.tariff_name as string,
            rub: Math.round(t.price_delivery_ru / 100),
            daysMin: typeof t.min === 'number' ? t.min : null,
            daysMax: typeof t.max === 'number' ? t.max : null,
          };
        }
      }
    }
    return out;
  }

  private async calc<T>(path: string): Promise<T | null> {
    const res = await fetch(`${CALC_URL}${path}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`calculator HTTP ${res.status} for ${path.split('?')[0]}`);
    return (await res.json().catch(() => null)) as T | null;
  }
}

/** Shifts a Moscow table price by (option leg − Moscow CDEK «Стандарт» leg) at the band's weight. */
function makeAdjuster(option: OptionRates | undefined, base: OptionRates | undefined): DeliveryAdjuster | null {
  if (!option || !base) return null;
  return (band, moscowRub) => {
    const [l, w, h] = band.dims.split('×').map(Number);
    const kg = l && w && h ? chargeKg({ l, w, h, kg: band.kg }) : band.kg;
    const delta = interpolate(option.rates, kg) - interpolate(base.rates, kg);
    // Never below half of the Moscow price — it's an estimate, not a quote.
    return Math.max(Math.round(moscowRub / 2), Math.round(moscowRub + delta));
  };
}

function isQuotes(value: unknown): value is CityQuotes {
  if (!value || typeof value !== 'object' || (value as { v?: unknown }).v !== 2) return false;
  const options = (value as CityQuotes).options;
  return (
    Boolean(options) &&
    Object.values(options).every((o) => Array.isArray(o.rates) && o.rates.length === REFS.length)
  );
}

/** Piecewise-linear RF leg at a chargeable weight (extends the end segments). */
function interpolate(rates: number[], kg: number): number {
  let i = 0;
  while (i < REF_KG.length - 2 && kg > REF_KG[i + 1]) i++;
  const [k0, k1] = [REF_KG[i], REF_KG[i + 1]];
  return rates[i] + ((rates[i + 1] - rates[i]) * (kg - k0)) / (k1 - k0);
}
