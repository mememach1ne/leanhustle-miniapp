'use client';

import type { StaffOrderDetailsDto } from '@lean-poizon/shared';
import { ORDER_STATUS_LABELS, OrderStatus } from '@lean-poizon/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { EmptyState } from '../../../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../../../components/ui/feedback-message';
import { LoadingBlock } from '../../../../../components/ui/loading-block';
import { PageSection } from '../../../../../components/ui/page-section';
import { SectionCard } from '../../../../../components/ui/section-card';
import { adminApi } from '../../../../../lib/api-client';
import { extractAxiosMessage } from '../../../../../lib/error-utils';

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-blue-400/15 text-blue-300 border-blue-300/30',
  PAYMENT_PENDING: 'bg-amber-400/15 text-amber-300 border-amber-300/30',
  PAID_AWAITING_PURCHASE: 'bg-orange-400/15 text-orange-300 border-orange-300/30',
  PURCHASED: 'bg-purple-400/15 text-purple-300 border-purple-300/30',
  TRACK_CODE_RECEIVED: 'bg-emerald-400/15 text-emerald-300 border-emerald-300/30',
};

const NEXT_STATUS: Record<string, { status: OrderStatus; label: string }[]> = {
  CREATED: [{ status: OrderStatus.PAYMENT_PENDING, label: 'Реквизиты отправлены' }],
  PAYMENT_PENDING: [{ status: OrderStatus.PAID_AWAITING_PURCHASE, label: 'Оплата получена' }],
  PAID_AWAITING_PURCHASE: [{ status: OrderStatus.PURCHASED, label: 'Товар выкуплен' }],
  PURCHASED: [],
  TRACK_CODE_RECEIVED: [],
};

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<StaffOrderDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [trackCode, setTrackCode] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadOrder();
  }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getOrderById(id);
      setOrder(data);
      setTrackCode(data.trackCode ?? '');
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Заказ не найден');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: OrderStatus) => {
    setActionLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const updated = await adminApi.updateOrderStatus(id, status);
      setOrder(updated);
      setSuccess(`Статус обновлён: ${ORDER_STATUS_LABELS[status]}`);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Ошибка обновления статуса');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTrackCode = async () => {
    if (!trackCode.trim()) return;
    setActionLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const updated = await adminApi.setTrackCode(id, trackCode.trim());
      setOrder(updated);
      setSuccess('Трек-код сохранён');
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Ошибка сохранения трек-кода');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageSection>
        <LoadingBlock title="Загрузка" description="Загружаем заказ..." />
      </PageSection>
    );
  }

  if (!order) {
    return (
      <PageSection>
        <EmptyState title="Заказ не найден" description={error ?? ''} />
      </PageSection>
    );
  }

  const statusLabel =
    ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;
  const statusColor = STATUS_COLORS[order.status] ?? 'bg-white/10 text-white border-white/20';
  const nextStatuses = NEXT_STATUS[order.status] ?? [];

  return (
    <PageSection>
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] transition hover:text-white"
      >
        ← Назад к заказам
      </Link>

      {success ? <FeedbackMessage tone="success">{success}</FeedbackMessage> : null}
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}

      {/* Order header */}
      <SectionCard>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{order.orderNumber}</h2>
            <p className="mt-1 text-xs text-white/50">
              {new Date(order.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Customer info */}
        <div className="mt-4 rounded-xl bg-white/5 p-3">
          <h3 className="text-xs font-semibold text-white/60">Клиент</h3>
          <p className="mt-1 text-sm text-white">
            {order.user.firstName} {order.user.lastName ?? ''}
          </p>
          <p className="text-xs text-white/50">
            {order.user.username ? `@${order.user.username}` : `ID: ${order.user.telegramId}`}
          </p>
        </div>

        {/* Delivery */}
        {order.delivery ? (
          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <h3 className="text-xs font-semibold text-white/60">Доставка</h3>
            <p className="mt-1 text-sm text-white">{order.delivery.fullName}</p>
            <p className="text-xs text-white/50">{order.delivery.cdekAddress}</p>
            <p className="text-xs text-white/50">{order.delivery.phone}</p>
          </div>
        ) : null}
      </SectionCard>

      {/* Items */}
      <SectionCard>
        <h3 className="mb-3 text-sm font-semibold text-white">
          Товары ({order.items.length})
        </h3>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-3 border-b border-white/5 pb-3 last:border-0">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 shrink-0 rounded-xl bg-white/5 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs text-white/30">
                  Нет фото
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{item.title}</p>
                <p className="text-xs text-white/50">
                  Размер: {item.size} · x{item.quantity} · ¥{item.priceYuan}
                </p>
                <p className="text-xs text-white/40">
                  ${item.lineTotalUsd} + {item.lineDeliveryRub}₽ дост. + {item.lineDutyRub}₽ пошл.
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm">
          <div className="flex justify-between text-white/60">
            <span>Товары:</span>
            <span className="text-white">${order.summary.totalUsd}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Доставка:</span>
            <span className="text-white">{order.summary.deliveryRub} ₽</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Пошлина:</span>
            <span className="text-white">{order.summary.dutyRub} ₽</span>
          </div>
          {order.subscriberBenefitApplied ? (
            <div className="flex justify-between text-emerald-400">
              <span>Скидка подписчика:</span>
              <span>-{order.subscriberBenefitAmountRub} ₽</span>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {/* Actions */}
      <SectionCard>
        <h3 className="mb-3 text-sm font-semibold text-white">Действия</h3>

        {/* Status transitions */}
        {nextStatuses.length > 0 ? (
          <div className="space-y-2">
            {nextStatuses.map((next) => (
              <button
                key={next.status}
                type="button"
                onClick={() => handleStatusChange(next.status)}
                disabled={actionLoading}
                className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
              >
                {next.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Track code input */}
        {order.status === OrderStatus.PURCHASED ||
        order.status === OrderStatus.TRACK_CODE_RECEIVED ? (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={trackCode}
              onChange={(e) => setTrackCode(e.target.value)}
              placeholder="Введите трек-код"
              className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={handleTrackCode}
              disabled={actionLoading || !trackCode.trim()}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        ) : null}

        {/* Status history */}
        {order.statusHistory && order.statusHistory.length > 0 ? (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold text-white/50">История статусов</h4>
            <div className="space-y-1">
              {order.statusHistory.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-white/60">
                    {h.fromStatus
                      ? `${ORDER_STATUS_LABELS[h.fromStatus as OrderStatus] ?? h.fromStatus} → `
                      : ''}
                    {ORDER_STATUS_LABELS[h.toStatus as OrderStatus] ?? h.toStatus}
                  </span>
                  <span className="text-white/30">
                    {new Date(h.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>
    </PageSection>
  );
}
