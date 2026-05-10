import type { OrderListItemDto } from '@lean-poizon/shared';
import Link from 'next/link';

import { InfoRow } from './info-row';
import { SectionCard } from './section-card';
import { StatusBadge } from './status-badge';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export function OrderCard({ order }: { order: OrderListItemDto }) {
  return (
    <Link href={`/profile/orders/${order.id}`}>
      <SectionCard className="transition-transform duration-150 active:scale-[0.99]">
        <div className="flex gap-4">
          {order.previewImage ? (
            <img
              src={order.previewImage}
              alt={order.previewTitle ?? order.orderNumber}
              loading="lazy"
              decoding="async"
              className="h-20 w-20 rounded-3xl bg-white/5 object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-3xl bg-white/5" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                  {order.orderNumber}
                </p>
                <h3 className="mt-2 text-base font-semibold text-white">
                  {order.previewTitle ?? 'Заказ без названия'}
                </h3>
              </div>
              <StatusBadge status={order.status} trackCode={order.trackCode} />
            </div>

            <p className="mt-3 text-sm text-[var(--muted)]">{formatDate(order.createdAt)}</p>

            {order.subscriberBenefitApplied ? (
              <div className="mt-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                Льгота подписчика применена
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              <InfoRow label="Товаров" value={order.itemsCount} />
              <InfoRow label="Итог сейчас" value={`$${order.totalUsd.toFixed(2)}`} accent />
              <InfoRow label="Доставка" value={`${order.deliveryRub} ₽`} />
              <InfoRow label="Пошлина" value={`${order.dutyRub} ₽`} />
              {order.trackCode ? <InfoRow label="Трек-код" value={order.trackCode} /> : null}
            </div>
          </div>
        </div>
      </SectionCard>
    </Link>
  );
}
