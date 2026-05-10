'use client';

import { ORDER_STATUS_LABELS, OrderStatus } from '@lean-poizon/shared';
import type { AdminUserDetailDto } from '@lean-poizon/shared';
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

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [user, setUser] = useState<AdminUserDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void loadUser();
  }, [id]);

  const loadUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getUserById(id);
      setUser(data);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Пользователь не найден');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const blob = await adminApi.exportUserExcel(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${user.username ?? id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <PageSection>
        <LoadingBlock title="Загрузка" description="Загружаем клиента..." />
      </PageSection>
    );
  }

  if (!user) {
    return (
      <PageSection>
        <EmptyState title="Клиент не найден" description={error ?? ''} />
      </PageSection>
    );
  }

  return (
    <PageSection>
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] transition hover:text-white"
      >
        &larr; Назад к клиентам
      </Link>

      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}

      {/* User header */}
      <SectionCard>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {user.username ? `@${user.username}` : user.firstName}
            </h2>
            <p className="mt-1 text-xs text-white/50">
              {user.firstName} {user.lastName ?? ''}
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              Регистрация: {new Date(user.createdAt).toLocaleDateString('ru-RU')}
            </p>
          </div>
          {user.isChannelSubscriber ? (
            <span className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              Подписчик
            </span>
          ) : null}
        </div>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/5 px-2 py-2">
            <p className="text-sm font-bold text-white">{user.ordersCount}</p>
            <p className="text-[10px] text-white/40">Заказов</p>
          </div>
          <div className="rounded-xl bg-white/5 px-2 py-2">
            <p className="text-sm font-bold text-white">
              {user.averageCheckRub.toLocaleString('ru-RU')} ₽
            </p>
            <p className="text-[10px] text-white/40">Ср. чек</p>
          </div>
          <div className="rounded-xl bg-white/5 px-2 py-2">
            <p className="text-sm font-bold text-emerald-300">
              {user.totalProfitRub.toLocaleString('ru-RU')} ₽
            </p>
            <p className="text-[10px] text-white/40">Прибыль</p>
          </div>
        </div>
      </SectionCard>

      {/* Export button */}
      {user.ordersCount > 0 ? (
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
        >
          {exporting ? 'Экспорт...' : 'Скачать Excel (заказы клиента)'}
        </button>
      ) : null}

      {/* Orders */}
      <SectionCard>
        <h3 className="mb-3 text-sm font-semibold text-white">
          Заказы ({user.orders.length})
        </h3>

        {user.orders.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">У клиента нет заказов</p>
        ) : (
          <div className="space-y-3">
            {user.orders.map((order) => {
              const statusLabel =
                ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;
              const statusColor =
                STATUS_COLORS[order.status] ?? 'bg-white/10 text-white border-white/20';

              return (
                <Link key={order.id} href={`/admin/orders/${order.id}`}>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/15">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {order.orderNumber}
                          </span>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/50">
                          {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                          {' · '}
                          {order.itemsCount} {order.itemsCount === 1 ? 'товар' : order.itemsCount < 5 ? 'товара' : 'товаров'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-white/40">
                          {order.previewTitle}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          ${order.totalUsd}
                        </p>
                        {order.trackCode ? (
                          <p className="mt-0.5 text-[10px] text-emerald-300">
                            {order.trackCode}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageSection>
  );
}
