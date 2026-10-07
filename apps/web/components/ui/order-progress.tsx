'use client';

import type { OrderStatusHistoryItemDto, OrderTrackingDto } from '@lean-poizon/shared';
import { OrderStatus } from '@lean-poizon/shared';
import { useState } from 'react';

import { hapticNotification } from '../../lib/telegram-web-app';
import { MarketplaceLogo } from './marketplace-logo';
import { SectionCard } from './section-card';

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
};

/** How far the order went by its own status (independent of parcel tracking). */
const RANK: Record<OrderStatus, number> = {
  [OrderStatus.CREATED]: 0,
  [OrderStatus.PAYMENT_PENDING]: 0,
  [OrderStatus.PAID_AWAITING_PURCHASE]: 1,
  [OrderStatus.PURCHASED]: 2,
  [OrderStatus.DELIVERY_PAYMENT_PENDING]: 3,
  [OrderStatus.DELIVERY_PAID]: 4,
  [OrderStatus.DUTY_PAYMENT_PENDING]: 4,
  [OrderStatus.DUTY_PAID]: 5,
  [OrderStatus.TRACK_CODE_RECEIVED]: 6,
  [OrderStatus.DELIVERED]: 7,
  [OrderStatus.CANCELLED]: -1,
};

interface Step {
  key: string;
  title: string;
  /** Shown instead of the title while the client has to act (pay). */
  waiting?: string;
  done: boolean;
  at?: string | null;
}

/**
 * One timeline for the whole order: our own steps (payment, purchase,
 * delivery payment) merged with the parcel's way from RAKETA's tracker, each
 * step once. RAKETA numbers are never shown — only the CDEK track.
 */
