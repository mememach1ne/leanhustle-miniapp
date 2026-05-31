'use client';

import type {
  CreateManualOrderRequest,
  DeliveryAddressDto,
  DewuProductSku,
  DewuResolvedProduct,
  ManualOrderClientLookupResponse,
} from '@lean-poizon/shared';
import { DeliveryCategory } from '@lean-poizon/shared';
import { useState } from 'react';

import { adminApi } from '../../lib/api-client';
import {
  CATEGORY_GROUPS,
  DELIVERY_CATEGORY_LABELS,
} from '../../lib/delivery-categories';
import { extractAxiosMessage } from '../../lib/error-utils';
import { FeedbackMessage } from './feedback-message';
import { SectionCard } from './section-card';

interface DraftItem {
  productTitle: string;
  dewuLink: string;
  priceYuan: string;
  deliveryCategory: DeliveryCategory;
  sizeLabel: string;
  quantity: string;
  /** Last successfully resolved product (per item) for the size picker. */
  resolved?: DewuResolvedProduct;
  resolving?: boolean;
  resolveError?: string | null;
}

const emptyItem = (): DraftItem => ({
  productTitle: '',
  dewuLink: '',
  priceYuan: '',
  deliveryCategory: DeliveryCategory.SNEAKERS,
  sizeLabel: '',
  quantity: '1',
});

const inputClass =
  'min-w-0 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]';

// Special value used in the address picker when staff wants to enter
// delivery details by hand instead of using a saved address.
const MANUAL_ADDRESS_ID = '__manual__';

