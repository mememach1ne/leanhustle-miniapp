'use client';

import type {
  DeliveryCarrier,
  DeliveryCityDto,
  DeliveryCityOptionsDto,
  DeliveryPickupPoint,
  DeliveryPointDto,
  DeliveryStreetSuggestionDto,
} from '@lean-poizon/shared';
import { useEffect, useMemo, useState } from 'react';

import { deliveryPointsApi } from '../../lib/api-client';
import { extractAxiosMessage } from '../../lib/error-utils';
import { hapticSelection } from '../../lib/telegram-web-app';

const inputClass =
  'w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[var(--accent)] focus:outline-none';

export interface PickedPoint {
  pickupPoint: DeliveryPickupPoint;
  /** Human-readable address stored as cdekAddress, e.g. "Москва, Мичуринский пр-т, 16 (MSK1005)". */
  label: string;
}

type Method = DeliveryCarrier | 'courier';

const METHOD_LABELS: Record<Method, string> = {
  cdek: 'Пункт СДЭК',
  pochta: 'Почта России',
  raketa: 'Пункт выдачи партнёра',
  courier: 'Курьер до двери',
};

const METHOD_HINTS: Record<Method, string> = {
  cdek: 'Пункты выдачи СДЭК',
  pochta: 'Получение в почтовом отделении',
  raketa: 'Пункт выдачи нашего партнёра — доставка по городу бесплатно',
  courier: 'СДЭК или Почта привезут посылку домой',
};

