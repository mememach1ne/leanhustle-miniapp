'use client';

import type { DewuProductSku, DewuResolvedProduct, PricingCalculationResult } from '@lean-poizon/shared';
import { useEffect, useState } from 'react';

import { cartApi, pricingApi, productsApi } from '../../lib/api-client';
import { getDeliveryCategoryLabel } from '../../lib/delivery-categories';
import { extractAxiosMessage } from '../../lib/error-utils';
import { hapticImpact, hapticNotification, hapticSelection } from '../../lib/telegram-web-app';
import { useCartStore } from '../../store/cart-store';
import { DutyRow } from './duty-row';
import { FeedbackMessage } from './feedback-message';
import { InfoRow } from './info-row';
import { LoadingBlock } from './loading-block';
import { SizeChartModal } from './size-chart-modal';

const formatYuan = (value: number | null) =>
  typeof value === 'number' ? `${value.toFixed(2)} CNY` : 'Недоступно';

/**
 * Quick-view modal for a catalog card: resolves the product by spuId, lets
 * the customer pick a size and add straight to cart — without leaving
 * /catalog (previously this navigated to /calculator?spuId=, which lost
 * the storefront's scroll position and felt like an unwanted detour).
 */
export function CatalogProductModal({ spuId, onClose }: { spuId: string; onClose: () => void }) {
  const setCart = useCartStore((state) => state.setCart);

  const [product, setProduct] = useState<DewuResolvedProduct | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);

  const [selectedSku, setSelectedSku] = useState<DewuProductSku | undefined>(undefined);
  const [pricing, setPricing] = useState<PricingCalculationResult | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addedSkuId, setAddedSkuId] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);

  // Resolve the product once, on open.
  useEffect(() => {
    let cancelled = false;
    hapticImpact('light');
    setIsLoadingProduct(true);
    setProductError(null);

    productsApi
      .resolveBySpuId(spuId)
      .then((resolved) => {
        if (cancelled) return;
        setProduct(resolved);
        setSelectedSku(resolved.availableSkus[0]);
      })
      .catch((error) => {
        if (cancelled) return;
        setProductError(extractAxiosMessage(error) ?? 'Не удалось загрузить товар. Попробуйте позже.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProduct(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spuId]);

  // Auto-price whenever the selected SKU changes.
  useEffect(() => {
    if (!product || !selectedSku?.isAvailable) return;
    let cancelled = false;
    setIsLoadingPricing(true);
    setPricingError(null);

    pricingApi
      .calculate({ product, dwSkuId: selectedSku.dwSkuId })
      .then((result) => {
        if (!cancelled) setPricing(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setPricingError(extractAxiosMessage(error) ?? 'Не удалось выполнить расчёт. Попробуйте ещё раз.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPricing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [product, selectedSku]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddToCart = async () => {
    if (!product || !selectedSku || !pricing) return;

    setIsAddingToCart(true);
    setCartError(null);

    try {
      const response = await cartApi.addToCart({
        dewuLink: product.originalLink,
        dwSpuId: product.dwSpuId,
        dwSkuId: pricing.dwSkuId,
        productTitle: product.title,
        productImage: product.mainImage,
        size: pricing.size,
        version: pricing.version,
        categoryL1: product.categoryL1,
        categoryL2: product.categoryL2,
        categoryL3: product.categoryL3,
        priceYuan: pricing.priceYuan,
        totalUsd: pricing.totalUsd,
        deliveryRub: pricing.deliveryRub,
        dutyRub: pricing.dutyRub,
        categoryGroup: pricing.categoryGroup,
        deliveryCategory: pricing.deliveryCategory,
        estimatedWeightKg: pricing.estimatedWeightKg,
        quantity,
      });

      setCart(response);
      setAddedSkuId(pricing.dwSkuId);
      hapticNotification('success');
    } catch (error) {
      setCartError(extractAxiosMessage(error) ?? 'Не удалось добавить товар в корзину. Попробуйте позже.');
      hapticNotification('error');
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="lg-surface-strong relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] lg:max-w-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-[#45474c]" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-8 z-10 grid h-9 w-9 place-items-center rounded-full bg-[#131415]/75 text-white backdrop-blur transition active:scale-90"
          aria-label="Закрыть"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-4">
          {isLoadingProduct ? (
            <LoadingBlock title="Загружаем товар" description="Проверяем размеры и цены." />
          ) : productError ? (
            <FeedbackMessage tone="error">{productError}</FeedbackMessage>
          ) : product ? (
            <>
              <div className="grid aspect-[1.35/1] w-full place-items-center overflow-hidden rounded-[24px] bg-white">
                {product.mainImage ? (
                  <img
                    src={product.mainImage}
                    alt={product.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-[84%] object-contain"
                  />
                ) : null}
              </div>

              <h4 className="font-display mx-0.5 mt-3.5 break-words text-[18px] font-bold leading-tight text-white">
                {product.title}
              </h4>
              <p className="mx-0.5 mt-1 text-[13px] font-semibold text-[var(--muted)]">
                {product.brand ?? 'Poizon'} · в наличии {product.availableSkus.length} из{' '}
                {product.skus.length}
              </p>

              <div className="mt-4 flex items-center justify-between gap-3 px-0.5">
                <p className="text-[15px] font-bold text-white">Размер</p>
                {product.sizeChart ? (
                  <button
                    type="button"
                    onClick={() => setIsSizeChartOpen(true)}
                    className="lg-chip shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
                  >
                    Размерная сетка
                  </button>
                ) : null}
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {product.skus.map((sku) => {
                  const isSelected = selectedSku?.dwSkuId === sku.dwSkuId;
                  return (
                    <button
                      key={sku.dwSkuId}
                      type="button"
                      disabled={!sku.isAvailable}
                      onClick={() => {
                        setSelectedSku(sku);
                        setAddedSkuId(null);
                        hapticImpact('light');
                      }}
                      className={[
                        'rounded-[14px] px-2 py-2 text-center transition active:scale-95',
                        sku.isAvailable
                          ? isSelected
                            ? 'bg-white text-[#111]'
                            : 'bg-[var(--surface-2)] text-white'
                          : 'cursor-not-allowed bg-white/[0.03] text-[#55585e]',
                      ].join(' ')}
                    >
                      <div className="truncate text-sm font-extrabold">{sku.size}</div>
                      <div className="mt-0.5 truncate text-[11px] font-semibold opacity-60">
                        {sku.isAvailable ? formatYuan(sku.priceYuan) : 'Нет в наличии'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedSku ? (
                <div className="mt-4 space-y-3">
                  {isLoadingPricing ? (
                    <LoadingBlock title="Считаем стоимость" description="Цена, доставка и пошлина." />
                  ) : null}

                  {pricingError ? <FeedbackMessage tone="error">{pricingError}</FeedbackMessage> : null}

                  {pricing ? (
                    <>
                      <InfoRow label="Итог товара" value={`$${pricing.totalUsd.toFixed(2)}`} accent />
                      {pricing.weightPending ? (
                        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100">
                          Вес для этой категории уточнит менеджер после получения товара. Можно
                          добавить в корзину — итоговая сумма будет позже.
                        </div>
                      ) : (
                        <>
                          <InfoRow label="Примерная доставка" value={`${pricing.deliveryRub} ₽`} />
                          <InfoRow
                            label="Категория доставки"
                            value={getDeliveryCategoryLabel(pricing.deliveryCategory)}
                          />
                        </>
                      )}
                      <DutyRow dutyRub={pricing.dutyRub} breakdown={pricing.dutyBreakdown} />
                    </>
                  ) : null}
                </div>
              ) : null}

              {cartError ? (
                <div className="mt-3">
                  <FeedbackMessage tone="error">{cartError}</FeedbackMessage>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {product && selectedSku && pricing ? (
          <div className="shrink-0 px-3.5 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-2">
            <div className="flex items-center gap-2">
              <div className="flex h-[58px] shrink-0 items-center rounded-full bg-[var(--surface-2)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setQuantity((v) => Math.max(1, v - 1));
                    hapticSelection();
                  }}
                  disabled={isAddingToCart || quantity <= 1}
                  className="grid h-9 w-9 place-items-center rounded-full text-base font-semibold text-white transition disabled:opacity-35"
                >
                  −
                </button>
                <span className="min-w-8 text-center text-sm font-semibold text-white">{quantity}</span>
                <button
                  type="button"
                  onClick={() => {
                    setQuantity((v) => Math.min(20, v + 1));
                    hapticSelection();
                  }}
                  disabled={isAddingToCart}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-base font-semibold text-white transition disabled:opacity-35"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className={[
                  'flex h-[58px] flex-1 flex-col items-center justify-center rounded-full px-4 leading-tight transition active:scale-[0.98] disabled:opacity-50',
                  addedSkuId === pricing.dwSkuId
                    ? 'bg-emerald-400 text-[#052a1c]'
                    : 'lg-accent-button',
                ].join(' ')}
              >
                <span className="font-display text-[15px] font-bold">
                  {isAddingToCart
                    ? 'Добавляем…'
                    : addedSkuId === pricing.dwSkuId
                      ? 'Добавлено в корзину'
                      : 'В корзину'}
                </span>
                <span className="text-[11.5px] font-semibold opacity-75">
                  {addedSkuId === pricing.dwSkuId
                    ? `${quantity} шт.`
                    : `$${(pricing.totalUsd * quantity).toFixed(2)} + доставка`}
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isSizeChartOpen && product?.sizeChart ? (
        <SizeChartModal imageUrl={product.sizeChart} onClose={() => setIsSizeChartOpen(false)} />
      ) : null}
    </div>
  );
}