export function ManualOrderForm({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState('');

  // Client lookup state — populated after staff blurs/submits the username.
  const [lookup, setLookup] = useState<ManualOrderClientLookupResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Delivery: either pick a saved address by id, or pick MANUAL_ADDRESS_ID
  // to type custom values. We always keep the editable fields below so staff
  // can override even a picked saved address.
  const [selectedAddressId, setSelectedAddressId] = useState<string>(MANUAL_ADDRESS_ID);
  const [fullName, setFullName] = useState('');
  const [cdekAddress, setCdekAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');

  // Subscriber benefit toggle. Auto-on after lookup if the client is
  // a subscriber AND hasn't used the benefit. Staff can force on/off.
  const [applySubscriberBenefit, setApplySubscriberBenefit] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (index: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const runClientLookup = async () => {
    const normalized = username.trim().replace(/^@+/, '');
    if (!normalized) {
      setLookupError('Укажите username клиента.');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    try {
      const result = await adminApi.lookupManualOrderClient(normalized);
      setLookup(result);
      setApplySubscriberBenefit(
        result.subscription.isChannelSubscriber &&
          !result.subscription.hasUsedSubscriberBenefit,
      );
      const defaultAddress =
        result.addresses.find((a) => a.isDefault) ?? result.addresses[0] ?? null;
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        applyAddressToFields(defaultAddress);
      } else {
        setSelectedAddressId(MANUAL_ADDRESS_ID);
      }
    } catch (err) {
      setLookup(null);
      setLookupError(extractAxiosMessage(err) ?? 'Клиент не найден.');
    } finally {
      setLookupLoading(false);
    }
  };

  const applyAddressToFields = (address: DeliveryAddressDto) => {
    setFullName(address.fullName);
    setCdekAddress(address.cdekAddress);
    setPhone(address.phone);
  };

  const handleAddressPick = (id: string) => {
    setSelectedAddressId(id);
    if (id === MANUAL_ADDRESS_ID) {
      // Keep current values so staff can edit freely.
      return;
    }
    const address = lookup?.addresses.find((a) => a.id === id);
    if (address) applyAddressToFields(address);
  };

  const handleResolveProduct = async (index: number) => {
    const item = items[index];
    const link = item?.dewuLink.trim();
    if (!link) {
      updateItem(index, {
        resolveError: 'Сначала введите ссылку на товар.',
      });
      return;
    }
    updateItem(index, { resolving: true, resolveError: null });
    try {
      const product = await adminApi.resolveManualOrderProduct(link);
      const firstSku =
        product.availableSkus[0] ?? product.skus[0] ?? null;
      const fallbackPrice = firstSku
        ? firstSku.priceYuan != null
          ? firstSku.priceYuan
          : firstSku.minBidPrice
          ? firstSku.minBidPrice / 100
          : null
        : null;
      updateItem(index, {
        resolved: product,
        resolving: false,
        resolveError: null,
        productTitle: product.title || item.productTitle,
        sizeLabel: firstSku?.size ?? item.sizeLabel,
        priceYuan:
          fallbackPrice != null
            ? String(Math.round(fallbackPrice * 100) / 100)
            : item.priceYuan,
      });
    } catch (err) {
      updateItem(index, {
        resolving: false,
        resolveError:
          extractAxiosMessage(err) ?? 'Не удалось распознать товар. Введите данные вручную.',
      });
    }
  };

  const handlePickSku = (index: number, sku: DewuProductSku) => {
    const priceYuan =
      sku.priceYuan != null
        ? sku.priceYuan
        : sku.minBidPrice
        ? sku.minBidPrice / 100
        : null;
    updateItem(index, {
      sizeLabel: sku.size,
      priceYuan: priceYuan != null ? String(Math.round(priceYuan * 100) / 100) : '',
    });
  };

  const validate = (): string | null => {
    if (!username.trim()) return 'Укажите username клиента.';
    if (!lookup) return 'Сначала найдите клиента по username.';
    if (items.length === 0) return 'Добавьте хотя бы один товар.';
    for (const [i, item] of items.entries()) {
      if (!item.productTitle.trim()) return `Товар №${i + 1}: укажите название.`;
      const price = Number(item.priceYuan.replace(',', '.'));
      if (!Number.isFinite(price) || price <= 0)
        return `Товар №${i + 1}: укажите корректную цену в юанях.`;
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1)
        return `Товар №${i + 1}: укажите количество (целое число).`;
    }
    if (!fullName.trim()) return 'Укажите ФИО получателя.';
    if (!cdekAddress.trim()) return 'Укажите адрес / пункт СДЭК.';
    if (!phone.trim()) return 'Укажите телефон получателя.';
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: CreateManualOrderRequest = {
      username: username.trim().replace(/^@+/, ''),
      items: items.map((item) => ({
        productTitle: item.productTitle.trim(),
        dewuLink: item.dewuLink.trim() || null,
        priceYuan: Number(item.priceYuan.replace(',', '.')),
        deliveryCategory: item.deliveryCategory,
        sizeLabel: item.sizeLabel.trim() || null,
        quantity: Number(item.quantity),
      })),
      delivery: {
        fullName: fullName.trim(),
        cdekAddress: cdekAddress.trim(),
        phone: phone.trim(),
        comment: comment.trim() || null,
      },
      applySubscriberBenefit,
    };

    setSubmitting(true);
    try {
      const order = await adminApi.createManualOrder(payload);
      setSuccess(`Заказ ${order.orderNumber} создан и отправлен клиенту.`);
      setUsername('');
      setLookup(null);
      setItems([emptyItem()]);
      setFullName('');
      setCdekAddress('');
      setPhone('');
      setComment('');
      setSelectedAddressId(MANUAL_ADDRESS_ID);
      setApplySubscriberBenefit(false);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось создать заказ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Новый заказ вручную</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Закрыть
        </button>
      </div>

      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
      {success ? <FeedbackMessage tone="success">{success}</FeedbackMessage> : null}

      <div className="space-y-4">
        {/* Client */}
        <div>
          <label className="mb-1 block text-xs text-white/60">Клиент (@username)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => {
                if (username.trim() && !lookup) void runClientLookup();
              }}
              placeholder="username"
              className={inputClass}
            />
            <button
              type="button"
              onClick={runClientLookup}
              disabled={lookupLoading || !username.trim()}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {lookupLoading ? '...' : 'Найти'}
            </button>
          </div>
          {lookupError ? (
            <p className="mt-1 text-[11px] text-rose-300">{lookupError}</p>
          ) : (
            <p className="mt-1 text-[10px] text-white/30">
              Клиент должен был хотя бы раз запустить бота.
            </p>
          )}
        </div>

        {/* Client summary + subscriber benefit toggle */}
        {lookup ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2 text-xs text-white/80">
            <div>
              <span className="text-white/60">Найден: </span>
              <span className="font-semibold text-white">
                {[lookup.client.firstName, lookup.client.lastName].filter(Boolean).join(' ')}
              </span>
              {lookup.client.username ? (
                <span className="text-white/40"> (@{lookup.client.username})</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/60">
              <span>
                Подписан на канал:{' '}
                <span className={lookup.subscription.isChannelSubscriber ? 'text-emerald-300' : 'text-white/50'}>
                  {lookup.subscription.isChannelSubscriber ? 'да' : 'нет'}
                </span>
              </span>
              <span>
                Бонус уже использован:{' '}
                <span className={lookup.subscription.hasUsedSubscriberBenefit ? 'text-amber-300' : 'text-white/50'}>
                  {lookup.subscription.hasUsedSubscriberBenefit ? 'да' : 'нет'}
                </span>
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-white">
              <input
                type="checkbox"
                checked={applySubscriberBenefit}
                onChange={(e) => setApplySubscriberBenefit(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              🎁 Применить бонус подписчика к этому заказу
            </label>
            {applySubscriberBenefit && lookup.subscription.hasUsedSubscriberBenefit ? (
              <p className="text-[10px] text-amber-300">
                Внимание: клиент уже использовал бонус — он будет применён принудительно.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Items */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-white/70">Товары</p>
          {items.map((item, index) => (
            <div
              key={index}
              className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/60">
                  Товар №{index + 1}
                </span>
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-[11px] font-semibold text-rose-300"
                  >
                    Удалить
                  </button>
                ) : null}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={item.dewuLink}
                  onChange={(e) => updateItem(index, { dewuLink: e.target.value })}
                  placeholder="Ссылка Poizon/Dewu (необязательно)"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => handleResolveProduct(index)}
                  disabled={item.resolving || !item.dewuLink.trim()}
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {item.resolving ? '...' : 'Распознать'}
                </button>
              </div>
              {item.resolveError ? (
                <p className="text-[11px] text-amber-300">{item.resolveError}</p>
              ) : null}

              {item.resolved ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 space-y-2">
                  <p className="text-[11px] text-white/60">
                    Распознано: <span className="text-white">{item.resolved.title}</span>
                  </p>
                  {item.resolved.skus.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(item.resolved.availableSkus.length > 0
                        ? item.resolved.availableSkus
                        : item.resolved.skus
                      ).map((sku) => {
                        const priceYuan =
                          sku.priceYuan != null
                            ? sku.priceYuan
                            : sku.minBidPrice / 100;
                        const priceText =
                          Number.isFinite(priceYuan) && priceYuan > 0
                            ? ` · ${Math.round(priceYuan)}¥`
                            : '';
                        const active = item.sizeLabel === sku.size;
                        return (
                          <button
                            type="button"
                            key={sku.dwSkuId}
                            onClick={() => handlePickSku(index, sku)}
                            className={`rounded-lg border px-2 py-1 text-[11px] ${
                              active
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-slate-950'
                                : 'border-white/10 bg-white/5 text-white/80'
                            }`}
                          >
                            {sku.size}
                            {priceText}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <p className="text-[10px] text-white/40">
                    Можно изменить любое поле ниже вручную.
                  </p>
                </div>
              ) : null}

              <input
                type="text"
                value={item.productTitle}
                onChange={(e) => updateItem(index, { productTitle: e.target.value })}
                placeholder="Название товара"
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={item.priceYuan}
                  onChange={(e) => updateItem(index, { priceYuan: e.target.value })}
                  placeholder="Цена, ¥"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={item.sizeLabel}
                  onChange={(e) => updateItem(index, { sizeLabel: e.target.value })}
                  placeholder="Размер"
                  className={inputClass}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  placeholder="Кол-во"
                  className={`${inputClass} max-w-[80px]`}
                />
              </div>
              <select
                value={item.deliveryCategory}
                onChange={(e) =>
                  updateItem(index, {
                    deliveryCategory: e.target.value as DeliveryCategory,
                  })
                }
                className={inputClass}
              >
                {CATEGORY_GROUPS.map((group) => (
                  <optgroup key={group.key} label={`${group.emoji} ${group.label}`}>
                    {group.categories.map((category) => (
                      <option key={category} value={category} className="bg-slate-800">
                        {DELIVERY_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-xl border border-dashed border-white/20 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/5"
          >
            + Добавить товар
          </button>
        </div>

        {/* Delivery */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/70">Данные доставки</p>

          {lookup && lookup.addresses.length > 0 ? (
            <div className="space-y-1.5 rounded-2xl border border-white/10 bg-white/5 p-2">
              <p className="text-[11px] text-white/50">Сохранённые адреса клиента:</p>
              {lookup.addresses.map((address) => {
                const active = selectedAddressId === address.id;
                return (
                  <button
                    type="button"
                    key={address.id}
                    onClick={() => handleAddressPick(address.id)}
                    className={`flex w-full flex-col items-start rounded-lg border px-2 py-1.5 text-left text-[11px] ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/80'
                    }`}
                  >
                    <span className="font-semibold">
                      {address.isDefault ? '⭐ ' : ''}
                      {address.fullName}
                    </span>
                    <span className="text-white/60">{address.cdekAddress}</span>
                    <span className="text-white/40">{address.phone}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleAddressPick(MANUAL_ADDRESS_ID)}
                className={`w-full rounded-lg border px-2 py-1.5 text-[11px] ${
                  selectedAddressId === MANUAL_ADDRESS_ID
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-white'
                    : 'border-white/10 bg-white/[0.03] text-white/80'
                }`}
              >
                ✏️ Ввести данные вручную
              </button>
            </div>
          ) : null}

          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="ФИО получателя"
            className={inputClass}
          />
          <input
            type="text"
            value={cdekAddress}
            onChange={(e) => setCdekAddress(e.target.value)}
            placeholder="Адрес / пункт выдачи СДЭК"
            className={inputClass}
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон"
            className={inputClass}
          />
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий (необязательно)"
            className={inputClass}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
        >
          {submitting ? 'Создание...' : 'Создать заказ'}
        </button>
      </div>
    </SectionCard>
  );
}
