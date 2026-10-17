'use client';

import type {
  CartDeliveryEstimateResponse,
  PackagingOption,
  PhotoReportOption,
} from '@lean-poizon/shared';
import { EXTRA_SERVICE_PRICES, PACKAGING_LABELS, PHOTO_REPORT_LABELS } from '@lean-poizon/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { EmptyState } from '../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../components/ui/feedback-message';
import { BoxIcon, CartIcon, LockIcon } from '../../../components/ui/icons';
import { InfoRow } from '../../../components/ui/info-row';
import { MarketplaceLogo } from '../../../components/ui/marketplace-logo';
import { PageSection } from '../../../components/ui/page-section';
import { PriceSummaryCard } from '../../../components/ui/price-summary-card';
import { SectionCard } from '../../../components/ui/section-card';
import { type ServiceIconKind, ServiceIcon } from '../../../components/ui/service-icons';
import { CartItemSkeleton } from '../../../components/ui/skeleton';
import { cartApi, deliveryAddressesApi, ordersApi } from '../../../lib/api-client';
import { extractAxiosMessage } from '../../../lib/error-utils';
import { hapticImpact, hapticNotification, hapticSelection } from '../../../lib/telegram-web-app';
import { useAuthStore } from '../../../store/auth-store';
import { useCartStore } from '../../../store/cart-store';
import { useDeliveryAddressesStore } from '../../../store/delivery-addresses-store';
import { useOrdersStore } from '../../../store/orders-store';

const CARRIER_SHORT = { cdek: 'СДЭК', pochta: 'Почта России', raketa: 'Пункт партнёра' } as const;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-6 w-10 shrink-0 rounded-full transition',
        checked ? 'bg-[var(--accent)]' : 'bg-white/15',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
          checked ? 'left-[18px]' : 'left-0.5',
        ].join(' ')}
      />
    </button>
  );
}

