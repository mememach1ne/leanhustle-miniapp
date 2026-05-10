'use client';

import type { DeliveryCategory } from '@lean-poizon/shared';
import { useEffect, useState } from 'react';

import { EmptyState } from '../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../components/ui/feedback-message';
import { InfoRow } from '../../../components/ui/info-row';
import { LoadingBlock } from '../../../components/ui/loading-block';
import { PageSection } from '../../../components/ui/page-section';
import { ProductMiniCard } from '../../../components/ui/product-mini-card';
import { SectionCard } from '../../../components/ui/section-card';
import { SizeChartModal } from '../../../components/ui/size-chart-modal';
import { cartApi, pricingApi, productsApi } from '../../../lib/api-client';
import { CATEGORY_GROUPS, getDeliveryCategoryLabel } from '../../../lib/delivery-categories';
import { extractAxiosMessage } from '../../../lib/error-utils';
import { hapticImpact, hapticNotification, hapticSelection } from '../../../lib/telegram-web-app';
import { useCalculatorStore } from '../../../store/calculator-store';
import { useCartStore } from '../../../store/cart-store';

const formatYuan = (value: number | null) =>
  typeof value === 'number' ? `${value.toFixed(2)} CNY` : 'Недоступно';

export default function CalculatorPage() {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addQuantity, setAddQuantity] = useState(1);
  const [addedSkuId, setAddedSkuId] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  // Manual mode state
  const [manualPriceYuan, setManualPriceYuan] = useState('');
  const [manualSize, setManualSize] = useState('');
  const [manualCategory, setManualCategory] = useState<string>('SNEAKERS');
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [isPriceHelpOpen, setIsPriceHelpOpen] = useState(false);
  const [isManagerRequesting, setIsManagerRequesting] = useState(false);
  const [managerRequestSent, setManagerRequestSent] = useState(false);
  const [managerRequestError, setManagerRequestError] = useState<string | null>(null);

  const link = useCalculatorStore((state) => state.link);
  const product = useCalculatorStore((state) => state.product);
  const selectedSku = useCalculatorStore((state) => state.selectedSku);
  const pricing = useCalculatorStore((state) => state.pricing);
  const isLoadingProduct = useCalculatorStore((state) => state.isLoadingProduct);
  const isLoadingPricing = useCalculatorStore((state) => state.isLoadingPricing);
  const error = useCalculatorStore((state) => state.error);
  const pricingError = useCalculatorStore((state) => state.pricingError);
  const manualMode = useCalculatorStore((state) => state.manualMode);
  const manualPricing = useCalculatorStore((state) => state.manualPricing);
  const setLink = useCalculatorStore((state) => state.setLink);
  const setProductLoading = useCalculatorStore((state) => state.setProductLoading);
  const setPricingLoading = useCalculatorStore((state) => state.setPricingLoading);
  const setResolvedProduct = useCalculatorStore((state) => state.setResolvedProduct);
  const selectSku = useCalculatorStore((state) => state.selectSku);
  const setPricing = useCalculatorStore((state) => state.setPricing);
  const setError = useCalculatorStore((state) => state.setError);
  const setPricingError = useCalculatorStore((state) => state.setPricingError);
  const activateManualMode = useCalculatorStore((state) => state.activateManualMode);
  const setManualPricing = useCalculatorStore((state) => state.setManualPricing);
  const clearManualPricing = useCalculatorStore((state) => state.clearManualPricing);
  const setCart = useCartStore((state) => state.setCart);

  // --- Auto pricing for API mode ---
  useEffect(() => {
    const calculatePricing = async () => {
      if (!product || !selectedSku?.isAvailable) {
        return;
      }

      setPricingLoading(true);
      setCartMessage(null);
      setCartError(null);

      try {
        const result = await pricingApi.calculate({
          product,
          dwSkuId: selectedSku.dwSkuId,
        });

        setPricing(result);
      } catch (requestError) {
        setPricingError(
          extractAxiosMessage(requestError) ??
            'Не удалось выполнить расчёт. Попробуйте ещё раз позже.',
        );
      }
    };

    void calculatePricing();
  }, [product, selectedSku, setPricing, setPricingError, setPricingLoading]);

  useEffect(() => {
    setAddQuantity(1);
    setAddedSkuId(null);
  }, [selectedSku?.dwSkuId, product?.dwSpuId]);

  // Reset manual mode state when manual mode changes
  useEffect(() => {
    if (manualMode) {
      setManualPriceYuan('');
      setManualSize('');
      setManualCategory('SNEAKERS');
      setManagerRequestSent(false);
      setManagerRequestError(null);
      setAddQuantity(1);
      setAddedSkuId(null);
    }
  }, [manualMode]);

  // --- Resolve product (API) ---
  const handleResolveProduct = async () => {
    setHasSubmitted(true);
    setCartMessage(null);
    setCartError(null);

    if (!link.trim()) {
      setError('Вставьте ссылку на товар Dewu.');
      return;
    }

    setProductLoading(true);

    try {
      const resolvedProduct = await productsApi.resolveProduct({
        link: link.trim(),
      });

      setResolvedProduct(resolvedProduct);
    } catch (requestError) {
      const message = extractAxiosMessage(requestError);
      // Activate manual mode on API error
      activateManualMode();
      hapticNotification('warning');
      // We don't call setError because activateManualMode clears error
      // Instead show the context in the manual form
      void message; // used implicitly by activating manual mode
    }
  };

  // --- Manual pricing calculation ---
  const handleManualCalculate = async () => {
    const priceNum = parseFloat(manualPriceYuan);

    if (!priceNum || priceNum <= 0) {
      setPricingError('Введите корректную цену в юанях.');
      return;
    }

    setPricingLoading(true);
    setCartMessage(null);
    setCartError(null);

    try {
      const result = await pricingApi.calculateManual({
        priceYuan: priceNum,
        deliveryCategory: manualCategory as DeliveryCategory,
      });

      setManualPricing(result);
      setAddQuantity(1);
      setAddedSkuId(null);
    } catch (requestError) {
      setPricingError(
        extractAxiosMessage(requestError) ??
          'Не удалось выполнить расчёт. Попробуйте ещё раз позже.',
      );
    }
  };

  // --- Add to cart (API mode) ---
  const handleAddToCart = async () => {
    if (!product || !selectedSku || !pricing) {
      return;
    }

    setIsAddingToCart(true);
    setCartMessage(null);
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
        quantity: addQuantity,
      });

      setCart(response);
      setAddedSkuId(pricing.dwSkuId);
      setCartMessage(
        addQuantity === 1
          ? 'Товар добавлен в корзину.'
          : `В корзину добавлено: ${addQuantity} шт.`,
      );
      hapticNotification('success');
    } catch (requestError) {
      setCartError(
        extractAxiosMessage(requestError) ??
          'Не удалось добавить товар в корзину. Попробуйте позже.',
      );
      hapticNotification('error');
    } finally {
      setIsAddingToCart(false);
    }
  };

  // --- Add to cart (manual mode) ---
  const handleManualAddToCart = async () => {
    if (!manualPricing) {
      return;
    }

    setIsAddingToCart(true);
    setCartMessage(null);
    setCartError(null);

    const manualId = `manual-${Date.now()}`;
    const sizeText = manualSize.trim() || 'Не указан';

    try {
      const response = await cartApi.addToCart({
        dewuLink: link.trim(),
        dwSpuId: manualId,
        dwSkuId: manualId,
        productTitle: getDeliveryCategoryLabel(manualCategory),
        size: sizeText,
        priceYuan: manualPricing.priceYuan,
        totalUsd: manualPricing.totalUsd,
        deliveryRub: manualPricing.deliveryRub,
        dutyRub: manualPricing.dutyRub,
        categoryGroup: manualPricing.categoryGroup,
        deliveryCategory: manualPricing.deliveryCategory,
        estimatedWeightKg: manualPricing.estimatedWeightKg,
        quantity: addQuantity,
      });

      setCart(response);
      setAddedSkuId(manualId);
      setCartMessage(
        addQuantity === 1
          ? 'Товар добавлен в корзину.'
          : `В корзину добавлено: ${addQuantity} шт.`,
      );
      hapticNotification('success');
    } catch (requestError) {
      setCartError(
        extractAxiosMessage(requestError) ??
          'Не удалось добавить товар в корзину. Попробуйте позже.',
      );
      hapticNotification('error');
    } finally {
      setIsAddingToCart(false);
    }
  };

  // --- Manager help request ---
  const handleManagerHelpRequest = async () => {
    setIsManagerRequesting(true);
    setManagerRequestError(null);

    try {
      await pricingApi.requestManagerHelp({
        dewuLink: link.trim(),
        size: manualSize.trim() || undefined,
        deliveryCategory: manualCategory as DeliveryCategory,
        comment: undefined,
      });

      setManagerRequestSent(true);
      hapticNotification('success');
    } catch (requestError) {
      setManagerRequestError(
        extractAxiosMessage(requestError) ??
          'Не удалось отправить запрос. Попробуйте позже.',
      );
      hapticNotification('error');
    } finally {
      setIsManagerRequesting(false);
    }
  };

  const isResolveDisabled = isLoadingProduct || !link.trim();

  const inputClass =
    'w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[var(--accent)] focus:outline-none';

  return (
    <PageSection>
      {/* --- Link input --- */}
      <SectionCard>
        <label className="block">
          <span className="text-sm font-medium text-white">Ссылка на товар</span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://dw4.co/t/A/..."
              className="min-w-0 flex-1 rounded-[16px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text.trim()) {
                    setLink(text.trim());
                    hapticImpact('light');
                  }
                } catch {
                  hapticNotification('error');
                }
              }}
              className="shrink-0 rounded-[16px] border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white transition active:scale-95"
            >
              Вставить
            </button>
          </div>
        </label>

        <button
          type="button"
          onClick={handleResolveProduct}
          disabled={isResolveDisabled}
          className="mt-4 w-full rounded-[20px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingProduct ? 'Получаем товар...' : 'Получить товар'}
        </button>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className="text-xs text-[var(--accent)] transition hover:underline"
          >
            {isHelpOpen ? 'Скрыть подсказку ▲' : 'Как скопировать ссылку? ▼'}
          </button>

          {isHelpOpen ? (
            <div className="mt-2 space-y-2 rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
              <p className="font-medium text-white">Из приложения Dewu (Poizon):</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>Откройте карточку товара в приложении</li>
                <li>Нажмите кнопку «Поделиться» (иконка стрелки вверху справа)</li>
                <li>Выберите «Скопировать ссылку»</li>
                <li>Вставьте ссылку здесь</li>
              </ol>
              <p className="pt-1">Поддерживаются короткие ссылки <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white">dw4.co</span> и прямые ссылки Dewu.</p>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {/* --- Feedback messages --- */}
      {error && hasSubmitted && !manualMode ? <FeedbackMessage tone="error" onRetry={handleResolveProduct}>{error}</FeedbackMessage> : null}
      {cartMessage ? <FeedbackMessage tone="success">{cartMessage}</FeedbackMessage> : null}
      {cartError ? <FeedbackMessage tone="error">{cartError}</FeedbackMessage> : null}

      {/* --- Loading state --- */}
      {isLoadingProduct ? (
        <LoadingBlock
          title="Загружаем карточку товара"
          description="Проверяем ссылку, получаем карточку Dewu и готовим размеры."
        />
      ) : null}

      {/* --- Empty state (no product, no manual mode) --- */}
      {!product && !isLoadingProduct && !manualMode ? (
        <EmptyState
          title="Начните с ссылки"
          description="Вставьте ссылку Dewu, чтобы увидеть карточку товара, доступные размеры и предварительный расчёт."
        />
      ) : null}

      {/* ============================== */}
      {/* === MANUAL FALLBACK MODE ===== */}
      {/* ============================== */}
      {manualMode ? (
        <div className="space-y-4">
          <SectionCard>
            <div className="rounded-[16px] border border-amber-300/20 bg-amber-400/10 px-4 py-3">
              <p className="text-sm font-medium text-amber-100">
                Не удалось получить данные о товаре автоматически
              </p>
              <p className="mt-1 text-xs text-amber-200/70">
                API Dewu временно недоступен. Вы можете указать данные вручную для расчёта или запросить помощь менеджера.
              </p>
            </div>
          </SectionCard>

          <SectionCard>
            <h3 className="text-lg font-semibold text-white">Ручной расчёт</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Укажите цену, размер и категорию товара для расчёта стоимости.
            </p>

            <div className="mt-4 space-y-3">
              {/* Price */}
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Цена в юанях (¥)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={manualPriceYuan}
                  onChange={(e) => { setManualPriceYuan(e.target.value); clearManualPricing(); }}
                  placeholder="Например: 899"
                  className={inputClass}
                  min="1"
                  step="1"
                />

                <button
                  type="button"
                  onClick={() => setIsPriceHelpOpen(!isPriceHelpOpen)}
                  className="mt-2 text-xs text-[var(--accent)] transition hover:underline"
                >
                  {isPriceHelpOpen ? 'Скрыть ▲' : 'Где найти цену? ▼'}
                </button>

                {isPriceHelpOpen ? (
                  <div className="mt-2 rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
                    <p className="font-medium text-white">Как найти цену в Poizon:</p>
                    <ol className="mt-1 list-inside list-decimal space-y-1">
                      <li>Откройте товар в приложении Poizon</li>
                      <li>Выберите нужный размер</li>
                      <li>Цена отображается в ¥ под кнопкой покупки</li>
                    </ol>
                    <p className="mt-2 text-amber-200/70">
                      Важно: для просмотра цен нужна авторизация в приложении Poizon.
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Size */}
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Размер</label>
                <input
                  type="text"
                  value={manualSize}
                  onChange={(e) => setManualSize(e.target.value)}
                  placeholder="Например: 42, M, 27cm"
                  className={inputClass}
                  maxLength={50}
                />
              </div>

              {/* Category — two-step picker */}
              <div>
                <label className="mb-2 block text-xs text-[var(--muted)]">Категория товара</label>

                {openGroupKey === null ? (
                  /* Step 1: choose group */
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORY_GROUPS.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => { setOpenGroupKey(group.key); hapticSelection(); }}
                        className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white transition active:scale-[0.98]"
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Step 2: choose subcategory */
                  <>
                    <button
                      type="button"
                      onClick={() => { setOpenGroupKey(null); hapticSelection(); }}
                      className="mb-2 text-xs text-[var(--accent)] transition hover:underline"
                    >
                      ← Назад к категориям
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORY_GROUPS.find((g) => g.key === openGroupKey)?.categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => { setManualCategory(cat); clearManualPricing(); hapticSelection(); }}
                          className={[
                            'rounded-[16px] border px-4 py-3 text-left text-sm font-medium transition active:scale-[0.98]',
                            manualCategory === cat
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-slate-950'
                              : 'border-white/10 bg-white/5 text-white',
                          ].join(' ')}
                        >
                          {getDeliveryCategoryLabel(cat)}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Selected category display */}
                {manualCategory ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Выбрано: <span className="font-medium text-white">{getDeliveryCategoryLabel(manualCategory)}</span>
                    {manualCategory === 'OTHER' ? (
                      <span className="ml-1 text-amber-200/70">— стоимость доставки уточнит менеджер</span>
                    ) : null}
                  </p>
                ) : null}
              </div>

              {pricingError ? <FeedbackMessage tone="error">{pricingError}</FeedbackMessage> : null}

              <button
                type="button"
                onClick={handleManualCalculate}
                disabled={isLoadingPricing || !manualPriceYuan}
                className="w-full rounded-[20px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingPricing ? 'Считаем...' : 'Рассчитать стоимость'}
              </button>
            </div>
          </SectionCard>

          {/* Manual pricing result */}
          {manualPricing ? (
            <SectionCard>
              <h3 className="text-lg font-semibold text-white">Предварительный расчёт</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Ручной ввод данных</p>

              <div className="mt-4 space-y-3">
                <InfoRow label="Размер" value={manualSize.trim() || 'Не указан'} />
                <InfoRow label="Цена" value={`${manualPricing.priceYuan.toFixed(2)} CNY`} />
                <div className="border-t border-white/5" />
                <p className="text-xs text-[var(--muted)]">Выкуп товара (USD)</p>
                <InfoRow label="Итог товара" value={`$${manualPricing.totalUsd.toFixed(2)}`} accent />
                <div className="border-t border-white/5" />
                <p className="text-xs text-[var(--muted)]">Доставка и пошлина (RUB)</p>
                <InfoRow
                  label="Категория доставки"
                  value={getDeliveryCategoryLabel(manualPricing.deliveryCategory)}
                />
                {manualPricing.deliveryCategory === 'OTHER' ? (
                  <div className="rounded-[12px] border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                    Доставка и вес будут уточнены менеджером после оформления заявки.
                  </div>
                ) : (
                  <>
                    <InfoRow label="Примерная доставка" value={`${manualPricing.deliveryRub} ₽`} />
                    <InfoRow
                      label="Примерный вес"
                      value={`${manualPricing.estimatedWeightKg.toFixed(2)} кг`}
                    />
                  </>
                )}
                <InfoRow label="Примерная пошлина" value={`${manualPricing.dutyRub} ₽`} />
              </div>
            </SectionCard>
          ) : null}

          {/* Manager help section */}
          <SectionCard>
            <h3 className="text-sm font-semibold text-white">Не знаете цену или размер?</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Менеджер найдёт нужную информацию и свяжется с вами в Telegram.
            </p>

            {managerRequestSent ? (
              <div className="mt-3 rounded-[16px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Запрос отправлен! Менеджер скоро свяжется с вами.
              </div>
            ) : (
              <>
                {managerRequestError ? (
                  <div className="mt-3">
                    <FeedbackMessage tone="error">{managerRequestError}</FeedbackMessage>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleManagerHelpRequest}
                  disabled={isManagerRequesting || !link.trim()}
                  className="mt-3 w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  {isManagerRequesting ? 'Отправляем...' : 'Уточнить у менеджера'}
                </button>
              </>
            )}
          </SectionCard>
        </div>
      ) : null}

      {/* ============================== */}
      {/* === NORMAL API MODE ========== */}
      {/* ============================== */}
      {product ? (
        <div className="space-y-4">
          <ProductMiniCard
            title={product.title}
            subtitle={product.brand ?? 'Dewu'}
            gallery={product.gallery.length > 0 ? product.gallery : undefined}
            mainImage={product.mainImage}
          />

          <SectionCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Размеры и цены</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Доступно {product.availableSkus.length} из {product.skus.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {product.sizeChart ? (
                  <button
                    type="button"
                    onClick={() => setIsSizeChartOpen(true)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition active:scale-95"
                  >
                    Размерная сетка
                  </button>
                ) : null}
                {isLoadingPricing ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    Считаем…
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {product.skus.map((sku) => {
                const isSelected = selectedSku?.dwSkuId === sku.dwSkuId;

                return (
                  <button
                    key={sku.dwSkuId}
                    type="button"
                    disabled={!sku.isAvailable}
                    onClick={() => { selectSku(sku); hapticImpact('light'); }}
                    className={[
                      'rounded-[20px] border px-4 py-3 text-left transition',
                      sku.isAvailable
                        ? isSelected
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-slate-950'
                          : 'border-white/10 bg-white/5 text-white'
                        : 'cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500',
                    ].join(' ')}
                  >
                    <div className="text-sm font-semibold">{sku.size}</div>
                    <div className="mt-1 text-xs opacity-80">
                      {sku.isAvailable ? formatYuan(sku.priceYuan) : 'Нет в наличии'}
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {selectedSku ? (
            <>
              <SectionCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Предварительный расчёт</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Используются текущие настройки комиссии, доставки и пошлины из базы.
                    </p>
                  </div>
                </div>

                {isLoadingPricing ? (
                  <div className="mt-4">
                    <LoadingBlock
                      title="Считаем стоимость"
                      description="Готовим цену, доставку и пошлину для выбранного SKU."
                    />
                  </div>
                ) : null}

                {pricingError ? <div className="mt-4"><FeedbackMessage tone="error">{pricingError}</FeedbackMessage></div> : null}

                {pricing ? (
                  <div className="mt-4 space-y-3">
                    <InfoRow
                      label={`Размер: ${selectedSku.size}`}
                      value={selectedSku.priceYuan ? `${selectedSku.priceYuan.toFixed(2)} CNY` : '—'}
                    />
                    <div className="border-t border-white/5" />
                    <p className="text-xs text-[var(--muted)]">Выкуп товара (USD)</p>
                    <InfoRow label="Итог товара" value={`$${pricing.totalUsd.toFixed(2)}`} accent />
                    <div className="border-t border-white/5" />
                    <p className="text-xs text-[var(--muted)]">Доставка и пошлина (RUB)</p>
                    <InfoRow label="Примерная доставка" value={`${pricing.deliveryRub} ₽`} />
                    <InfoRow
                      label="Категория доставки"
                      value={getDeliveryCategoryLabel(pricing.deliveryCategory)}
                    />
                    <InfoRow
                      label="Примерный вес"
                      value={`${pricing.estimatedWeightKg.toFixed(2)} кг`}
                    />
                    <InfoRow label="Примерная пошлина" value={`${pricing.dutyRub} ₽`} />
                  </div>
                ) : null}

              </SectionCard>
            </>
          ) : (
            <EmptyState
              title="Выберите размер"
              description="Нажмите на доступный SKU, чтобы увидеть расчёт и добавить товар в корзину."
            />
          )}
        </div>
      ) : null}

      {isSizeChartOpen && product?.sizeChart ? (
        <SizeChartModal
          imageUrl={product.sizeChart}
          onClose={() => setIsSizeChartOpen(false)}
        />
      ) : null}

      {/* --- Sticky footer: API mode --- */}
      {product && selectedSku && pricing ? (
        <div className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 w-[calc(100%-24px)] max-w-md -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-[22px] border border-[var(--surface-border)] bg-[var(--surface)] p-2 shadow-[0_-8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div className="flex shrink-0 items-center rounded-full border border-white/10 bg-slate-950/40 p-0.5">
              <button
                type="button"
                onClick={() => { setAddQuantity((v) => Math.max(1, v - 1)); hapticSelection(); }}
                disabled={isAddingToCart || addQuantity <= 1}
                className="grid h-8 w-8 place-items-center rounded-full text-base font-semibold text-white transition disabled:opacity-35"
              >
                −
              </button>
              <span className="min-w-7 text-center text-sm font-semibold text-white">{addQuantity}</span>
              <button
                type="button"
                onClick={() => { setAddQuantity((v) => Math.min(20, v + 1)); hapticSelection(); }}
                disabled={isAddingToCart}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-base font-semibold text-white transition disabled:opacity-35"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAddingToCart}
              className={[
                'flex-1 rounded-[16px] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50',
                addedSkuId === pricing.dwSkuId
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-[var(--accent)] text-slate-950',
              ].join(' ')}
            >
              {isAddingToCart
                ? 'Добавляем...'
                : addedSkuId === pricing.dwSkuId
                  ? `Добавлено • ${addQuantity} шт.`
                  : `В корзину • $${(pricing.totalUsd * addQuantity).toFixed(2)}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* --- Sticky footer: Manual mode --- */}
      {manualMode && manualPricing ? (
        <div className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 w-[calc(100%-24px)] max-w-md -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-[22px] border border-[var(--surface-border)] bg-[var(--surface)] p-2 shadow-[0_-8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div className="flex shrink-0 items-center rounded-full border border-white/10 bg-slate-950/40 p-0.5">
              <button
                type="button"
                onClick={() => { setAddQuantity((v) => Math.max(1, v - 1)); hapticSelection(); }}
                disabled={isAddingToCart || addQuantity <= 1}
                className="grid h-8 w-8 place-items-center rounded-full text-base font-semibold text-white transition disabled:opacity-35"
              >
                −
              </button>
              <span className="min-w-7 text-center text-sm font-semibold text-white">{addQuantity}</span>
              <button
                type="button"
                onClick={() => { setAddQuantity((v) => Math.min(20, v + 1)); hapticSelection(); }}
                disabled={isAddingToCart}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-base font-semibold text-white transition disabled:opacity-35"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleManualAddToCart}
              disabled={isAddingToCart}
              className={[
                'flex-1 rounded-[16px] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50',
                addedSkuId
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-[var(--accent)] text-slate-950',
              ].join(' ')}
            >
              {isAddingToCart
                ? 'Добавляем...'
                : addedSkuId
                  ? `Добавлено • ${addQuantity} шт.`
                  : `В корзину • $${(manualPricing.totalUsd * addQuantity).toFixed(2)}`}
            </button>
          </div>
        </div>
      ) : null}
    </PageSection>
  );
}
