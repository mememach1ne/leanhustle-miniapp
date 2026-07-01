'use client';

import type { OrderListItemDto } from '@lean-poizon/shared';
import { useRouter } from 'next/navigation';

import { StatusBadge } from './status-badge';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value));

/**
 * Desktop table view of the customer's orders. Each row navigates to the
 * order detail page. Mobile uses the OrderCard list instead.
 */
export function OrdersTable({
  orders,
  className = '',
}: {
  orders: OrderListItemDto[];
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-white/40">
            <th className="px-4 py-3 font-medium">№</th>
            <th className="px-4 py-3 font-medium">Товар</th>
            <th className="px-4 py-3 font-medium">Дата</th>
            <th className="px-4 py-3 text-center font-medium">Товаров</th>
            <th className="px-4 py-3 text-right font-medium">Сумма</th>
            <th className="px-4 py-3 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={() => router.push(`/profile/orders/${order.id}`)}
              className="cursor-pointer border-t border-white/5 transition hover:bg-white/[0.04]"
            >
              <td className="px-4 py-3">
                <span className="font-semibold uppercase tracking-wide text-[var(--accent)]">
                  {order.orderNumber}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {order.previewImage ? (
                    <img
                      src={order.previewImage}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-9 shrink-0 rounded-lg bg-white/5 object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-white/5" />
                  )}
                  <span className="max-w-[240px] truncate text-white">
                    {order.previewTitle ?? 'Заказ'}
                  </span>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-white/60">
                {formatDate(order.createdAt)}
              </td>
              <td className="px-4 py-3 text-center text-white/70">{order.itemsCount}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-white">
                ${order.totalUsd.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={order.status} trackCode={order.trackCode} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
