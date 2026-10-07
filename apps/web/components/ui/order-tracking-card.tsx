'use client';

import type { OrderTrackingDto } from '@lean-poizon/shared';
import { useState } from 'react';

import { hapticNotification } from '../../lib/telegram-web-app';
import { MarketplaceLogo } from './marketplace-logo';
import { SectionCard } from './section-card';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
};

const EVENTS_PREVIEW = 4;

/** Parcel tracking: milestones, CDEK track (RAKETA numbers are never shown to clients), event history. */
export function OrderTrackingCard({ tracking }: { tracking: OrderTrackingDto }) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      hapticNotification('success');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      hapticNotification('error');
    }
  };

  const arrived = tracking.items.filter((item) => item.arrived).length;
  // Items matter until they're all at the warehouse (then the parcel is one box).
  const showItems = tracking.kind === 'consolidation' && !tracking.steps[1]?.done && tracking.items.length > 0;
  const events = showAllEvents ? tracking.events : tracking.events.slice(0, EVENTS_PREVIEW);

  return (
    <SectionCard>
      <h3 className="text-lg font-semibold text-white">Отслеживание посылки</h3>

      {tracking.cdekTrack ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => copy(tracking.cdekTrack!)}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-emerald-100 transition active:scale-[0.98]"
          >
            <MarketplaceLogo marketplace="cdek" className="h-5 w-5" />
            {copied === tracking.cdekTrack ? 'Скопировано!' : `СДЭК ${tracking.cdekTrack}`}
          </button>
          <a
            href={`https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(tracking.cdekTrack)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent)]"
          >
            Отследить на сайте СДЭК ↗
          </a>
        </div>
      ) : null}

      <ol className="mt-5 space-y-0">
        {tracking.steps.map((step, index) => {
          const isLast = index === tracking.steps.length - 1;
          return (
            <li key={step.name} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast ? (
                <span
                  className={`absolute left-[7px] top-4 h-full w-0.5 ${
                    tracking.steps[index + 1]?.done ? 'bg-[var(--accent)]' : 'bg-white/10'
                  }`}
                />
              ) : null}
              <span
                className={`relative mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                  step.done ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-white/20 bg-transparent'
                } ${step.current ? 'ring-4 ring-[var(--accent)]/25' : ''}`}
              />
              <span
                className={`text-sm ${
                  step.current ? 'font-semibold text-white' : step.done ? 'text-slate-200' : 'text-[var(--muted)]'
                }`}
              >
                {step.name}
              </span>
            </li>
          );
        })}
      </ol>

      {showItems ? (
        <div className="mt-5 rounded-[18px] border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold text-white">
            На складе в Китае: {arrived} из {tracking.items.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Когда все вещи приедут на склад, мы соберём их в одну посылку.
          </p>
          <ul className="mt-3 space-y-2">
            {tracking.items.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex items-start gap-2 text-xs">
                <span className={item.arrived ? 'text-emerald-300' : 'text-amber-200'}>{item.arrived ? '●' : '○'}</span>
                <span className="text-slate-200">
                  {item.title} · {item.size}
                  <span className="block text-[var(--muted)]">
                    {item.arrived ? 'На складе' : item.lastEvent ?? 'Едет на склад RAKETA'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tracking.events.length ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">История</p>
          <ul className="mt-2 space-y-2">
            {events.map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex justify-between gap-3 text-sm">
                <span className={index === 0 ? 'text-white' : 'text-slate-300'}>{event.name}</span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{formatDate(event.at)}</span>
              </li>
            ))}
          </ul>
          {tracking.events.length > EVENTS_PREVIEW ? (
            <button
              type="button"
              onClick={() => setShowAllEvents((v) => !v)}
              className="mt-2 text-xs text-[var(--accent)]"
            >
              {showAllEvents ? 'Свернуть' : `Показать всё (${tracking.events.length})`}
            </button>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
