'use client';

import type { DewuProductSku, DewuResolvedProduct } from '@lean-poizon/shared';
import { useState } from 'react';

import { adminApi } from '../../lib/api-client';
import { extractAxiosMessage } from '../../lib/error-utils';
import { FeedbackMessage } from './feedback-message';
import { type PickedPoint, PickupPointPicker } from './pickup-point-picker';
import { SectionCard } from './section-card';

const inputClass =
  'min-w-0 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]';

interface DraftItem {
  key: number;
  link: string;
  product: DewuResolvedProduct | null;
  resolving: boolean;
  resolveError: string | null;
  sku: DewuProductSku | null;
  quantity: string;
  chinaTrack: string;
}

let nextKey = 1;
const emptyItem = (): DraftItem => ({
  key: nextKey++,
  link: '',
  product: null,
  resolving: false,
  resolveError: null,
  sku: null,
  quantity: '1',
  chinaTrack: '',
});

/**
 * Admin tool: register purchases that aren't customer orders (for yourself
 * or without commission) straight in the RAKETA cabinet. One RAKETA order
 * per item; with a recipient + CDEK point several items are combined into
 * one consolidation.
 */
export function RaketaQuickOrderForm({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [label, setLabel] = useState('');
  const [withDelivery, setWithDelivery] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('+7');
  const [point, setPoint] = useState<PickedPoint | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const patch = (key: number, data: Partial<DraftItem>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...data } : item)));

  const resolve = async (item: DraftItem) => {
    if (!item.link.trim()) return;
    patch(item.key, { resolving: true, resolveError: null, product: null, sku: null });
    try {
      const product = await adminApi.resolveManualOrderProduct(item.link.trim());
      patch(item.key, { product, resolving: false });
    } catch (err) {
      patch(item.key, {
        resolving: false,
        resolveError: extractAxiosMessage(err) ?? 'Не удалось получить товар по ссылке.',
      });
    }
  };

  const submit = async () => {
    for (const [i, item] of items.entries()) {
      if (!item.product || !item.sku || item.sku.priceYuan === null) {
        setError(`Товар ${i + 1}: найдите товар по ссылке и выберите размер.`);
        return;
      }
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        setError(`Товар ${i + 1}: количество — целое число от 1.`);
        return;
      }
      if (!item.chinaTrack.trim()) {
        setError(`Товар ${i + 1}: введите китайский трек.`);
        return;
      }
    }
    if (withDelivery) {
      if (!/^[А-Яа-яЁё-]+(\s+[А-Яа-яЁё-]+){1,2}$/.test(recipientName.trim())) {
        setError('ФИО получателя: фамилия и имя (и отчество) на русском.');
        return;
      }
      if (!/^\+7\d{10}$/.test(recipientPhone.trim())) {
        setError('Телефон получателя в формате +7XXXXXXXXXX.');
        return;
      }
      if (!point) {
        setError('Выберите пункт СДЭК.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await adminApi.createRaketaQuickOrder({
        label: label.trim() || undefined,
        items: items.map((item) => {
          const product = item.product as DewuResolvedProduct;
          const sku = item.sku as DewuProductSku;
          return {
            link: product.originalLink || item.link.trim(),
            dwSpuId: product.dwSpuId,
            productTitle: product.title,
            titleCn: product.titleCn,
            categoryL1: product.categoryL1,
            categoryL2: product.categoryL2,
            categoryL3: product.categoryL3,
            size: [sku.size, sku.version].filter(Boolean).join(' '),
            priceYuan: sku.priceYuan as number,
            quantity: Number(item.quantity),
            chinaTrackNumber: item.chinaTrack.trim(),
          };
        }),
        delivery:
          withDelivery && point
            ? {
                fullName: recipientName.trim().replace(/\s+/g, ' '),
                phone: recipientPhone.trim(),
                pointAddress: point.label.replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, ''),
                pickupPoint: point.pickupPoint,
              }
            : undefined,
      });
      const created = result.orders
        .map((o) => `${o.raketaTrackNumber ?? o.id}${o.existed ? ' (уже был)' : ''}`)
        .join(', ');
      setSuccess(
        `Заказы в RAKETA: ${created}.${
          result.deliveryAssigned
            ? result.consolidationId
              ? ' Объединение создано, получатель и пункт СДЭК указаны.'
              : ' Получатель и пункт СДЭК указаны.'
            : ''
        }`,
      );
      if (result.deliveryError) {
        setError(`Заказы созданы, но получателя/пункт указать не удалось: ${result.deliveryError}`);
      }
      setItems([emptyItem()]);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось создать заказы в RAKETA.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Заказ в RAKETA (себе / без комиссии)</h3>
          <p className="mt-0.5 text-[11px] text-white/40">
            Создаётся сразу в кабинете RAKETA, без заказа клиента и комиссии.
          </p>
        </div>
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
        {items.map((item, index) => {
          const availableSkus =
            item.product?.skus.filter((sku) => sku.isAvailable && sku.priceYuan !== null) ?? [];
          return (
            <div key={item.key} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white/70">Товар {index + 1}</p>
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((x) => x.key !== item.key))}
                    className="text-[11px] text-rose-300"
                  >
                    Удалить
                  </button>
                ) : null}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={item.link}
                  onChange={(e) => patch(item.key, { link: e.target.value })}
                  placeholder="Ссылка Poizon: https://dw4.co/t/A/..."
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => resolve(item)}
                  disabled={item.resolving || !item.link.trim()}
                  className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {item.resolving ? 'Загружаем…' : 'Найти'}
                </button>
              </div>
              {item.resolving ? (
                <p className="text-[11px] text-white/40">Обычно это занимает 10–20 секунд.</p>
              ) : null}
              {item.resolveError ? <p className="text-[11px] text-rose-300">{item.resolveError}</p> : null}

              {item.product ? (
                <>
                  <div className="flex gap-3">
                    {item.product.mainImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.product.mainImage}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain"
                      />
                    ) : null}
                    <p className="min-w-0 text-xs font-semibold text-white">{item.product.title}</p>
                  </div>

                  {availableSkus.length === 0 ? (
                    <p className="text-xs text-rose-300">Нет доступных размеров с ценой.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableSkus.map((sku) => (
                        <button
                          key={sku.dwSkuId}
                          type="button"
                          onClick={() => patch(item.key, { sku })}
                          className={[
                            'rounded-xl border px-3 py-2 text-left text-xs transition',
                            item.sku?.dwSkuId === sku.dwSkuId
                              ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white'
                              : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10',
                          ].join(' ')}
                        >
                          <span className="block font-semibold">
                            {[sku.size, sku.version].filter(Boolean).join(' · ')}
                          </span>
                          <span className="text-white/50">¥{sku.priceYuan}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-[1fr_88px] gap-2">
                    <input
                      type="text"
                      value={item.chinaTrack}
                      onChange={(e) => patch(item.key, { chinaTrack: e.target.value })}
                      placeholder="Китайский трек SF…"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => patch(item.key, { quantity: e.target.value })}
                      aria-label="Количество"
                      className={inputClass}
                    />
                  </div>
                </>
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
          className="w-full rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/5"
        >
          + Добавить товар
        </button>

        <div>
          <label className="mb-1 block text-xs text-white/60">Для кого (необязательно)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Личный"
            maxLength={40}
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-white/80">
          <input
            type="checkbox"
            checked={withDelivery}
            onChange={(e) => setWithDelivery(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {items.length > 1
            ? 'Сразу объединить и указать получателя и пункт СДЭК'
            : 'Сразу указать получателя и пункт СДЭК'}
        </label>

        {withDelivery ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-white/60">ФИО получателя</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Телефон</label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+79991234567"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Пункт СДЭК</label>
              <PickupPointPicker value={point} onChange={setPoint} />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
        >
          {submitting
            ? 'Создаём в RAKETA…'
            : items.length > 1
              ? `Создать ${items.length} заказа в RAKETA`
              : 'Создать заказ в RAKETA'}
        </button>
      </div>
    </SectionCard>
  );
}
