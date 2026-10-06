'use client';

import type { DeliveryCityDto, DeliveryPickupPoint, DeliveryPointDto } from '@lean-poizon/shared';
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

/**
 * City search → list of CDEK pickup points (with a street filter). The
 * directory comes from the forwarder (RAKETA), so the stored point code is
 * exactly what the order registration needs.
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
  const [points, setPoints] = useState<DeliveryPointDto[] | null>(null);
  const [pointQuery, setPointQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const pickCity = async (picked: DeliveryCityDto) => {
    hapticSelection();
    setCity(picked);
    setCityQuery(picked.city);
    setCities([]);
    setPoints(null);
    setPointQuery('');
    setLoading(true);
    setError(null);
    try {
      setPoints(await deliveryPointsApi.getCdekPoints(picked.id));
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось загрузить пункты СДЭК.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!points) return [];
    const q = pointQuery.trim().toLowerCase();
    return q ? points.filter((p) => `${p.address} ${p.code}`.toLowerCase().includes(q)) : points;
  }, [points, pointQuery]);

  const pickPoint = (point: DeliveryPointDto) => {
    if (!city) return;
    hapticSelection();
    onChange({
      pickupPoint: {
        cityId: city.id,
        city: city.city,
        region: city.region,
        pvzCode: point.code,
        pvzIndex: point.index,
      },
      label: `${city.city}, ${point.address} (${point.code})`,
    });
  };

  if (value) {
    return (
      <div className="rounded-[16px] border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3">
        <p className="text-sm font-semibold text-white">{value.label}</p>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setCity(null);
            setCityQuery('');
            setPoints(null);
          }}
          className="mt-1 text-xs font-semibold text-[var(--accent)]"
        >
          Выбрать другой пункт
        </button>
      </div>
    );
  }

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

      {loading ? <p className="text-xs text-[var(--muted)]">Загружаем пункты СДЭК…</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      {points ? (
        points.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">В этом городе нет пунктов СДЭК. Выберите ближайший город.</p>
        ) : (
          <>
            <input
              type="text"
              value={pointQuery}
              onChange={(e) => setPointQuery(e.target.value)}
              placeholder={`Улица или метро — ${points.length} пунктов`}
              className={inputClass}
            />
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-[16px] border border-white/10 bg-white/[0.03] p-1.5">
              {filtered.slice(0, 200).map((point) => (
                <button
                  key={point.code}
                  type="button"
                  onClick={() => pickPoint(point)}
                  className="block w-full rounded-[12px] px-3 py-2.5 text-left transition hover:bg-white/5 active:scale-[0.99]"
                >
                  <span className="block text-sm text-white">{point.address}</span>
                  <span className="block text-[11px] text-[var(--muted)]">
                    {point.code}
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
    </div>
  );
}