function ServiceRow({
  icon,
  title,
  hint,
  control,
}: {
  icon: ServiceIconKind;
  title: string;
  hint: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <ServiceIcon kind={icon} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">{hint}</p>
      </div>
      {control}
    </div>
  );
}

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
  const [insurance, setInsurance] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  // Ways to deliver to the chosen address (carrier × pickup/courier × speed) with prices.
  const [deliveryEstimate, setDeliveryEstimate] = useState<CartDeliveryEstimateResponse | null>(null);
  const [deliveryOption, setDeliveryOption] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [packaging, setPackaging] = useState<PackagingOption | null>(null);
  const [photoReports, setPhotoReports] = useState<Record<string, { kind: PhotoReportOption; comment: string }>>({});
  const cartItemsKey = cart?.items.map((item) => `${item.id}:${item.quantity}`).join(',') ?? '';

  useEffect(() => {
    if (authStatus !== 'authenticated' || !cartItemsKey) return;
    let cancelled = false;
    setEstimateLoading(true);
    cartApi
      .getDeliveryEstimate(selectedAddressId, deliveryOption)
      .then((estimate) => {
        if (!cancelled) setDeliveryEstimate(estimate);
      })
      .catch(() => {
        if (!cancelled) setDeliveryEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setEstimateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, selectedAddressId, deliveryOption, cartItemsKey]);
  const deliveryRub = deliveryEstimate?.deliveryRub ?? cart?.summary.cartDeliveryRub ?? 0;
  const deliveryOptions = deliveryEstimate?.options ?? [];
  const selectedOption = deliveryOptions.find((o) => o.key === deliveryEstimate?.selectedKey) ?? null;
  // Extra services are charged per China parcel (packaging) / per item (photos) with the delivery.
  const parcels = cart?.items.length ?? 0;
  const servicesRub =
    (packaging ? EXTRA_SERVICE_PRICES.packaging[packaging] * parcels : 0) +
    Object.values(photoReports).reduce((sum, p) => sum + EXTRA_SERVICE_PRICES.photoReport[p.kind], 0);
  const setPhoto = (itemId: string, kind: PhotoReportOption | null) => {
    hapticSelection();
    setPhotoReports((current) => {
      const next = { ...current };
      if (kind) next[itemId] = { kind, comment: current[itemId]?.comment ?? '' };
      else delete next[itemId];
      return next;
    });
  };

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

    if (Object.values(photoReports).some((p) => p.kind === 'individual' && !p.comment.trim())) {
      setCheckoutError('Для подробного фотоотчёта напишите, что нужно сфотографировать.');
      hapticNotification('error');
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const response = await ordersApi.checkoutOrder({
        deliveryAddressId: selectedAddressId,
        insurance,
        deliveryOption: deliveryEstimate?.selectedKey ?? undefined,
        packaging,
        photoReports: Object.entries(photoReports)
          .filter(([id]) => cart?.items.some((item) => item.id === id))
          .map(([cartItemId, p]) => ({
            cartItemId,
            kind: p.kind,
            comment: p.kind === 'individual' ? p.comment.trim() : null,
          })),
      });

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
      // Open the new order directly — the customer needs to pick a USDT
      // network there to trigger the auto-payment flow.
      router.push(`/profile/orders/${response.order.id}`);
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
          icon={<LockIcon />}
          title="Нужна авторизация"
          description="Корзина доступна после входа через Telegram."
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
          icon={<CartIcon />}
          title="Корзина пока пустая"
          description="Добавьте товар из вкладки «Калькулятор», и он сразу появится здесь."
        />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
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
                    <div
                      aria-hidden="true"
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-white/5 text-white/30"
                    >
                      <BoxIcon className="h-6 w-6" />
                    </div>
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
                      <InfoRow
                        label={item.quantity > 1 ? 'Цена за 1 шт' : 'Цена'}
                        value={`$${item.totalUsd.toFixed(2)}`}
                      />
                      <InfoRow
                        label={item.quantity > 1 ? 'Доставка за 1 шт' : 'Доставка'}
                        value={`${item.deliveryRub} ₽`}
                      />
                      {item.dutyRub > 0 ? (
                        <InfoRow
                          label={item.quantity > 1 ? 'Пошлина за 1 шт' : 'Пошлина'}
                          value={`${item.dutyRub} ₽`}
                        />
                      ) : null}
                      {item.quantity > 1 ? (
                        <InfoRow
                          label="Сумма"
                          value={`$${item.lineTotalUsd.toFixed(2)}`}
                          accent
                        />
                      ) : null}
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
          </div>

          <div className="mt-4 space-y-4 lg:mt-0 lg:sticky lg:top-6">
          <PriceSummaryCard
            title="Итоги корзины"
            itemsCount={cart.summary.itemsCount}
            totalUsd={cart.summary.cartTotalUsd}
            deliveryRub={deliveryRub}
            deliveryHub={deliveryEstimate?.hubCity}
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
                        className="mt-2 inline-block rounded-[14px] bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)]"
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
                            onClick={() => {
                              hapticSelection();
                              setSelectedAddressId(addr.id);
                              setDeliveryOption(null);
                            }}
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

                  {deliveryOptions.length > 0 ? (
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Доставка</p>
                      <div className="space-y-2">
                        {deliveryOptions.map((option) => {
                          const active = deliveryEstimate?.selectedKey === option.key;
                          const fast = option.tariff === 'EXPR';
                          return (
                            <button
                              key={option.key}
                              type="button"
                              disabled={estimateLoading}
                              onClick={() => {
                                hapticSelection();
                                setDeliveryOption(option.key);
                              }}
                              className={[
                                'flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition active:scale-[0.99] disabled:opacity-70',
                                active
                                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                                  : 'border-white/10 bg-white/[0.04]',
                              ].join(' ')}
                            >
                              {option.carrier === 'raketa' ? (
                                <ServiceIcon kind="partner-point" className="h-10 w-10" />
                              ) : (
                                <MarketplaceLogo marketplace={option.carrier} className="h-10 w-10" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                                  {CARRIER_SHORT[option.carrier]}
                                  <span
                                    className={[
                                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                      fast ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-slate-300',
                                    ].join(' ')}
                                  >
                                    {option.speed}
                                  </span>
                                </span>
                                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                                  {option.kind === 'courier' ? 'курьер до двери' : option.carrier === 'pochta' ? 'в отделении' : 'в пункте выдачи'}
                                  {option.daysMin !== null
                                    ? ` · ${option.daysMin === option.daysMax ? option.daysMin : `${option.daysMin}–${option.daysMax}`} дн.`
                                    : ''}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block text-sm font-semibold text-white">{option.deliveryRub} ₽</span>
                                <span
                                  className={[
                                    'ml-auto mt-1 block h-4 w-4 rounded-full border-2',
                                    active ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-white/25',
                                  ].join(' ')}
                                />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted)]">
                        Срок — от склада в Китае до вас. Цена примерная, точная придёт после взвешивания.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Доп. услуги</p>
                    <div className="divide-y divide-white/5 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04]">
                      <ServiceRow
                        icon="insurance"
                        title="Страховка"
                        hint={`Вернём стоимость при порче или утере${cart.summary.insuranceRub ? ` · ≈ ${cart.summary.insuranceRub} ₽` : ' · 1%'}`}
                        control={<Toggle checked={insurance} onChange={(v) => { hapticSelection(); setInsurance(v); }} />}
                      />
                      <ServiceRow
                        icon={packaging === 'crate' ? 'crate' : 'box'}
                        title="Упаковка"
                        hint={
                          packaging === 'box'
                            ? `${PACKAGING_LABELS.box} · ${EXTRA_SERVICE_PRICES.packaging.box} ₽ за посылку`
                            : packaging === 'crate'
                              ? `${PACKAGING_LABELS.crate} · ${EXTRA_SERVICE_PRICES.packaging.crate} ₽ за посылку`
                              : 'Лишний слой картона или жёсткий каркас'
                        }
                        control={
                          <div className="flex rounded-full bg-white/5 p-0.5">
                            {([null, 'box', 'crate'] as Array<PackagingOption | null>).map((p) => (
                              <button
                                key={p ?? 'none'}
                                type="button"
                                aria-label={p ? PACKAGING_LABELS[p] : 'Без доп. упаковки'}
                                onClick={() => {
                                  hapticSelection();
                                  setPackaging(p);
                                }}
                                className={[
                                  'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                                  packaging === p ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-slate-300',
                                ].join(' ')}
                              >
                                {p === 'box' ? 'Коробка' : p === 'crate' ? 'Каркас' : 'Нет'}
                              </button>
                            ))}
                          </div>
                        }
                      />
                      <ServiceRow
                        icon="photo"
                        title="Фотоотчёт"
                        hint={`Снимки товара на складе в Китае · ${EXTRA_SERVICE_PRICES.photoReport.basic} ₽ за вещь`}
                        control={
                          <Toggle
                            checked={Object.keys(photoReports).length > 0}
                            onChange={(on) => {
                              hapticSelection();
                              setPhotoReports(
                                on
                                  ? Object.fromEntries(cart.items.map((item) => [item.id, { kind: 'basic' as const, comment: '' }]))
                                  : {},
                              );
                            }}
                          />
                        }
                      />
                      {Object.keys(photoReports).length > 0 ? (
                        <div className="space-y-2 bg-white/[0.02] px-3 py-3">
                          {cart.items.map((item) => {
                            const chosen = photoReports[item.id];
                            return (
                              <div key={item.id}>
                                <div className="flex items-center gap-2">
                                  {item.image ? (
                                    <img src={item.image} alt="" className="h-8 w-8 shrink-0 rounded-[10px] bg-white/5 object-cover" />
                                  ) : null}
                                  <p className="min-w-0 flex-1 truncate text-xs text-white">
                                    {item.title} · {item.size}
                                  </p>
                                  <div className="flex shrink-0 rounded-full bg-white/5 p-0.5">
                                    {([null, 'basic', 'individual'] as Array<PhotoReportOption | null>).map((kind) => (
                                      <button
                                        key={kind ?? 'none'}
                                        type="button"
                                        onClick={() => setPhoto(item.id, kind)}
                                        className={[
                                          'rounded-full px-2 py-1 text-[10px] font-semibold transition',
                                          (chosen?.kind ?? null) === kind
                                            ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                            : 'text-slate-300',
                                        ].join(' ')}
                                      >
                                        {kind === 'basic'
                                          ? `${EXTRA_SERVICE_PRICES.photoReport.basic} ₽`
                                          : kind === 'individual'
                                            ? `Подробно ${EXTRA_SERVICE_PRICES.photoReport.individual} ₽`
                                            : 'Нет'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {chosen?.kind === 'individual' ? (
                                  <div className="mt-2 flex items-start gap-2">
                                    <ServiceIcon kind="photo-detailed" className="h-8 w-8" />
                                    <textarea
                                      value={chosen.comment}
                                      onChange={(e) =>
                                        setPhotoReports((current) => ({
                                          ...current,
                                          [item.id]: { kind: 'individual', comment: e.target.value.slice(0, 500) },
                                        }))
                                      }
                                      placeholder="Что сфотографировать: бирку, подошву, шов…"
                                      rows={2}
                                      className="min-w-0 flex-1 rounded-[12px] border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[var(--accent)] focus:outline-none"
                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                          <p className="text-[11px] leading-4 text-[var(--muted)]">
                            {PHOTO_REPORT_LABELS.basic} придёт в бота и появится в заказе. Подробный — снимем то, что вы
                            попросите.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <InfoRow label="Итог сейчас" value={`$${cart.summary.cartTotalUsd.toFixed(2)}`} accent />
                    <InfoRow
                      label={
                        selectedOption
                          ? `Примерная доставка (${CARRIER_SHORT[selectedOption.carrier]})`
                          : deliveryEstimate
                            ? `Примерная доставка (до г. ${deliveryEstimate.hubCity})`
                            : 'Примерная доставка'
                      }
                      value={estimateLoading ? '…' : `${deliveryRub} ₽`}
                    />
                    {servicesRub + (insurance ? (cart.summary.insuranceRub ?? 0) : 0) > 0 ? (
                      <InfoRow
                        label="Доп. услуги"
                        value={`≈ ${servicesRub + (insurance ? (cart.summary.insuranceRub ?? 0) : 0)} ₽`}
                      />
                    ) : null}
                    <InfoRow label="Примерная пошлина" value={`${cart.summary.cartDutyRub} ₽`} />
                    <p className="text-[11px] leading-4 text-[var(--muted)]">
                      Доставка и услуги оплачиваются отдельно, когда посылка будет готова к отправке из Китая.
                    </p>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={handleCheckout}
                      disabled={isCheckingOut || deliveryAddresses.length === 0 || !selectedAddressId}
                      className="flex-1 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-50"
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
                  className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Оформить заявку
                </button>
              )
            }
          />
          </div>
        </div>
      )}
    </PageSection>
  );
}
