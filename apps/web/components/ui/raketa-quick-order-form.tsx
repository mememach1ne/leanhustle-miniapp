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

/**
 * Admin tool: register a purchase that isn't a customer order (for yourself
 * or without commission) straight in the RAKETA cabinet —
 * link → size → China track → order created.
 */
export function RaketaQuickOrderForm({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState('');
  const [product, setProduct] = useState<DewuResolvedProduct | null>(null);
  const [resolving, setResolving] = useState(false);
  const [sku, setSku] = useState<DewuProductSku | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [chinaTrack, setChinaTrack] = useState('');
  const [label, setLabel] = useState('');
  const [withDelivery, setWithDelivery] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('+7');
  const [point, setPoint] = useState<PickedPoint | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resolve = async () => {
    if (!link.trim()) return;
    setResolving(true);
    setError(null);
    setSuccess(null);
    setProduct(null);
    setSku(null);
    try {
      setProduct(await adminApi.resolveManualOrderProduct(link.trim()));
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось получить товар по ссылке.');
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    if (!product || !sku || sku.priceYuan === null) {
      setError('Выберите размер.');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Количество — целое число от 1.');
      return;
    }
    if (!chinaTrack.trim()) {
      setError('Введите китайский трек.');
      return;
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
        link: product.originalLink || link.trim(),
        dwSpuId: product.dwSpuId,
        productTitle: product.title,
        categoryL1: product.categoryL1,
        categoryL2: product.categoryL2,
        categoryL3: product.categoryL3,
        size: [sku.size, sku.version].filter(Boolean).join(' '),
        priceYuan: sku.priceYuan,
        quantity: qty,
        chinaTrackNumber: chinaTrack.trim(),
        label: label.trim() || undefined,
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
      setSuccess(
        `${result.existed ? 'Заказ с этим треком уже был в RAKETA' : 'Заказ создан в RAKETA'}: ${
          result.raketaTrackNumber ?? result.id
        } — «${result.title}».${result.deliveryAssigned ? ' Получатель и пункт СДЭК указаны.' : ''}`,
      );
      if (result.deliveryError) {
        setError(`Заказ создан, но получателя/пункт указать не удалось: ${result.deliveryError}`);
      }
      setChinaTrack('');
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось создать заказ в RAKETA.');
    } finally {
      setSubmitting(false);
    }
  };

  const availableSkus = product?.skus.filter((item) => item.isAvailable && item.priceYuan !== null) ?? [];

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
        <div>
          <label className="mb-1 block text-xs text-white/60">Ссылка на товар Poizon</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://dw4.co/t/A/..."
              className={inputClass}
            />
            <button
              type="button"
              onClick={resolve}
              disabled={resolving || !link.trim()}
              className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {resolving ? 'Загружаем…' : 'Найти'}
            </button>
          </div>
          {resolving ? (
            <p className="mt-1 text-[11px] text-white/40">Обычно это занимает 10–20 секунд.</p>
          ) : null}
        </div>

        {product ? (
          <>
            <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              {product.mainImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.mainImage}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain"
                />
              ) : null}
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-white">{product.title}</p>
                <p className="mt-1 text-white/40">
                  {[product.categoryL1, product.categoryL2, product.categoryL3].filter(Boolean).join(' › ')}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs text-white/60">Размер</label>
              {availableSkus.length === 0 ? (
                <p className="text-xs text-rose-300">Нет доступных размеров с ценой.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableSkus.map((item) => (
                    <button
                      key={item.dwSkuId}
                      type="button"
                      onClick={() => setSku(item)}
                      className={[
                        'rounded-xl border px-3 py-2 text-left text-xs transition',
                        sku?.dwSkuId === item.dwSkuId
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10',
                      ].join(' ')}
                    >
                      <span className="block font-semibold">
                        {[item.size, item.version].filter(Boolean).join(' · ')}
                      </span>
                      <span className="text-white/50">¥{item.priceYuan}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-white/60">Китайский трек</label>
                <input
                  type="text"
                  value={chinaTrack}
                  onChange={(e) => setChinaTrack(e.target.value)}
                  placeholder="SF1234567890"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Количество</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputClass}
                />
              </div>
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
            </div>

            <label className="flex items-center gap-2 text-xs text-white/80">
              <input
                type="checkbox"
                checked={withDelivery}
                onChange={(e) => setWithDelivery(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Сразу указать получателя и пункт СДЭК
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
              disabled={submitting || !sku || !chinaTrack.trim()}
              className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
            >
              {submitting ? 'Создаём в RAKETA…' : 'Создать заказ в RAKETA'}
            </button>
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}
