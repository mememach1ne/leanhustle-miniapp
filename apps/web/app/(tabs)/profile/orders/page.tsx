'use client';

import { OrderStatus } from '@lean-poizon/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { EmptyState } from '../../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../../components/ui/feedback-message';
import { OrderCard } from '../../../../components/ui/order-card';
import { PageSection } from '../../../../components/ui/page-section';
import { OrderCardSkeleton } from '../../../../components/ui/skeleton';
import { ordersApi } from '../../../../lib/api-client';
import { extractAxiosMessage } from '../../../../lib/error-utils';
import { hapticSelection } from '../../../../lib/telegram-web-app';
import { useAuthStore } from '../../../../store/auth-store';
import { useOrdersStore } from '../../../../store/orders-store';

type OrderFilter = 'all' | 'active' | 'completed';

const ACTIVE_STATUSES = new Set<string>([
  OrderStatus.CREATED,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAID_AWAITING_PURCHASE,
  OrderStatus.PURCHASED,
]);

function OrdersPageContent() {
  const authStatus = useAuthStore((state) => state.status);
  const orders = useOrdersStore((state) => state.orders);
  const isLoadingList = useOrdersStore((state) => state.isLoadingList);
  const error = useOrdersStore((state) => state.error);
  const setListLoading = useOrdersStore((state) => state.setListLoading);
  const setOrders = useOrdersStore((state) => state.setOrders);
  const setError = useOrdersStore((state) => state.setError);

  const [filter, setFilter] = useState<OrderFilter>('all');

  const searchParams = useSearchParams();
  const createdId = searchParams.get('created');

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'active') return orders.filter((o) => ACTIVE_STATUSES.has(o.status));
    return orders.filter((o) => !ACTIVE_STATUSES.has(o.status));
  }, [orders, filter]);

  const handleLoadOrders = async () => {
    setListLoading(true);
    setError(null);

    try {
      const response = await ordersApi.getOrders();
      setOrders(response);
    } catch (requestError) {
      setError(
        extractAxiosMessage(requestError) ??
          'Не удалось загрузить заказы. Попробуйте позже.',
      );
    }
  };

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return;
    }

    void handleLoadOrders();
  }, [authStatus, setError, setListLoading, setOrders]);

  if (authStatus !== 'authenticated') {
    return (
      <PageSection>
        <EmptyState
          title="Нужна авторизация"
          description="История заказов доступна только авторизованному пользователю внутри mini app."
        />
      </PageSection>
    );
  }

  if (isLoadingList) {
    return (
      <PageSection>
        <div className="space-y-4">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      </PageSection>
    );
  }

  return (
    <PageSection>
      <Link href="/profile" className="mb-2 inline-block text-xs text-[var(--muted)] transition hover:text-white">
        ← Назад к профилю
      </Link>

      {createdId ? (
        <FeedbackMessage tone="success">
          Заявка создана. Менеджер скоро свяжется с вами для оплаты.
        </FeedbackMessage>
      ) : null}

      {error ? <FeedbackMessage tone="error" onRetry={handleLoadOrders}>{error}</FeedbackMessage> : null}

      {orders.length === 0 ? (
        <EmptyState
          title="Заказов пока нет"
          description="После оформления заявки из корзины она появится здесь со статусом и деталями."
        />
      ) : (
        <>
          {orders.length > 1 ? (
            <div className="flex gap-2">
              {([['all', 'Все'], ['active', 'Активные'], ['completed', 'Завершённые']] as const).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setFilter(value); hapticSelection(); }}
                    className={[
                      'rounded-full border px-4 py-2 text-xs font-medium transition',
                      filter === value
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-slate-950'
                        : 'border-white/10 bg-white/5 text-white',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          ) : null}

          {filteredOrders.length === 0 ? (
            <EmptyState
              title="Нет заказов в этой категории"
              description="Попробуйте выбрать другой фильтр."
            />
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </>
      )}
    </PageSection>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <PageSection>
          <div className="space-y-4">
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </div>
        </PageSection>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
