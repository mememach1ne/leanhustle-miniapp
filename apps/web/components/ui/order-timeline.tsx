import type { OrderStatusHistoryItemDto } from '@lean-poizon/shared';
import { OrderStatus } from '@lean-poizon/shared';

import { getOrderStatusLabel } from '../../lib/order-status';

const ALL_STATUSES: OrderStatus[] = [
  OrderStatus.CREATED,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAID_AWAITING_PURCHASE,
  OrderStatus.PURCHASED,
  OrderStatus.DELIVERY_PAYMENT_PENDING,
  OrderStatus.DELIVERY_PAID,
  OrderStatus.DUTY_PAYMENT_PENDING,
  OrderStatus.DUTY_PAID,
  OrderStatus.TRACK_CODE_RECEIVED,
  OrderStatus.DELIVERED,
];

/** Duty steps are shown only for orders that actually went through them. */
const DUTY_STATUSES = new Set<OrderStatus>([OrderStatus.DUTY_PAYMENT_PENDING, OrderStatus.DUTY_PAID]);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

export function OrderTimeline({
  currentStatus,
  statusHistory,
}: {
  currentStatus: OrderStatus;
  statusHistory?: OrderStatusHistoryItemDto[];
}) {
  const historyMap = new Map(
    (statusHistory ?? []).map((item) => [item.toStatus, item.createdAt]),
  );

  const statuses = ALL_STATUSES.filter(
    (status) => !DUTY_STATUSES.has(status) || status === currentStatus || historyMap.has(status),
  );
  const currentIndex = statuses.indexOf(currentStatus);

  return (
    <div className="space-y-0">
      {statuses.map((status, index) => {
        const isCompleted = index <= currentIndex;
        const isLast = index === statuses.length - 1;
        const date = historyMap.get(status);

        return (
          <div key={status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'mt-0.5 h-3 w-3 rounded-full border-2 flex-shrink-0',
                  isCompleted
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-white/20 bg-transparent',
                ].join(' ')}
              />
              {!isLast ? (
                <div
                  className={[
                    'w-0.5 flex-1 min-h-6',
                    isCompleted && index < currentIndex
                      ? 'bg-[var(--accent)]/40'
                      : 'bg-white/10',
                  ].join(' ')}
                />
              ) : null}
            </div>
            <div className={['pb-4', isLast ? 'pb-0' : ''].join(' ')}>
              <p
                className={[
                  'text-sm font-medium leading-4',
                  isCompleted ? 'text-white' : 'text-white/30',
                ].join(' ')}
              >
                {getOrderStatusLabel(status)}
              </p>
              {date ? (
                <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(date)}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
