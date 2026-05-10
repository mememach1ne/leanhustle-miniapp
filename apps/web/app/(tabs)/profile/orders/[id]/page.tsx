'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { EmptyState } from '../../../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../../../components/ui/feedback-message';
import { InfoRow } from '../../../../../components/ui/info-row';
import { OrderTimeline } from '../../../../../components/ui/order-timeline';
import { PageSection } from '../../../../../components/ui/page-section';
import { ProductMiniCard } from '../../../../../components/ui/product-mini-card';
import { SectionCard } from '../../../../../components/ui/section-card';
import { ProductCardSkeleton, Skeleton } from '../../../../../components/ui/skeleton';
import { StatusBadge } from '../../../../../components/ui/status-badge';
import { ordersApi } from '../../../../../lib/api-client';
import { extractAxiosMessage } from '../../../../../lib/error-utils';
import { getTelegramWebApp, hapticImpact, hapticNotification } from '../../../../../lib/telegram-web-app';
import { useAuthStore } from '../../../../../store/auth-store';
import { useCalculatorStore } from '../../../../../store/calculator-store';
import { useOrdersStore } from '../../../../../store/orders-store';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;
  const authStatus = useAuthStore((state) => state.status);
  const order = useOrdersStore((state) => state.currentOrder);
  const isLoadingDetails = useOrdersStore((state) => state.isLoadingDetails);
  const error = useOrdersStore((state) => state.error);
  const setDetailsLoading = useOrdersStore((state) => state.setDetailsLoading);
  const setCurrentOrder = useOrdersStore((state) => state.setCurrentOrder);
  const setError = useOrdersStore((state) => state.setError);
  const setLink = useCalculatorStore((state) => state.setLink);
  const [trackCopied, setTrackCopied] = useState(false);

  const handleCopyTrackCode = async (trackCode: string) => {
    try {
      await navigator.clipboard.writeText(trackCode);
      setTrackCopied(true);
      hapticNotification('success');
      setTimeout(() => setTrackCopied(false), 2000);
    } catch {
      hapticNotification('error');
    }
  };

  const handleReorder = () => {
    const firstItemLink = order?.items[0]?.dewuLink;
    if (firstItemLink) {
      setLink(firstItemLink);
      hapticImpact('medium');
      router.push('/calculator');
    }
  };

  const handleBack = useCallback(() => {
    router.push('/profile/orders');
  }, [router]);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    const backButton = webApp?.BackButton;

    if (backButton) {
      backButton.onClick(handleBack);
      backButton.show();
    }

    return () => {
      if (backButton) {
        backButton.offClick(handleBack);
        backButton.hide();
      }
    };
  }, [handleBack]);

  const handleLoadOrder = async () => {
    setDetailsLoading(true);
    setError(null);

    try {
      const response = await ordersApi.getOrderById(orderId);
      setCurrentOrder(response);
    } catch (requestError) {
      setError(
        extractAxiosMessage(requestError) ??
          'Не удалось загрузить детали заказа. Попробуйте позже.',
      );
    }
  };

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return;
    }

    void handleLoadOrder();
  }, [authStatus, orderId, setCurrentOrder, setDetailsLoading, setError]);

  if (authStatus !== 'authenticated') {
    return (
      <PageSection>
        <EmptyState
          title="Нужна авторизация"
          description="Детали заказа доступны только авторизованному пользователю."
        />
      </PageSection>
    );
  }

  if (!isLoadingDetails && error) {
    return (
      <PageSection>
        <FeedbackMessage tone="error" onRetry={handleLoadOrder}>{error}</FeedbackMessage>
      </PageSection>
    );
  }

  if (isLoadingDetails || !order || order.id !== orderId) {
    return (
      <PageSection>
        <div className="space-y-4">
          <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded-lg" />
                <Skeleton className="h-3 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-[20px]" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full rounded-lg" />
              <Skeleton className="h-3 w-2/3 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
            </div>
          </div>
          <ProductCardSkeleton />
        </div>
      </PageSection>
    );
  }

  return (
    <PageSection>
      <button
        type="button"
        onClick={handleBack}
        className="mb-2 text-xs text-[var(--muted)] transition hover:text-white"
      >
        ← Назад к заказам
      </button>

      {error ? <FeedbackMessage tone="error" onRetry={handleLoadOrder}>{error}</FeedbackMessage> : null}

      <SectionCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
              {order.orderNumber}
            </p>
            <p className="mt-3 text-sm text-[var(--muted)]">{formatDate(order.createdAt)}</p>
          </div>
          <StatusBadge status={order.status} trackCode={order.trackCode} />
        </div>

        {order.trackCode ? (
          <button
            type="button"
            onClick={() => handleCopyTrackCode(order.trackCode!)}
            className="mt-4 w-full rounded-[20px] border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-left text-sm text-sky-100 transition active:scale-[0.99]"
          >
            {trackCopied ? (
              <span className="font-semibold">Скопировано!</span>
            ) : (
              <>
                Трек-код: <span className="font-semibold">{order.trackCode}</span>
                <span className="ml-2 text-xs text-sky-200/60">нажмите, чтобы скопировать</span>
              </>
            )}
          </button>
        ) : null}

        {order.subscriberBenefitApplied ? (
          <div className="mt-4 rounded-[20px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Льгота подписчика применена. Скидка на комиссию: {order.subscriberBenefitAmountRub} ₽
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          <InfoRow label="Товаров" value={order.summary.itemsCount} />
          <p className="text-xs text-[var(--muted)]">Выкуп товара (USD)</p>
          {order.subscriberBenefitApplied ? (
            <InfoRow
              label="Сумма до льготы"
              value={`$${order.summary.originalTotalUsd.toFixed(2)}`}
            />
          ) : null}
          <InfoRow label="Итог за товары" value={`$${order.summary.totalUsd.toFixed(2)}`} accent />
          {order.subscriberBenefitApplied ? (
            <InfoRow
              label="Скидка на комиссию"
              value={`$${order.summary.benefitDiscountUsd.toFixed(2)} / ${order.subscriberBenefitAmountRub} ₽`}
            />
          ) : null}
          <div className="border-t border-white/5" />
          <p className="text-xs text-[var(--muted)]">Доставка и пошлина (RUB)</p>
          <InfoRow label="Доставка" value={`${order.summary.deliveryRub} ₽`} />
          <InfoRow label="Пошлина" value={`${order.summary.dutyRub} ₽`} />
        </div>
      </SectionCard>

      {order.delivery ? (
        <SectionCard>
          <h3 className="mb-3 text-sm font-semibold text-white">Данные доставки</h3>
          <div className="space-y-2">
            <InfoRow label="ФИО" value={order.delivery.fullName} />
            <InfoRow label="Пункт СДЭК" value={order.delivery.cdekAddress} />
            <InfoRow label="Телефон" value={order.delivery.phone} />
          </div>
        </SectionCard>
      ) : null}

      <SectionCard>
        <h3 className="mb-4 text-lg font-semibold text-white">Прогресс заявки</h3>
        <OrderTimeline currentStatus={order.status} statusHistory={order.statusHistory} />
      </SectionCard>

      <div className="space-y-4">
        {order.items.map((item) => (
          <ProductMiniCard
            key={item.id}
            image={item.image}
            title={item.title}
            subtitle={`${item.size}${item.version ? ` • ${item.version}` : ''}`}
            deliveryCategory={item.deliveryCategory}
            weightKg={item.estimatedWeightKg}
            action={
              <div className="space-y-2">
                <InfoRow label="Количество" value={item.quantity} />
                <InfoRow label="Цена за 1 шт" value={`$${item.totalUsd.toFixed(2)}`} />
                <InfoRow label="Сумма по строке" value={`$${item.lineTotalUsd.toFixed(2)}`} accent />
                <InfoRow label="Доставка по строке" value={`${item.lineDeliveryRub} ₽`} />
                <InfoRow label="Пошлина по строке" value={`${item.lineDutyRub} ₽`} />
              </div>
            }
          />
        ))}
      </div>

      {order.items[0]?.dewuLink ? (
        <button
          type="button"
          onClick={handleReorder}
          className="w-full rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
        >
          Заказать снова
        </button>
      ) : null}
    </PageSection>
  );
}
