'use client';

import type { AdminAnalyticsActivityPoint, AdminAnalyticsResponse } from '@lean-poizon/shared';
import { useCallback, useEffect, useState } from 'react';

import { adminApi } from '../../lib/api-client';
import { extractAxiosMessage } from '../../lib/error-utils';
import { EmptyState } from './empty-state';
import { FeedbackMessage } from './feedback-message';
import { LoadingBlock } from './loading-block';
import { SectionCard } from './section-card';

const REFRESH_INTERVAL_MS = 30_000;

export function AnalyticsPanel() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await adminApi.getAnalytics();
      setData(result);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось загрузить аналитику');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      void load(true);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return <LoadingBlock title="Загрузка" description="Считаем активность..." />;
  }

  if (error && !data) {
    return <EmptyState title="Ошибка" description={error} />;
  }

  if (!data) return null;

  return (
    <>
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}

      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
      {/* Live activity */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Активность сейчас</h3>
            <p className="mt-1 text-[11px] text-white/40">
              Обновляется каждые 30 сек {updatedAt ? `· ${updatedAt.toLocaleTimeString('ru-RU')}` : ''}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            LIVE
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Онлайн (5 мин)" value={data.onlineNow} accent />
          <Stat label="Активные (30 мин)" value={data.online30m} />
        </div>
      </SectionCard>

      {/* Periodic activity */}
      <SectionCard>
        <h3 className="text-sm font-semibold text-white">Уникальные пользователи</h3>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="За сутки (DAU)" value={data.dau} />
          <Stat label="За неделю (WAU)" value={data.wau} />
          <Stat label="За месяц (MAU)" value={data.mau} />
        </div>
      </SectionCard>

      {/* Totals */}
      <SectionCard>
        <h3 className="text-sm font-semibold text-white">База пользователей</h3>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Всего" value={data.totalUsers} />
          <Stat label="Новых за сутки" value={data.newToday} accent={data.newToday > 0} />
        </div>
      </SectionCard>
      </div>

      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
      {/* Hourly chart */}
      <SectionCard>
        <h3 className="text-sm font-semibold text-white">Активность по часам (24ч)</h3>
        <p className="mt-1 text-[11px] text-white/40">
          Уникальные пользователи в час
        </p>
        <div className="mt-4">
          <ActivityChart points={data.hourly} labelFormat="hour" />
        </div>
      </SectionCard>

      {/* Daily chart */}
      <SectionCard>
        <h3 className="text-sm font-semibold text-white">Активность по дням (30 дней)</h3>
        <p className="mt-1 text-[11px] text-white/40">
          Уникальные пользователи в день
        </p>
        <div className="mt-4">
          <ActivityChart points={data.daily} labelFormat="day" />
        </div>
      </SectionCard>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-2xl px-3 py-3 transition',
        accent
          ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/30'
          : 'bg-white/5',
      ].join(' ')}
    >
      <p
        className={[
          'text-2xl font-bold',
          accent ? 'text-[var(--accent)]' : 'text-white',
        ].join(' ')}
      >
        {value.toLocaleString('ru-RU')}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}

function ActivityChart({
  points,
  labelFormat,
}: {
  points: AdminAnalyticsActivityPoint[];
  labelFormat: 'hour' | 'day';
}) {
  if (points.length === 0) {
    return <p className="text-xs text-white/40">Нет данных</p>;
  }

  const max = Math.max(1, ...points.map((p) => p.activeUsers));

  // Show ticks for first / middle / last point
  const tickIndexes = new Set([0, Math.floor(points.length / 2), points.length - 1]);

  const formatLabel = (iso: string) => {
    const d = new Date(iso);
    if (labelFormat === 'hour') {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {points.map((point, i) => {
          const heightPct = (point.activeUsers / max) * 100;
          return (
            <div
              key={point.bucket}
              className="group relative flex-1"
              title={`${formatLabel(point.bucket)} — ${point.activeUsers}`}
            >
              <div
                className={[
                  'mx-auto w-full rounded-t transition',
                  point.activeUsers > 0
                    ? 'bg-[var(--accent)]/70 hover:bg-[var(--accent)]'
                    : 'bg-white/10',
                ].join(' ')}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
              {tickIndexes.has(i) ? (
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-white/40">
                  {formatLabel(point.bucket)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between text-[10px] text-white/40">
        <span>Макс: {max}</span>
        <span>Сумма: {points.reduce((acc, p) => acc + p.activeUsers, 0)}</span>
      </div>
    </div>
  );
}
