'use client';

import type { CreateManualOrderRequest } from '@lean-poizon/shared';
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

export function ManualOrderForm({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [fullName, setFullName] = useState('');
  const [cdekAddress, setCdekAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');

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

  const validate = (): string | null => {
    if (!username.trim()) return 'Укажите username клиента.';
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
    };

    setSubmitting(true);
    try {
      const order = await adminApi.createManualOrder(payload);
      setSuccess(`Заказ ${order.orderNumber} создан и отправлен клиенту.`);
      setUsername('');
      setItems([emptyItem()]);
      setFullName('');
      setCdekAddress('');
      setPhone('');
      setComment('');
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
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className={inputClass}
          />
          <p className="mt-1 text-[10px] text-white/30">
            Клиент должен был хотя бы раз запустить бота.
          </p>
        </div>

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

              <input
                type="text"
                value={item.productTitle}
                onChange={(e) => updateItem(index, { productTitle: e.target.value })}
                placeholder="Название товара"
                className={inputClass}
              />
              <input
                type="text"
                value={item.dewuLink}
                onChange={(e) => updateItem(index, { dewuLink: e.target.value })}
                placeholder="Ссылка (необязательно)"
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
