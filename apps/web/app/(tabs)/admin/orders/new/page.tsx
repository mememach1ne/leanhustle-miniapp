'use client';

import type {
  DeliveryAddressDto,
  DewuProductSku,
  DewuResolvedProduct,
  ManualOrderClientLookupResponse,
} from '@lean-poizon/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { FeedbackMessage } from '../../../../../components/ui/feedback-message';
import { PageSection } from '../../../../../components/ui/page-section';
import {
  type PickedPoint,
  PickupPointPicker,
} from '../../../../../components/ui/pickup-point-picker';
import { SectionCard } from '../../../../../components/ui/section-card';
import { adminApi } from '../../../../../lib/api-client';
import { extractAxiosMessage } from '../../../../../lib/error-utils';

const inputClass =
  'min-w-0 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]';
const FIO_RE = /^[А-Яа-яЁё-]+(\s+[А-Яа-яЁё-]+){1,2}$/;
const PHONE_RE = /^\+7\d{10}$/;

interface DraftItem {
  key: number;
  link: string;
  product: DewuResolvedProduct | null;
  resolving: boolean;
  resolveError: string | null;
  sku: DewuProductSku | null;
  price: string;
  quantity: string;
  chinaTrack: string;
  /** Typed by hand when the engine can't resolve the link. */
  manual: boolean;
  manualTitle: string;
  manualSize: string;
}

let nextKey = 1;
const emptyItem = (): DraftItem => ({
  key: nextKey++,
  link: '',
  product: null,
  resolving: false,
  resolveError: null,
  sku: null,
  price: '',
  quantity: '1',
  chinaTrack: '',
  manual: false,
  manualTitle: '',
  manualSize: '',
});

/** The whole form is kept in the browser for a day, so a reload or a deploy doesn't lose it. */
const DRAFT_KEY = 'lh:admin-new-order-draft';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

interface OrderDraft {
  savedAt: number;
  username: string;
  lookup: ManualOrderClientLookupResponse | null;
  addressId: string;
  items: DraftItem[];
  recipientName: string;
  recipientPhone: string;
  point: PickedPoint | null;
  withDelivery: boolean;
  title: string;
  commission: string;
  insurance: boolean;
  alreadyPaid: boolean;
  payByLink: boolean;
}

const readDraft = (): OrderDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as OrderDraft;
    if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_TTL_MS || !Array.isArray(draft.items))
      return null;
    return draft;
  } catch {
    return null;
  }
};
const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage unavailable
  }
};

const skuLabel = (sku: DewuProductSku) => [sku.size, sku.version].filter(Boolean).join(' · ');

