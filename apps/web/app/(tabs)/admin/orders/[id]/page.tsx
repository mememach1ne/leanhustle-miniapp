'use client';

import type { StaffOrderDetailsDto } from '@lean-poizon/shared';
import { ORDER_STATUS_LABELS, OrderStatus } from '@lean-poizon/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  DELIVERY_PAYMENT_PENDING: 'bg-pink-400/15 text-pink-300 border-pink-300/30',
  DELIVERY_PAID: 'bg-cyan-400/15 text-cyan-300 border-cyan-300/30',
  DUTY_PAYMENT_PENDING: 'bg-yellow-400/15 text-yellow-300 border-yellow-300/30',
  DUTY_PAID: 'bg-teal-400/15 text-teal-300 border-teal-300/30',
  TRACK_CODE_RECEIVED: 'bg-emerald-400/15 text-emerald-300 border-emerald-300/30',
  DELIVERED: 'bg-emerald-500/20 text-emerald-300 border-emerald-300/40',
  CANCELLED: 'bg-rose-400/15 text-rose-300 border-rose-300/30',
};

// Linear staff-driven status transitions for the simple "next status" button.
// Phase 2 (actual delivery / duty) has dedicated input widgets below.
const NEXT_STATUS: Record<string, { status: OrderStatus; label: string }[]> = {
  CREATED: [{ status: OrderStatus.PAYMENT_PENDING, label: 'Реквизиты отправлены' }],
  PAYMENT_PENDING: [{ status: OrderStatus.PAID_AWAITING_PURCHASE, label: 'Оплата получена' }],
  PAID_AWAITING_PURCHASE: [{ status: OrderStatus.PURCHASED, label: 'Товар выкуплен' }],
  PURCHASED: [],
  DELIVERY_PAYMENT_PENDING: [],
  DELIVERY_PAID: [],
  DUTY_PAYMENT_PENDING: [],
  DUTY_PAID: [],
  TRACK_CODE_RECEIVED: [],
  DELIVERED: [],
  CANCELLED: [],
};

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<StaffOrderDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [trackCode, setTrackCode] = useState('');
  const [actualDelivery, setActualDelivery] = useState('');
  const [actualDuty, setActualDuty] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadOrder();
  }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getOrderById(id);
      applyOrder(data);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Заказ не найден');
    } finally {
      setLoading(false);
    }
  };

  const applyOrder = (data: StaffOrderDetailsDto) => {
    setOrder(data);
    setTrackCode(data.trackCode ?? '');
    setActualDelivery(
      data.summary.actualDeliveryRub != null ? String(data.summary.actualDeliveryRub) : '',
    );
    setActualDuty(
      data.summary.actualDutyRub != null ? String(data.summary.actualDutyRub) : '',
    );
  };

  // Generic runner so each action shares loading / error plumbing.
  const runAction = async (
    fn: () => Promise<StaffOrderDetailsDto>,
    successText: string,
  ) => {
    setActionLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const updated = await fn();
      applyOrder(updated);
      setSuccess(successText);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось выполнить действие.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = (status: OrderStatus) =>
    runAction(
      () => adminApi.updateOrderStatus(id, status),
      `Статус обновлён: ${ORDER_STATUS_LABELS[status]}`,
    );

  const handleSetActualDelivery = () => {
    const value = Number(actualDelivery.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      setError('Введите корректную сумму доставки в рублях.');
      return;
    }
    return runAction(
      () => adminApi.setActualDelivery(id, value),
      'Стоимость доставки сохранена.',
    );
  };

  const handleMarkDeliveryPaid = () =>
    runAction(() => adminApi.markDeliveryPaid(id), 'Доставка отмечена как оплаченная.');

  const handleSetActualDuty = () => {
    const value = Number(actualDuty.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      setError('Введите корректную сумму пошлины в рублях (0, если без пошлины).');
      return;
    }
    return runAction(
      () => adminApi.setActualDuty(id, value),
      'Пошлина сохранена.',
    );
  };

  const handleMarkDutyPaid = () =>
    runAction(() => adminApi.markDutyPaid(id), 'Пошлина отмечена как оплаченная.');

  const handleTrackCode = () => {
    if (!trackCode.trim()) return;
    return runAction(
      () => adminApi.setTrackCode(id, trackCode.trim()),
      'Трек-код сохранён.',
    );
  };

  const handleMarkDelivered = () =>
    runAction(() => adminApi.markDelivered(id), 'Заказ отмечен как доставленный.');

  const handleDeleteOrder = async () => {
    const confirmed = window.confirm(
      'Удалить заказ безвозвратно? Он исчезнет из списков и статистики клиента.',
    );
    if (!confirmed) return;
    setActionLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const result = await adminApi.deleteOrder(id);
      // Navigate back to the admin orders list; nothing to show here anymore.
      router.replace(`/admin?deleted=${encodeURIComponent(result.orderNumber)}`);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось удалить заказ.');
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    const reason = window.prompt(
      'Причина отмены (необязательно):',
      'Отменено менеджером',
    );
    if (reason === null) return; // dismissed
    await runAction(
      () => adminApi.cancelOrder(id, reason || undefined),
      'Заказ отменён.',
    );
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

  // Visibility flags for phase 2 widgets. They follow the real backend
  // transitions (see orders.service.ts ORDER_STATUS_TRANSITIONS):
  //   PURCHASED                  -> input actual delivery
  //   DELIVERY_PAYMENT_PENDING   -> input (edit) actual delivery + mark paid
  //   DELIVERY_PAID              -> input actual duty (0 == skip) + track code
  //   DUTY_PAYMENT_PENDING       -> mark duty paid
  //   DUTY_PAID                  -> track code
  //   TRACK_CODE_RECEIVED        -> edit track code + mark delivered
  const showActualDelivery =
    order.status === OrderStatus.PURCHASED ||
    order.status === OrderStatus.DELIVERY_PAYMENT_PENDING;
  const showMarkDeliveryPaid = order.status === OrderStatus.DELIVERY_PAYMENT_PENDING;
  const showActualDuty = order.status === OrderStatus.DELIVERY_PAID;
  const showMarkDutyPaid = order.status === OrderStatus.DUTY_PAYMENT_PENDING;
  const showTrackCodeInput =
    order.status === OrderStatus.DELIVERY_PAID ||
    order.status === OrderStatus.DUTY_PAID ||
    order.status === OrderStatus.TRACK_CODE_RECEIVED;
  const showMarkDelivered = order.status === OrderStatus.TRACK_CODE_RECEIVED;

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
            <span>Доставка (расчётная):</span>
            <span className="text-white">{order.summary.deliveryRub} ₽</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Пошлина (расчётная):</span>
            <span className="text-white">{order.summary.dutyRub} ₽</span>
          </div>
          {order.summary.actualDeliveryRub != null ? (
            <div className="flex justify-between text-white/80">
              <span>Доставка (факт):</span>
              <span className="text-white">{order.summary.actualDeliveryRub} ₽</span>
            </div>
          ) : null}
          {order.summary.actualDutyRub != null ? (
            <div className="flex justify-between text-white/80">
              <span>Пошлина (факт):</span>
              <span className="text-white">{order.summary.actualDutyRub} ₽</span>
            </div>
          ) : null}
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

        {/* Simple linear status transitions (phase 1) */}
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

        {/* Phase 2: actual delivery cost */}
        {showActualDelivery ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-white/60">
              Фактическая стоимость доставки (₽)
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={actualDelivery}
                onChange={(e) => setActualDelivery(e.target.value)}
                placeholder="например, 1850"
                className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleSetActualDelivery}
                disabled={actionLoading || !actualDelivery.trim()}
                className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        ) : null}

        {showMarkDeliveryPaid ? (
          <button
            type="button"
            onClick={handleMarkDeliveryPaid}
            disabled={actionLoading}
            className="mt-3 w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
          >
            Доставка оплачена
          </button>
        ) : null}

        {/* Phase 2: actual duty */}
        {showActualDuty ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-white/60">
              Фактическая пошлина (₽). Если пошлины нет — введите 0 и нажмите «Сохранить».
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={actualDuty}
                onChange={(e) => setActualDuty(e.target.value)}
                placeholder="например, 0"
                className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleSetActualDuty}
                disabled={actionLoading || actualDuty.trim() === ''}
                className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        ) : null}

        {showMarkDutyPaid ? (
          <button
            type="button"
            onClick={handleMarkDutyPaid}
            disabled={actionLoading}
            className="mt-3 w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
          >
            Пошлина оплачена
          </button>
        ) : null}

        {/* Track code input */}
        {showTrackCodeInput ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-white/60">Трек-код последней мили (СДЭК)</p>
            <div className="flex gap-2">
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
          </div>
        ) : null}

        {showMarkDelivered ? (
          <button
            type="button"
            onClick={handleMarkDelivered}
            disabled={actionLoading}
            className="mt-3 w-full rounded-[18px] bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
          >
            Заказ доставлен
          </button>
        ) : null}

        {/* Cancel — available from any non-terminal status */}
        {order.status !== OrderStatus.DELIVERED &&
        order.status !== OrderStatus.CANCELLED ? (
          <button
            type="button"
            onClick={handleCancelOrder}
            disabled={actionLoading}
            className="mt-3 w-full rounded-[18px] border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition disabled:opacity-50"
          >
            Отменить заказ
          </button>
        ) : null}

        {/* Hard-delete — clean up test / spam orders. Skips analytics. */}
        <button
          type="button"
          onClick={handleDeleteOrder}
          disabled={actionLoading}
          className="mt-2 w-full rounded-[18px] border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-100 transition disabled:opacity-50"
        >
          🗑 Удалить заказ безвозвратно
        </button>

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