/** The forwarder's brand never reaches the client. */
const clean = (text: string) => text.replace(/\s*raketa\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim();

/**
 * City search → how to receive (CDEK / post office / partner point / courier)
 * → pickup point list with a street filter, or a door address with house
 * suggestions. The directory comes from the forwarder (RAKETA), so the stored
 * point code / index is exactly what the order registration needs.
 */
export function PickupPointPicker({
  value,
  onChange,
}: {
  value: PickedPoint | null;
  onChange: (value: PickedPoint | null) => void;
}) {
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState<DeliveryCityDto[]>([]);
  const [city, setCity] = useState<DeliveryCityDto | null>(null);
  const [options, setOptions] = useState<DeliveryCityOptionsDto | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [points, setPoints] = useState<DeliveryPointDto[] | null>(null);
  const [pointQuery, setPointQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Courier form.
  const [streetQuery, setStreetQuery] = useState('');
  const [suggestions, setSuggestions] = useState<DeliveryStreetSuggestionDto[]>([]);
  const [house, setHouse] = useState<DeliveryStreetSuggestionDto | null>(null);
  const [apartment, setApartment] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [intercom, setIntercom] = useState('');
  const [privateHouse, setPrivateHouse] = useState(false);

  // Debounced city search.
  useEffect(() => {
    if (city || cityQuery.trim().length < 2) {
      setCities([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setError(null);
        setCities(await deliveryPointsApi.searchCities(cityQuery.trim()));
      } catch (err) {
        setError(extractAxiosMessage(err) ?? 'Не удалось найти город.');
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [cityQuery, city]);

  // Debounced house suggestions for a courier.
  useEffect(() => {
    if (method !== 'courier' || !city || house || streetQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setError(null);
        setSuggestions(await deliveryPointsApi.searchStreets(city.city, city.region, streetQuery.trim()));
      } catch (err) {
        setError(extractAxiosMessage(err) ?? 'Не удалось найти адрес.');
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [streetQuery, method, city, house]);

  const loadPoints = async (picked: DeliveryCityDto, carrier: DeliveryCarrier) => {
    setPoints(null);
    setPointQuery('');
    setLoading(true);
    setError(null);
    try {
      setPoints(await deliveryPointsApi.getPoints(picked.id, carrier));
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось загрузить пункты выдачи.');
    } finally {
      setLoading(false);
    }
  };

  const chooseMethod = (picked: DeliveryCityDto, next: Method) => {
    hapticSelection();
    setMethod(next);
    setHouse(null);
    setStreetQuery('');
    if (next === 'courier') {
      setPoints(null);
      setLoading(false);
      return;
    }
    void loadPoints(picked, next);
  };

  const pickCity = async (picked: DeliveryCityDto) => {
    hapticSelection();
    setCity(picked);
    setCityQuery(picked.city);
    setCities([]);
    setPoints(null);
    setMethod(null);
    setOptions(null);
    setLoading(true);
    setError(null);
    try {
      const found = await deliveryPointsApi.getCityOptions(picked.id);
      setOptions(found);
      // CDEK first — what most clients want; the others are one tap away.
      const first: Method | undefined = found.pvz.includes('cdek') ? 'cdek' : (found.pvz[0] ?? (found.courier ? 'courier' : undefined));
      if (first) chooseMethod(picked, first);
      else setLoading(false);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось загрузить способы получения.');
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!points) return [];
    const q = pointQuery.trim().toLowerCase();
    return q ? points.filter((p) => `${p.address} ${p.code}`.toLowerCase().includes(q)) : points;
  }, [points, pointQuery]);

  const pickPoint = (point: DeliveryPointDto) => {
    if (!city || !method || method === 'courier') return;
    hapticSelection();
    const address = clean(point.address);
    const label =
      method === 'cdek'
        ? `${city.city}, ${address} (${point.code})`
        : method === 'pochta'
          ? `${city.city}, Почта России: ${address}${point.index ? ` (${point.index})` : ''}`
          : `${city.city}, пункт выдачи: ${address}`;
    onChange({
      pickupPoint: {
        cityId: city.id,
        city: city.city,
        region: city.region,
        kind: 'pvz',
        carrier: method,
        pvzCode: point.code,
        pvzIndex: point.index,
      },
      label,
    });
  };

  const saveCourier = () => {
    if (!city || !house) return;
    hapticSelection();
    const flat = privateHouse ? '' : apartment.trim();
    onChange({
      pickupPoint: {
        cityId: city.id,
        city: city.city,
        region: city.region,
        kind: 'courier',
        carrier: 'cdek',
        pvzCode: '',
        pvzIndex: house.index,
        courier: {
          fullAddress: house.fullAddress,
          street: house.street,
          house: house.house,
          index: house.index,
          apartment: flat || null,
          entrance: privateHouse ? null : entrance.trim() || null,
          floor: privateHouse ? null : floor.trim() || null,
          intercom: privateHouse ? null : intercom.trim() || null,
          privateHouse,
        },
      },
      label: `${house.fullAddress}${flat ? `, кв. ${flat}` : privateHouse ? ', частный дом' : ''} (курьер)`,
    });
  };

  const reset = () => {
    onChange(null);
    setCity(null);
    setCityQuery('');
    setPoints(null);
    setOptions(null);
    setMethod(null);
    setHouse(null);
    setStreetQuery('');
  };

  if (value) {
    return (
      <div className="rounded-[16px] border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3">
        <p className="text-sm font-semibold text-white">{value.label}</p>
        <button type="button" onClick={reset} className="mt-1 text-xs font-semibold text-[var(--accent)]">
          Выбрать другой адрес
        </button>
      </div>
    );
  }

  const methods: Method[] = options ? [...options.pvz, ...(options.courier ? (['courier'] as const) : [])] : [];
  const courierReady = Boolean(house) && (privateHouse || apartment.trim().length > 0);

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={cityQuery}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setCity(null);
            setPoints(null);
            setOptions(null);
            setMethod(null);
          }}
          placeholder="Город, например Москва"
          className={inputClass}
          maxLength={64}
        />
        {cities.length > 0 ? (
          <div className="lg-surface-strong absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-[16px] p-1.5">
            {cities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCity(c)}
                className="block w-full rounded-[12px] px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/5"
              >
                {c.city}
                {c.region ? <span className="ml-1 text-xs text-[var(--muted)]">{c.region}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {city && methods.length > 1 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => chooseMethod(city, m)}
              className={[
                'rounded-[14px] border px-3 py-2 text-left text-xs transition',
                method === m
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300',
              ].join(' ')}
            >
              <span className="block font-semibold">{METHOD_LABELS[m]}</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-[var(--muted)]">{METHOD_HINTS[m]}</span>
            </button>
          ))}
        </div>
      ) : null}

      {city && options && methods.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">В этот город доставки нет. Выберите ближайший город.</p>
      ) : null}

      {loading ? <p className="text-xs text-[var(--muted)]">Загружаем…</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      {method && method !== 'courier' && points ? (
        points.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">В этом городе нет таких пунктов. Выберите другой способ или город.</p>
        ) : (
          <>
            <input
              type="text"
              value={pointQuery}
              onChange={(e) => setPointQuery(e.target.value)}
              placeholder={`Улица или индекс — ${points.length} пунктов`}
              className={inputClass}
            />
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-[16px] border border-white/10 bg-white/[0.03] p-1.5">
              {filtered.slice(0, 200).map((point) => (
                <button
                  key={`${point.code}-${point.address}`}
                  type="button"
                  onClick={() => pickPoint(point)}
                  className="block w-full rounded-[12px] px-3 py-2.5 text-left transition hover:bg-white/5 active:scale-[0.99]"
                >
                  <span className="block text-sm text-white">{clean(point.address)}</span>
                  <span className="block text-[11px] text-[var(--muted)]">
                    {method === 'cdek' ? point.code : (point.index ?? '')}
                    {point.workTime ? ` · ${point.workTime}` : ''}
                  </span>
                </button>
              ))}
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--muted)]">Ничего не найдено.</p>
              ) : null}
            </div>
          </>
        )
      ) : null}

      {method === 'courier' && city ? (
        <div className="space-y-2">
          {house ? (
            <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-white">{house.fullAddress}</p>
              <button
                type="button"
                onClick={() => {
                  setHouse(null);
                  setStreetQuery('');
                }}
                className="mt-1 text-xs font-semibold text-[var(--accent)]"
              >
                Изменить улицу и дом
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={streetQuery}
                onChange={(e) => setStreetQuery(e.target.value)}
                placeholder="Улица и дом, например Тверская 13"
                className={inputClass}
                maxLength={120}
              />
              {suggestions.length > 0 ? (
                <div className="lg-surface-strong absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-[16px] p-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.fullAddress}-${s.index}`}
                      type="button"
                      onClick={() => {
                        hapticSelection();
                        setHouse(s);
                        setSuggestions([]);
                      }}
                      className="block w-full rounded-[12px] px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/5"
                    >
                      {s.fullAddress}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {house ? (
            <>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={privateHouse}
                  onChange={(e) => setPrivateHouse(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Частный дом (без квартиры)
              </label>
              {!privateHouse ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Квартира"
                    inputMode="numeric"
                    className={inputClass}
                  />
                  <input
                    value={entrance}
                    onChange={(e) => setEntrance(e.target.value.slice(0, 10))}
                    placeholder="Подъезд"
                    className={inputClass}
                  />
                  <input
                    value={floor}
                    onChange={(e) => setFloor(e.target.value.slice(0, 10))}
                    placeholder="Этаж"
                    className={inputClass}
                  />
                  <input
                    value={intercom}
                    onChange={(e) => setIntercom(e.target.value.slice(0, 20))}
                    placeholder="Домофон"
                    className={inputClass}
                  />
                </div>
              ) : null}
              <button
                type="button"
                onClick={saveCourier}
                disabled={!courierReady}
                className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-50"
              >
                Выбрать этот адрес
              </button>
              <p className="text-[11px] leading-4 text-[var(--muted)]">
                Службу (СДЭК или Почта) и скорость выберете при оформлении заказа.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