export default function AdminCreateOrderPage() {
  const router = useRouter();

  // Client
  const [username, setUsername] = useState('');
  const [lookup, setLookup] = useState<ManualOrderClientLookupResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [addressId, setAddressId] = useState<string | 'new'>('new');

  // Items
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);

  // Delivery (new recipient / pickup point)
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('+7');
  const [point, setPoint] = useState<PickedPoint | null>(null);
  const [withDelivery, setWithDelivery] = useState(true);

  // Options
  const [title, setTitle] = useState('');
  const [commission, setCommission] = useState('');
  const [insurance, setInsurance] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  // Without a client: own RAKETA purchase, or the client pays via a bot link.
  const [payByLink, setPayByLink] = useState(false);
  const [cnyToRub, setCnyToRub] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Draft: restored once on mount, then saved on every change.
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      const restoredItems = draft.items.map((item) => ({
        ...item,
        resolving: false,
        manual: Boolean(item.manual),
        manualTitle: item.manualTitle ?? '',
        manualSize: item.manualSize ?? '',
      }));
      nextKey = Math.max(nextKey, ...restoredItems.map((item) => item.key + 1));
      setUsername(draft.username);
      setLookup(draft.lookup);
      setAddressId(draft.addressId);
      setItems(restoredItems.length ? restoredItems : [emptyItem()]);
      setRecipientName(draft.recipientName);
      setRecipientPhone(draft.recipientPhone);
      setPoint(draft.point);
      setWithDelivery(draft.withDelivery);
      setTitle(draft.title);
      setCommission(draft.commission);
      setInsurance(draft.insurance);
      setAlreadyPaid(draft.alreadyPaid);
      setPayByLink(draft.payByLink);
      setDraftRestoredAt(draft.savedAt);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => {
      const draft: OrderDraft = {
        savedAt: Date.now(),
        username,
        lookup,
        addressId,
        items,
        recipientName,
        recipientPhone,
        point,
        withDelivery,
        title,
        commission,
        insurance,
        alreadyPaid,
        payByLink,
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // storage full / unavailable — the form still works
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    draftReady,
    username,
    lookup,
    addressId,
    items,
    recipientName,
    recipientPhone,
    point,
    withDelivery,
    title,
    commission,
    insurance,
    alreadyPaid,
    payByLink,
  ]);

  const resetForm = () => {
    clearDraft();
    setUsername('');
    setLookup(null);
    setAddressId('new');
    setItems([emptyItem()]);
    setRecipientName('');
    setRecipientPhone('+7');
    setPoint(null);
    setWithDelivery(true);
    setTitle('');
    setInsurance(false);
    setAlreadyPaid(false);
    setPayByLink(false);
    setDraftRestoredAt(null);
  };

  useEffect(() => {
    adminApi
      .getSettings()
      .then((settings) => {
        setCnyToRub(settings.cnyToRub);
        setCommission((prev) => prev || String(settings.commissionPercent));
      })
      .catch(() => undefined);
  }, []);

  const hasClient = Boolean(lookup);
  // Order goes into our system (client profile or claimable via link).
  const ownOrder = hasClient || payByLink;
  const savedAddresses: DeliveryAddressDto[] = lookup?.addresses ?? [];
  const selectedAddress = savedAddresses.find((a) => a.id === addressId) ?? null;

  const goodsYuan = useMemo(
    () =>
      items.reduce((sum, item) => {
        const price = Number(item.price);
        const qty = Number(item.quantity);
        return Number.isFinite(price) && Number.isFinite(qty) ? sum + price * qty : sum;
      }, 0),
    [items],
  );
  const insuranceRub = cnyToRub ? Math.ceil(goodsYuan * cnyToRub * 0.01) : null;

  const patch = (key: number, data: Partial<DraftItem>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...data } : item)));

  const runLookup = async () => {
    const name = username.trim().replace(/^@+/, '');
    if (!name) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookup(null);
    try {
      const result = await adminApi.lookupManualOrderClient(name);
      setLookup(result);
      const preferred =
        result.addresses.find((a) => a.isDefault && a.pickupPoint) ??
        result.addresses.find((a) => a.pickupPoint) ??
        null;
      setAddressId(preferred ? preferred.id : 'new');
      if (!preferred) {
        const fullName = [result.client.lastName, result.client.firstName]
          .filter(Boolean)
          .join(' ');
        if (FIO_RE.test(fullName)) setRecipientName(fullName);
      }
    } catch (err) {
      setLookupError(extractAxiosMessage(err) ?? 'Клиент не найден.');
    } finally {
      setLookupLoading(false);
    }
  };

  const resolve = async (item: DraftItem) => {
    if (!item.link.trim()) return;
    patch(item.key, { resolving: true, resolveError: null, product: null, sku: null, price: '' });
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

  const validate = (): string | null => {
    for (const [i, item] of items.entries()) {
      const n = items.length > 1 ? `Товар ${i + 1}: ` : '';
      if (item.manual) {
        if (!item.manualTitle.trim()) return `${n}укажите название товара.`;
        if (!item.manualSize.trim()) return `${n}укажите размер.`;
        if (!item.link.trim()) return `${n}вставьте ссылку на товар.`;
      } else {
        if (!item.product) return `${n}найдите товар по ссылке или введите его вручную.`;
        if (!item.sku) return `${n}выберите размер.`;
      }
      if (!(Number(item.price) > 0)) return `${n}укажите цену в юанях.`;
      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
        return `${n}количество — целое число от 1.`;
      }
      if (!ownOrder && !item.chinaTrack.trim()) {
        return `${n}без клиента заказ создаётся сразу в RAKETA — нужен китайский трек.`;
      }
    }
    const needsNewRecipient = hasClient ? addressId === 'new' : payByLink || withDelivery;
    if (needsNewRecipient) {
      if (!FIO_RE.test(recipientName.trim()))
        return 'ФИО получателя: фамилия и имя (и отчество) на русском.';
      if (!PHONE_RE.test(recipientPhone.trim()))
        return 'Телефон получателя в формате +7XXXXXXXXXX.';
      if (!point) return 'Выберите пункт СДЭК.';
    }
    if (ownOrder && !(Number(commission) >= 0 && Number(commission) <= 100)) {
      return 'Комиссия — число от 0 до 100.';
    }
    return null;
  };

  const itemsPayload = () =>
    items.map((item) => {
      if (item.manual) {
        return {
          link: item.link.trim(),
          dwSpuId: 'manual',
          productTitle: item.manualTitle.trim(),
          titleCn: undefined as string | undefined,
          productImage: undefined as string | undefined,
          categoryL1: undefined as string | undefined,
          categoryL2: undefined as string | undefined,
          categoryL3: undefined as string | undefined,
          size: item.manualSize.trim(),
          priceYuan: Number(item.price),
          quantity: Number(item.quantity),
          chinaTrackNumber: item.chinaTrack.trim(),
        };
      }
      const product = item.product as DewuResolvedProduct;
      const sku = item.sku as DewuProductSku;
      return {
        link: product.originalLink || item.link.trim(),
        dwSpuId: product.dwSpuId,
        productTitle: product.title,
        titleCn: product.titleCn,
        productImage: product.mainImage,
        categoryL1: product.categoryL1,
        categoryL2: product.categoryL2,
        categoryL3: product.categoryL3,
        size: skuLabel(sku),
        priceYuan: Number(item.price),
        quantity: Number(item.quantity),
        chinaTrackNumber: item.chinaTrack.trim(),
      };
    });

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const list = itemsPayload();
      if (ownOrder) {
        const delivery =
          hasClient && addressId !== 'new' && selectedAddress
            ? {
                fullName: selectedAddress.fullName,
                cdekAddress: selectedAddress.cdekAddress,
                phone: selectedAddress.phone,
                pickupPoint: selectedAddress.pickupPoint ?? undefined,
              }
            : {
                fullName: recipientName.trim().replace(/\s+/g, ' '),
                cdekAddress: (point as PickedPoint).label,
                phone: recipientPhone.trim(),
                pickupPoint: (point as PickedPoint).pickupPoint,
              };
        const order = await adminApi.createManualOrder({
          username: lookup
            ? (lookup.client.username ?? username.trim().replace(/^@+/, ''))
            : undefined,
          claimByLink: !lookup,
          items: list.map((item) => ({
            dewuLink: item.link,
            productTitle: item.productTitle,
            priceYuan: item.priceYuan,
            sizeLabel: item.size,
            quantity: item.quantity,
            dwSpuId: item.dwSpuId,
            productImage: item.productImage,
            titleCn: item.titleCn,
            categoryL1: item.categoryL1,
            categoryL2: item.categoryL2,
            categoryL3: item.categoryL3,
            chinaTrackNumber: item.chinaTrackNumber || undefined,
          })),
          delivery,
          commissionPercent: Number(commission),
          insurance,
          alreadyPaid: hasClient && alreadyPaid,
          raketaTitle: title.trim() || undefined,
        });
        clearDraft();
        router.push(`/admin/orders/${order.id}`);
        return;
      }

      const result = await adminApi.createRaketaQuickOrder({
        label: title.trim() || undefined,
        title: title.trim() || undefined,
        insurance,
        items: list.map((item) => ({
          link: item.link,
          dwSpuId: item.dwSpuId,
          productTitle: item.productTitle,
          titleCn: item.titleCn,
          categoryL1: item.categoryL1,
          categoryL2: item.categoryL2,
          categoryL3: item.categoryL3,
          size: item.size,
          priceYuan: item.priceYuan,
          quantity: item.quantity,
          chinaTrackNumber: item.chinaTrackNumber,
        })),
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
        `Создано в RAKETA: ${created}.${
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
      clearDraft();
      setItems([emptyItem()]);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось создать заказ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageSection className="lg:mx-auto lg:max-w-3xl">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] transition hover:text-white"
      >
        ← Назад к заказам
      </Link>
      <h1 className="text-xl font-bold text-white">Новый заказ</h1>

      {draftRestoredAt ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
          <span>
            Восстановлен черновик от{' '}
            {new Intl.DateTimeFormat('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(draftRestoredAt))}
          </span>
          <button type="button" onClick={resetForm} className="shrink-0 text-rose-300">
            Очистить форму
          </button>
        </div>
      ) : null}
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
      {success ? <FeedbackMessage tone="success">{success}</FeedbackMessage> : null}

      {/* 1. Client */}
      <SectionCard>
        <h3 className="mb-1 text-sm font-semibold text-white">Клиент</h3>
        <p className="mb-3 text-[11px] text-white/40">
          С тегом заказ появится у клиента в профиле. Без тега — создаётся только в RAKETA (себе /
          без комиссии).
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (lookup) setLookup(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runLookup();
            }}
            placeholder="@username (необязательно)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={runLookup}
            disabled={lookupLoading || !username.trim()}
            className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {lookupLoading ? '…' : 'Найти'}
          </button>
        </div>
        {lookupError ? <p className="mt-1 text-[11px] text-rose-300">{lookupError}</p> : null}
        {!lookup ? (
          <div className="mt-3 space-y-2 text-xs text-white/80">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!payByLink}
                onChange={() => setPayByLink(false)}
                className="accent-[var(--accent)]"
              />
              Без клиента — только в RAKETA (себе / без комиссии)
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                checked={payByLink}
                onChange={() => setPayByLink(true)}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                Клиент оплатит по ссылке
                <span className="block text-white/40">
                  Получите ссылку в бота — клиент перейдёт, заказ появится у него в профиле, и он
                  оплатит его.
                </span>
              </span>
            </label>
          </div>
        ) : null}
        {lookup ? (
          <p className="mt-2 text-xs text-emerald-300">
            {[lookup.client.firstName, lookup.client.lastName].filter(Boolean).join(' ')}
            {lookup.client.username ? ` (@${lookup.client.username})` : ''} — заказ будет у клиента
            в профиле.
          </p>
        ) : null}
      </SectionCard>

      {/* 2. Items */}
      <SectionCard>
        <h3 className="mb-3 text-sm font-semibold text-white">Товары</h3>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.key}
              className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
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
              {item.resolveError && !item.manual ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-rose-300">{item.resolveError}</p>
                  <button
                    type="button"
                    onClick={() => patch(item.key, { manual: true, product: null, sku: null })}
                    className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    Ввести вручную
                  </button>
                </div>
              ) : null}
              {!item.product &&
              !item.manual &&
              !item.resolveError &&
              item.link.trim() &&
              !item.resolving ? (
                <button
                  type="button"
                  onClick={() => patch(item.key, { manual: true })}
                  className="text-[11px] text-white/40 underline"
                >
                  или ввести товар вручную
                </button>
              ) : null}

              {item.manual ? (
                <div className="space-y-2 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-amber-100">
                      Ручной ввод: название, размер и цена из приложения Poizon.
                    </p>
                    <button
                      type="button"
                      onClick={() => patch(item.key, { manual: false })}
                      className="text-[11px] text-white/50"
                    >
                      отмена
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.manualTitle}
                    onChange={(e) => patch(item.key, { manualTitle: e.target.value })}
                    placeholder="Название, например Nike Air Force 1 Low White"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={item.manualSize}
                    onChange={(e) => patch(item.key, { manualSize: e.target.value })}
                    placeholder="Размер, например 42 или M"
                    className={inputClass}
                  />
                </div>
              ) : null}

              {item.product || item.manual ? (
                <>
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
                        <p className="min-w-0 text-xs font-semibold text-white">
                          {item.product.title}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1.5 text-[11px] text-white/50">
                          Размер — все размеры, в том числе которых сейчас нет в наличии
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.product.skus.map((sku) => (
                            <button
                              key={sku.dwSkuId}
                              type="button"
                              onClick={() =>
                                patch(item.key, {
                                  sku,
                                  price:
                                    sku.priceYuan !== null ? String(sku.priceYuan) : item.price,
                                })
                              }
                              className={[
                                'rounded-xl border px-3 py-2 text-left text-xs transition',
                                item.sku?.dwSkuId === sku.dwSkuId
                                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white'
                                  : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10',
                              ].join(' ')}
                            >
                              <span className="block font-semibold">{skuLabel(sku)}</span>
                              <span
                                className={
                                  sku.priceYuan !== null ? 'text-white/50' : 'text-white/30'
                                }
                              >
                                {sku.priceYuan !== null ? `¥${sku.priceYuan}` : 'нет в наличии'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div className="grid grid-cols-[1fr_72px] gap-2 sm:grid-cols-[120px_72px_1fr]">
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Цена, ¥</label>
                      <input
                        type="number"
                        min={1}
                        value={item.price}
                        onChange={(e) => patch(item.key, { price: e.target.value })}
                        placeholder="от движка"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => patch(item.key, { quantity: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-[11px] text-white/50">
                        Китайский трек {ownOrder ? '(можно позже)' : ''}
                      </label>
                      <input
                        type="text"
                        value={item.chinaTrack}
                        onChange={(e) => patch(item.key, { chinaTrack: e.target.value })}
                        placeholder="SF1234567890"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="w-full rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/5"
          >
            + Добавить товар
          </button>
        </div>
      </SectionCard>

      {/* 3. Delivery */}
      <SectionCard>
        <h3 className="mb-3 text-sm font-semibold text-white">Получатель и пункт СДЭК</h3>
        {hasClient && savedAddresses.length > 0 ? (
          <div className="mb-3 space-y-2">
            {savedAddresses.map((address) => (
              <label
                key={address.id}
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/80"
              >
                <input
                  type="radio"
                  checked={addressId === address.id}
                  onChange={() => setAddressId(address.id)}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span>
                  <span className="block font-semibold text-white">{address.fullName}</span>
                  {address.cdekAddress} · {address.phone}
                  {!address.pickupPoint ? (
                    <span className="block text-amber-200/80">
                      Адрес введён вручную — RAKETA-доставку по нему придётся оформить руками.
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/80">
              <input
                type="radio"
                checked={addressId === 'new'}
                onChange={() => setAddressId('new')}
                className="accent-[var(--accent)]"
              />
              Новый получатель / пункт
            </label>
          </div>
        ) : null}

        {!hasClient && !payByLink ? (
          <label className="mb-3 flex items-center gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={withDelivery}
              onChange={(e) => setWithDelivery(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Сразу указать получателя и пункт СДЭК{items.length > 1 ? ' и создать объединение' : ''}
          </label>
        ) : null}

        {(hasClient && addressId === 'new') || (!hasClient && (payByLink || withDelivery)) ? (
          <div className="space-y-3">
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
      </SectionCard>

      {/* 4. Options */}
      <SectionCard>
        <h3 className="mb-3 text-sm font-semibold text-white">Параметры</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-white/60">
              Название объединения в RAKETA
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder={
                ownOrder ? 'Автоматически: «LP042 Иванов 2 шт»' : 'Автоматически: «Личный N шт»'
              }
              className={inputClass}
            />
          </div>

          {ownOrder ? (
            <div>
              <label className="mb-1 block text-xs text-white/60">Комиссия, %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-white/40">
                Добавляется к цене товара. Клиент увидит итоговую сумму в профиле.
              </p>
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={insurance}
              onChange={(e) => setInsurance(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              Защита от рисков RAKETA — полное возмещение при порче или утере.
              <span className="block text-white/50">
                Стоит 1% от стоимости товаров в рублях
                {insuranceRub ? ` — сейчас ≈ ${insuranceRub} ₽` : ''}, оплачивается вместе с
                доставкой.
              </span>
            </span>
          </label>

          {hasClient ? (
            <label className="flex items-start gap-2 text-xs text-white/80">
              <input
                type="checkbox"
                checked={alreadyPaid}
                onChange={(e) => setAlreadyPaid(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                Товар уже оплачен
                <span className="block text-white/50">
                  {alreadyPaid
                    ? 'Клиенту не нужно платить — заказ сразу в статусе «Оплачен».'
                    : 'Клиенту придёт уведомление с кнопкой «Оплатить», оплата USDT в профиле.'}
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </SectionCard>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
      >
        {submitting
          ? 'Создаём…'
          : hasClient
            ? 'Создать заказ клиенту'
            : payByLink
              ? 'Создать заказ и получить ссылку'
              : 'Создать в RAKETA'}
      </button>
    </PageSection>
  );
}
