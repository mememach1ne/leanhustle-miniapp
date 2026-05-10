'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { EmptyState } from '../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../components/ui/feedback-message';
import { InfoRow } from '../../../components/ui/info-row';
import { PageSection } from '../../../components/ui/page-section';
import { PriceSummaryCard } from '../../../components/ui/price-summary-card';
import { SectionCard } from '../../../components/ui/section-card';
import { CartItemSkeleton } from '../../../components/ui/skeleton';
import { cartApi, deliveryAddressesApi, ordersApi } from '../../../lib/api-client';
import { extractAxiosMessage } from '../../../lib/error-utils';
import { hapticImpact, hapticNotification, hapticSelection } from '../../../lib/telegram-web-app';
import { useAuthStore } from '../../../store/auth-store';
import { useCartStore } from '../../../store/cart-store';
import { useDeliveryAddressesStore } from '../../../store/delivery-addresses-store';
import { useOrdersStore } from '../../../store/orders-store';

export default function CartPage() {
  const router = useRouter();

  const authStatus = useAuthStore((state) => state.status);
  const cart = useCartStore((state) => state.cart);
  const isLoading = useCartStore((state) => state.isLoading);
  const error = useCartStore((state) => state.error);
  const setLoading = useCartStore((state) => state.setLoading);
  const setCart = useCartStore((state) => state.setCart);
  const setError = useCartStore((state) => state.setError);
  const clearCart = useCartStore((state) => state.clearCart);
  const prependOrder = useOrdersStore((state) => state.prependOrder);

  const deliveryAddresses = useDeliveryAddressesStore((state) => state.addresses);
  const setDeliveryAddresses = useDeliveryAddressesStore((state) => state.setAddresses);

  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return;
    }

    const loadCart = async () => {
      setLoading(true);

      try {
        const [cartResponse, addressesResponse] = await Promise.all([
          cartApi.getCart(),
          deliveryAddressesApi.getAll(),
        ]);
        setCart(cartResponse);
        setDeliveryAddresses(addressesResponse);
        const defaultAddr = addressesResponse.find((a) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else if (addressesResponse.length > 0) {
          setSelectedAddressId(addressesResponse[0].id);
        }
      } catch (requestError) {
        setError(
          extractAxiosMessage(requestError) ??
            'Не удалось загрузить корзину. Попробуйте позже.',
        );
      }
    };

    void loadCart();
  }, [authStatus, setCart, setDeliveryAddresses, setError, setLoading]);

  const handleIncrease = async (itemId: string, currentQuantity: number) => {
    setBusyItemId(itemId);
    hapticSelection();

    try {
      const response = await cartApi.updateCartItemQuantity(itemId, currentQuantity + 1);
      setCart(response);
    } catch (requestError) {
      setError(
        extractAxiosMessage(requestError) ??
          'Не удалось изменить количество. Попробуйте позже.',
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDecrease = async (itemId: string, currentQuantity: number) => {
    setBusyItemId(itemId);
    hapticSelection();

    try {
      const response =
        currentQuantity > 1
          ? await cartApi.updateCartItemQuantity(itemId, currentQuantity - 1)
          : await cartApi.removeCartItem(itemId);
      setCart(response);
    } catch (requestError) {
      setError(
        extractAxiosMessage(requestError) ??
          'Не удалось изменить количество. Попробуйте позже.',
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    setBusyItemId(itemId);
    hapticImpact('medium');

    try {
      const response = await cartApi.removeCartItem(itemId);
      setCart(response);
    } catch (requestError) {
      setError(
        extractAxiosMessage(requestError) ??
          'Не удалось удалить позицию. Попробуйте позже.',
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleCheckout = async () => {
    if (!selectedAddressId) {
      setCheckoutError('Выберите адрес доставки перед оформлением заявки.');
      hapticNotification('error');
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const response = await ordersApi.checkoutOrder(selectedAddressId);

      clearCart();
      prependOrder({
        id: response.order.id,
        orderNumber: response.order.orderNumber,
        status: response.order.status,
        createdAt: response.order.createdAt,
        updatedAt: response.order.updatedAt,
        trackCode: response.order.trackCode,
        subscriberBenefitApplied: response.order.subscriberBenefitApplied,
        subscriberBenefitAmountRub: response.order.subscriberBenefitAmountRub,
        totalUsd: response.order.summary.totalUsd,
        deliveryRub: response.order.summary.deliveryRub,
        dutyRub: response.order.summary.dutyRub,
        itemsCount: response.order.summary.itemsCount,
        previewTitle: response.order.items[0]?.title ?? null,
        previewImage: response.order.items[0]?.image ?? null,
      });

      hapticNotification('success');
      router.push(`/profile/orders?created=${response.order.id}`);
    } catch (requestError) {
      setCheckoutError(
        extractAxiosMessage(requestError) ??
          'Не удалось оформить заявку. Попробуйте позже.',
      );
      hapticNotification('error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleRetryLoad = () => {
    setError(null);
    setLoading(true);
    cartApi.getCart().then(setCart).catch((e) => {
      setError(extractAxiosMessage(e) ?? 'Не удалось загрузить корзину. Попробуйте позже.');
    });
  };

  if (authStatus === 'loading' || authStatus === 'idle' || isLoading) {
    return (
      <PageSection>
        <div className="space-y-4">
          <CartItemSkeleton />
          <CartItemSkeleton />
        </div>
      </PageSection>
    );
  }

  if (authStatus !== 'authenticated') {
    return (
      <PageSection>
        <EmptyState
          title="Нужна авторизация"
          description="Корзина доступна только внутри Telegram Mini App после входа."
        />
      </PageSection>
    );
  }

  return (
    <PageSection>
      {error ? <FeedbackMessage tone="error" onRetry={handleRetryLoad}>{error}</FeedbackMessage> : null}
      {checkoutError ? <FeedbackMessage tone="error" onRetry={handleCheckout}>{checkoutError}</FeedbackMessage> : null}

      {!cart || cart.items.length === 0 ? (
        <EmptyState
          title="Корзина пока пустая"
          description="Добавьте товар из вкладки «Калькулятор», и он сразу появится здесь."
        />
      ) : (
        <div className="space-y-4">
          {cart.items.map((item) => {
            const isBusy = busyItemId === item.id;
            const isExpanded = expandedItemId === item.id;

            return (
              <SectionCard key={item.id}>
                <div
                  className="flex gap-3 cursor-pointer"
                  onClick={() => { setExpandedItemId(isExpanded ? null : item.id); hapticSelection(); }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-14 shrink-0 rounded-[16px] bg-white/5 object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-[16px] bg-white/5" />
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {item.size}{item.version ? ` • ${item.version}` : ''} • {item.quantity} шт.
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold text-white">${item.lineTotalUsd.toFixed(2)}</span>
                    <span className={[
                      'mt-0.5 block text-[10px] text-[var(--muted)] transition-transform',
                      isExpanded ? 'rotate-180' : '',
                    ].join(' ')}>
                      ▼
                    </span>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                    <div className="space-y-2">
                      <InfoRow label="Цена за 1 шт" value={`$${item.totalUsd.toFixed(2)}`} />
                      <InfoRow label="Доставка за 1 шт" value={`${item.deliveryRub} ₽`} />
                      <InfoRow label="Пошлина за 1 шт" value={`${item.dutyRub} ₽`} />
                      <InfoRow label="Сумма по строке" value={`$${item.lineTotalUsd.toFixed(2)}`} accent />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-full border border-white/10 bg-slate-950/40 p-0.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => { e.stopPropagation(); handleDecrease(item.id, item.quantity); }}
                          className="grid h-8 w-8 place-items-center rounded-full text-base font-semibold text-white transition disabled:opacity-35"
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => { e.stopPropagation(); handleIncrease(item.id, item.quantity); }}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-base font-semibold text-white transition disabled:opacity-35"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                        className="rounded-[14px] border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-50"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ) : null}
              </SectionCard>
            );
          })}

          <PriceSummaryCard
            title="Итоги корзины"
            itemsCount={cart.summary.itemsCount}
            totalUsd={cart.summary.cartTotalUsd}
            deliveryRub={cart.summary.cartDeliveryRub}
            dutyRub={cart.summary.cartDutyRub}
            footer={
              isCheckoutConfirmOpen ? (
                <SectionCard className="border-white/10 bg-white/5 p-4">
                  <p className="text-sm leading-6 text-slate-200">
                    Подтвердите оформление заявки. После этого корзина очистится, а менеджер получит уведомление.
                  </p>

                  {deliveryAddresses.length === 0 ? (
                    <div className="mt-4 rounded-[16px] border border-amber-300/20 bg-amber-400/10 px-4 py-3">
                      <p className="text-sm text-amber-100">
                        Для оформления заявки нужно добавить адрес доставки.
                      </p>
                      <Link
                        href="/profile/delivery"
                        className="mt-2 inline-block rounded-[14px] bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-slate-950"
                      >
                        Добавить адрес
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <label className="mb-2 block text-xs text-[var(--muted)]">Адрес доставки</label>
                      <div className="space-y-2">
                        {deliveryAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => { hapticSelection(); setSelectedAddressId(addr.id); }}
                            className={[
                              'w-full rounded-[16px] border px-4 py-3 text-left text-sm transition',
                              selectedAddressId === addr.id
                                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-white'
                                : 'border-white/10 bg-white/5 text-slate-300',
                            ].join(' ')}
                          >
                            <span className="font-medium">{addr.fullName}</span>
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">
                              {addr.cdekAddress} &middot; {addr.phone}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    <InfoRow label="Итог сейчас" value={`$${cart.summary.cartTotalUsd.toFixed(2)}`} accent />
                    <InfoRow label="Примерная доставка" value={`${cart.summary.cartDeliveryRub} ₽`} />
                    <InfoRow label="Примерная пошлина" value={`${cart.summary.cartDutyRub} ₽`} />
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={handleCheckout}
                      disabled={isCheckingOut || deliveryAddresses.length === 0 || !selectedAddressId}
                      className="flex-1 rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                      {isCheckingOut ? 'Оформляем...' : 'Подтвердить'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCheckoutConfirmOpen(false)}
                      disabled={isCheckingOut}
                      className="flex-1 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Отмена
                    </button>
                  </div>
                </SectionCard>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCheckoutConfirmOpen(true)}
                  disabled={cart.items.length === 0}
                  className="w-full rounded-[20px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Оформить заявку
                </button>
              )
            }
          />
        </div>
      )}
    </PageSection>
  );
}
