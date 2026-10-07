import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { DELIVERY_HUBS, type DeliveryHub, hubForRegion } from '../data/delivery-hubs';
import type { DeliveryPriceBand } from '../data/delivery-price-table.data';

const CALC_URL = 'https://calculator.my.raketacn.ru/api';
const CDEK_TK_ID = '78cbeab6-821e-48c8-9c2e-028a1ea99805';
const MOSCOW_CITY_ID = DELIVERY_HUBS.moscow.cityId;
const VOLUMETRIC_DIVISOR = 5000;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const chargeKg = (p: { l: number; w: number; h: number; kg: number }) =>
  Math.max(p.kg, (p.l * p.w * p.h) / VOLUMETRIC_DIVISOR);

/**
 * Reference parcels (T-shirt, kids' shoes, adult sneakers, a heavy jacket box).
 * CDEK isn't linear in weight (light parcels hit a regional minimum), so the RF
 * leg is interpolated piecewise between these. Changing the list invalidates
 * stored rows (length check below).
 */
const REFS = [
  { l: 30, w: 22, h: 4, kg: 0.25 },
  { l: 26, w: 18, h: 12, kg: 0.5 },
  { l: 38, w: 26, h: 15.5, kg: 1.4 },
  { l: 48, w: 38, h: 22, kg: 2.5 },
];
const REF_KG = REFS.map(chargeKg);

/** RF-leg rubles for each reference parcel. */
type CityRates = number[];

/** Turns a Moscow table price into the price for the client's city. */
export type DeliveryAdjuster = (band: DeliveryPriceBand, moscowRub: number) => number;

/**
 * The delivery table is priced to Moscow. For other regions only the CDEK leg
 * differs (it can be cheaper — e.g. Novosibirsk — or dearer). The client's
 * region maps to the nearest million-plus city (`delivery-hubs.ts`); per hub
 * we ask the public RAKETA calculator for four reference parcels once every
 * 30 days (≈5 s, in parallel; stored in `delivery_city_rates`) and shift every band
 * by the difference of the interpolated RF legs. No region → Moscow.
 * Only the cheapest pickup-point tariff («Стандарт») is used.
 */
@Injectable()
export class RegionalDeliveryService {
  private readonly logger = new Logger(RegionalDeliveryService.name);
  private readonly memory = new Map<string, { rates: CityRates; at: number }>();
  private readonly inFlight = new Map<string, Promise<CityRates>>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Price point for a client's region and the adjuster for it; the adjuster
   * is null for Moscow (or when the calculator is down — Moscow prices then).
   */
  async forRegion(
    region: string | null | undefined,
    city?: string | null,
  ): Promise<{ hub: DeliveryHub; adjust: DeliveryAdjuster | null }> {
    const hub = hubForRegion(region, city);
    if (hub.cityId === MOSCOW_CITY_ID) return { hub, adjust: null };
    const adjust = await this.getAdjuster(hub.cityId);
    return { hub: adjust ? hub : DELIVERY_HUBS.moscow, adjust };
  }

  private async getAdjuster(cityId: string): Promise<DeliveryAdjuster | null> {
    try {
      const [city, moscow] = await Promise.all([this.getRates(cityId), this.getRates(MOSCOW_CITY_ID)]);
      return (band, moscowRub) => {
        const [l, w, h] = band.dims.split('×').map(Number);
        const kg = l && w && h ? chargeKg({ l, w, h, kg: band.kg }) : band.kg;
        const delta = interpolate(city, kg) - interpolate(moscow, kg);
        // Never below half of the Moscow price — it's an estimate, not a quote.
        return Math.max(Math.round(moscowRub / 2), Math.round(moscowRub + delta));
      };
    } catch (error) {
      this.logger.warn(`Regional rates for ${cityId} unavailable: ${String(error)}`);
      return null;
    }
  }

  /** Fire-and-forget: fetch a region's hub rates ahead of checkout. */
  warm(region: string | null | undefined, city?: string | null): void {
    void this.forRegion(region, city);
  }

  private async getRates(cityId: string): Promise<CityRates> {
    const cached = this.memory.get(cityId);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.rates;

    const row = await this.prisma.deliveryCityRate.findUnique({ where: { cityId } });
    const stored = isRates(row?.points) ? row?.points : null;
    if (row && stored && Date.now() - row.updatedAt.getTime() < TTL_MS) {
      this.memory.set(cityId, { rates: stored, at: row.updatedAt.getTime() });
      return stored;
    }

    let pending = this.inFlight.get(cityId);
    if (!pending) {
      pending = (async () => {
        try {
          const rates = await Promise.all(REFS.map((ref) => this.fetchRfLeg(cityId, ref)));
          await this.prisma.deliveryCityRate.upsert({
            where: { cityId },
            create: { cityId, points: rates },
            update: { points: rates },
          });
          this.memory.set(cityId, { rates, at: Date.now() });
          return rates;
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

  /** RF leg of the cheapest CDEK pickup-point tariff for a parcel, in rubles. */
  private async fetchRfLeg(cityId: string, p: { l: number; w: number; h: number; kg: number }): Promise<number> {
    const query = new URLSearchParams({
      city_id: cityId,
      sumoc: '0',
      length: String(p.l),
      width: String(p.w),
      height: String(p.h),
      weight: String(p.kg),
      is_insurance: 'false',
    });
    const res = await fetch(`${CALC_URL}/tk_calculate/${CDEK_TK_ID}?${query}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'application/json' },
    });
    const body = (await res.json().catch(() => null)) as {
      russian_transportation_price?: {
        cdek?: { pvz?: Array<{ tariff_name?: string; price_delivery_ru?: number; unavailable_reason?: unknown }> };
      };
    } | null;
    const tariffs = (body?.russian_transportation_price?.cdek?.pvz ?? []).filter((t) => !t.unavailable_reason);
    // Cheapest pickup-point tariff («Стандарт»; «Экспресс» is ~2× dearer).
    const tariff = tariffs
      .filter((t) => typeof t.price_delivery_ru === 'number')
      .sort((a, b) => (a.price_delivery_ru as number) - (b.price_delivery_ru as number))[0];
    if (!res.ok || typeof tariff?.price_delivery_ru !== 'number') {
      throw new Error(`calculator HTTP ${res.status}: no CDEK pickup tariff`);
    }
    return Math.round(tariff.price_delivery_ru / 100);
  }
}

function isRates(value: unknown): value is CityRates {
  return Array.isArray(value) && value.length === REFS.length && value.every((v) => typeof v === 'number');
}

/** Piecewise-linear RF leg at a chargeable weight (extends the end segments). */
function interpolate(rates: CityRates, kg: number): number {
  let i = 0;
  while (i < REF_KG.length - 2 && kg > REF_KG[i + 1]) i++;
  const [k0, k1] = [REF_KG[i], REF_KG[i + 1]];
  return rates[i] + ((rates[i + 1] - rates[i]) * (kg - k0)) / (k1 - k0);
}