export function OrderProgress({
  status,
  createdAt,
  statusHistory,
  tracking,
}: {
  status: OrderStatus;
  createdAt: string;
  statusHistory?: OrderStatusHistoryItemDto[];
  tracking: OrderTrackingDto | null;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const history = new Map((statusHistory ?? []).map((item) => [item.toStatus, item.createdAt]));
  const rank = RANK[status] ?? 0;
  const parcel = (index: number) => tracking?.steps[index];
  const hadDuty =
    status === OrderStatus.DUTY_PAYMENT_PENDING ||
    history.has(OrderStatus.DUTY_PAYMENT_PENDING) ||
    history.has(OrderStatus.DUTY_PAID);

  const steps: Step[] = [
    { key: 'created', title: 'Заказ оформлен', done: true, at: createdAt },
    {
      key: 'paid',
      title: 'Заказ оплачен',
      waiting: 'Ожидает оплаты',
      done: rank >= 1,
      at: history.get(OrderStatus.PAID_AWAITING_PURCHASE),
    },
    { key: 'purchased', title: 'Выкуплен на Poizon', done: rank >= 2, at: history.get(OrderStatus.PURCHASED) },
    {
      key: 'china',
      title: 'На складе в Китае',
      done: Boolean(parcel(1)?.done) || rank >= 3,
      at: parcel(1)?.at,
    },
    {
      key: 'delivery-paid',
      title: 'Доставка оплачена',
      waiting: 'Ожидает оплаты доставки',
      done: rank >= 4,
      at: history.get(OrderStatus.DELIVERY_PAID),
    },
    ...(hadDuty
      ? [
          {
            key: 'duty',
            title: 'Пошлина оплачена',
            waiting: 'Ожидает оплаты пошлины',
            done: rank >= 5 && status !== OrderStatus.DUTY_PAYMENT_PENDING,
            at: history.get(OrderStatus.DUTY_PAID),
          },
        ]
      : []),
    { key: 'sent', title: 'Отправлен в Россию', done: Boolean(parcel(2)?.done), at: parcel(2)?.at },
    { key: 'customs', title: 'На таможне', done: Boolean(parcel(3)?.done), at: parcel(3)?.at },
    { key: 'rf-warehouse', title: 'На складе в России', done: Boolean(parcel(4)?.done), at: parcel(4)?.at },
    {
      key: 'rf-transit',
      title: 'В пути по России',
      done: Boolean(parcel(5)?.done) || rank >= 6,
      at: parcel(5)?.at ?? history.get(OrderStatus.TRACK_CODE_RECEIVED),
    },
    {
      key: 'delivered',
      title: 'Доставлен',
      done: Boolean(parcel(6)?.done) || rank >= 7,
      at: parcel(6)?.at ?? history.get(OrderStatus.DELIVERED),
    },
  ];

  // A later step implies the earlier ones; the next one may be «waiting for payment».
  const lastDone = steps.map((s) => s.done).lastIndexOf(true);
  const next = steps[lastDone + 1];
  const waitingIndex = status !== OrderStatus.CANCELLED && next?.waiting ? lastDone + 1 : -1;
  const currentIndex = waitingIndex >= 0 ? waitingIndex : lastDone;

  const copyCdek = async () => {
    if (!tracking?.cdekTrack) return;
    try {
      await navigator.clipboard.writeText(tracking.cdekTrack);
      setCopied(true);
      hapticNotification('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      hapticNotification('error');
    }
  };

  const items = tracking?.items ?? [];
  const arrived = items.filter((item) => item.arrived).length;
  const showItems = tracking?.kind === 'consolidation' && !steps[3].done && items.length > 0;
  const events = tracking?.events ?? [];

  return (
    <SectionCard>
      <h3 className="text-lg font-semibold text-white">Статус заказа</h3>

      {status === OrderStatus.CANCELLED ? (
        <p className="mt-3 rounded-[16px] border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          Заказ отменён
        </p>
      ) : null}

      {tracking?.cdekTrack ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyCdek}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-emerald-100 transition active:scale-[0.98]"
          >
            <MarketplaceLogo marketplace="cdek" className="h-5 w-5" />
            {copied ? 'Скопировано!' : `СДЭК ${tracking.cdekTrack}`}
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

      <ol className="mt-5">
        {steps.map((step, index) => {
          const done = index <= lastDone;
          const isCurrent = index === currentIndex;
          const isWaiting = index === waitingIndex;
          const isLast = index === steps.length - 1;
          const date = done ? formatDate(step.at) : null;
          return (
            <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast ? (
                <span
                  className={`absolute left-[7px] top-4 h-full w-0.5 ${
                    index < lastDone ? 'bg-[var(--accent)]/60' : 'bg-white/10'
                  }`}
                />
              ) : null}
              <span
                className={[
                  'relative mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
                  isWaiting
                    ? 'border-amber-300 bg-amber-300/20 ring-4 ring-amber-300/20'
                    : done
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-white/20 bg-transparent',
                  isCurrent && !isWaiting ? 'ring-4 ring-[var(--accent)]/25' : '',
                ].join(' ')}
              />
              <span className="min-w-0">
                <span
                  className={`block text-sm leading-4 ${
                    isWaiting
                      ? 'font-semibold text-amber-100'
                      : isCurrent
                        ? 'font-semibold text-white'
                        : done
                          ? 'text-slate-200'
                          : 'text-white/30'
                  }`}
                >
                  {isWaiting ? step.waiting : step.title}
                </span>
                {date ? <span className="mt-1 block text-xs text-[var(--muted)]">{date}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {showItems ? (
        <div className="mt-5 rounded-[18px] border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold text-white">
            На складе в Китае: {arrived} из {items.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Когда все вещи приедут на склад, мы соберём их в одну посылку.
          </p>
          <ul className="mt-3 space-y-2">
            {items.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex items-start gap-2 text-xs">
                <span className={item.arrived ? 'text-emerald-300' : 'text-amber-200'}>{item.arrived ? '●' : '○'}</span>
                <span className="text-slate-200">
                  {item.title} · {item.size}
                  <span className="block text-[var(--muted)]">
                    {item.arrived ? 'На складе' : item.lastEvent ?? 'Едет на склад'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {events.length ? (
        <div className="mt-4">
          <button type="button" onClick={() => setShowDetails((v) => !v)} className="text-xs text-[var(--accent)]">
            {showDetails ? 'Скрыть подробности' : 'Подробнее о перемещении посылки'}
          </button>
          {showDetails ? (
            <ul className="mt-3 space-y-2">
              {events.map((event, index) => (
                <li key={`${event.at}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span className={index === 0 ? 'text-white' : 'text-slate-300'}>{event.name}</span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{formatDate(event.at)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
