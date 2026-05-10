'use client';

import type { DeliveryAddressDto } from '@lean-poizon/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EmptyState } from '../../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../../components/ui/feedback-message';
import { LoadingBlock } from '../../../../components/ui/loading-block';
import { PageSection } from '../../../../components/ui/page-section';
import { SectionCard } from '../../../../components/ui/section-card';
import { deliveryAddressesApi } from '../../../../lib/api-client';
import { extractAxiosMessage } from '../../../../lib/error-utils';
import { hapticImpact, hapticNotification, hapticSelection } from '../../../../lib/telegram-web-app';
import { useAuthStore } from '../../../../store/auth-store';
import { useDeliveryAddressesStore } from '../../../../store/delivery-addresses-store';

const PHONE_REGEX = /^\+7\d{10}$/;

interface AddressFormData {
  fullName: string;
  cdekAddress: string;
  phone: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressFormData = { fullName: '', cdekAddress: '', phone: '+7', isDefault: false };

function AddressForm({
  initial = EMPTY_FORM,
  submitLabel,
  onSubmit,
  onCancel,
  isBusy,
}: {
  initial?: AddressFormData;
  submitLabel: string;
  onSubmit: (data: AddressFormData) => void;
  onCancel: () => void;
  isBusy: boolean;
}) {
  const [form, setForm] = useState<AddressFormData>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = {
      fullName: form.fullName.trim(),
      cdekAddress: form.cdekAddress.trim(),
      phone: form.phone.trim(),
      isDefault: form.isDefault,
    };

    if (!trimmed.fullName) {
      setValidationError('Укажите ФИО');
      return;
    }
    if (!trimmed.cdekAddress) {
      setValidationError('Укажите адрес СДЭК');
      return;
    }
    if (!PHONE_REGEX.test(trimmed.phone)) {
      setValidationError('Телефон должен быть в формате +7XXXXXXXXXX');
      return;
    }

    setValidationError(null);
    onSubmit(trimmed);
  };

  const inputClass =
    'w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[var(--accent)] focus:outline-none';

  return (
    <SectionCard>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]">ФИО получателя</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Иванов Иван Иванович"
            className={inputClass}
            maxLength={256}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]">Адрес пункта СДЭК</label>
          <input
            type="text"
            value={form.cdekAddress}
            onChange={(e) => setForm({ ...form, cdekAddress: e.target.value })}
            placeholder="г. Москва, ул. Примерная, д. 1"
            className={inputClass}
            maxLength={512}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]">Телефон</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+79991234567"
            className={inputClass}
            maxLength={20}
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-white">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            className="h-4 w-4 rounded accent-[var(--accent)]"
          />
          Адрес по умолчанию
        </label>

        {validationError ? <FeedbackMessage tone="error">{validationError}</FeedbackMessage> : null}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isBusy}
            className="flex-1 rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {isBusy ? 'Сохраняем...' : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="flex-1 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function AddressCard({
  address,
  onEdit,
  onDelete,
  isBusy,
}: {
  address: DeliveryAddressDto;
  onEdit: () => void;
  onDelete: () => void;
  isBusy: boolean;
}) {
  return (
    <SectionCard>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{address.fullName}</h3>
          {address.isDefault ? (
            <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-100">
              По умолчанию
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[var(--muted)]">{address.cdekAddress}</p>
        <p className="text-sm text-[var(--muted)]">{address.phone}</p>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onEdit}
          disabled={isBusy}
          className="flex-1 rounded-[16px] border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Изменить
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isBusy}
          className="rounded-[16px] border border-rose-300/20 bg-rose-400/10 px-3 py-2.5 text-sm font-semibold text-rose-100 disabled:opacity-50"
        >
          Удалить
        </button>
      </div>
    </SectionCard>
  );
}

export default function DeliveryPage() {
  const authStatus = useAuthStore((state) => state.status);
  const addresses = useDeliveryAddressesStore((state) => state.addresses);
  const isLoading = useDeliveryAddressesStore((state) => state.isLoading);
  const error = useDeliveryAddressesStore((state) => state.error);
  const setLoading = useDeliveryAddressesStore((state) => state.setLoading);
  const setAddresses = useDeliveryAddressesStore((state) => state.setAddresses);
  const setError = useDeliveryAddressesStore((state) => state.setError);
  const addAddress = useDeliveryAddressesStore((state) => state.addAddress);
  const updateAddressInStore = useDeliveryAddressesStore((state) => state.updateAddress);
  const removeAddressFromStore = useDeliveryAddressesStore((state) => state.removeAddress);

  const [mode, setMode] = useState<'list' | 'create' | { editing: DeliveryAddressDto }>('list');
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await deliveryAddressesApi.getAll();
        setAddresses(data);
      } catch (e) {
        setError(extractAxiosMessage(e) ?? 'Не удалось загрузить адреса. Попробуйте позже.');
      }
    };

    void load();
  }, [authStatus, setAddresses, setError, setLoading]);

  const handleCreate = async (data: AddressFormData) => {
    setIsBusy(true);
    setActionError(null);
    try {
      const created = await deliveryAddressesApi.create(data);
      addAddress(created);
      hapticNotification('success');
      setMode('list');
    } catch (e) {
      setActionError(extractAxiosMessage(e) ?? 'Не удалось создать адрес.');
      hapticNotification('error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdate = async (id: string, data: AddressFormData) => {
    setIsBusy(true);
    setActionError(null);
    try {
      const updated = await deliveryAddressesApi.update(id, data);
      updateAddressInStore(updated);
      hapticNotification('success');
      setMode('list');
    } catch (e) {
      setActionError(extractAxiosMessage(e) ?? 'Не удалось обновить адрес.');
      hapticNotification('error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsBusy(true);
    setActionError(null);
    hapticImpact('medium');
    try {
      await deliveryAddressesApi.remove(id);
      removeAddressFromStore(id);
      hapticNotification('success');
    } catch (e) {
      setActionError(extractAxiosMessage(e) ?? 'Не удалось удалить адрес.');
      hapticNotification('error');
    } finally {
      setIsBusy(false);
    }
  };

  if (authStatus === 'loading' || authStatus === 'idle' || isLoading) {
    return (
      <PageSection>
        <LoadingBlock title="Загружаем адреса" description="Скоро покажем ваши данные для доставки." />
      </PageSection>
    );
  }

  if (authStatus !== 'authenticated') {
    return (
      <PageSection>
        <EmptyState
          title="Нужна авторизация"
          description="Данные доставки доступны только внутри Telegram Mini App."
        />
      </PageSection>
    );
  }

  if (mode === 'create') {
    return (
      <PageSection>
        {actionError ? <FeedbackMessage tone="error">{actionError}</FeedbackMessage> : null}
        <AddressForm
          initial={{ ...EMPTY_FORM, isDefault: addresses.length === 0 }}
          submitLabel="Добавить адрес"
          onSubmit={handleCreate}
          onCancel={() => { setMode('list'); setActionError(null); }}
          isBusy={isBusy}
        />
      </PageSection>
    );
  }

  if (typeof mode === 'object' && 'editing' in mode) {
    const addr = mode.editing;
    return (
      <PageSection>
        {actionError ? <FeedbackMessage tone="error">{actionError}</FeedbackMessage> : null}
        <AddressForm
          initial={{
            fullName: addr.fullName,
            cdekAddress: addr.cdekAddress,
            phone: addr.phone,
            isDefault: addr.isDefault,
          }}
          submitLabel="Сохранить"
          onSubmit={(data) => handleUpdate(addr.id, data)}
          onCancel={() => { setMode('list'); setActionError(null); }}
          isBusy={isBusy}
        />
      </PageSection>
    );
  }

  return (
    <PageSection>
      <Link href="/profile" className="mb-2 inline-block text-xs text-[var(--muted)] transition hover:text-white">
        ← Назад к профилю
      </Link>

      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
      {actionError ? <FeedbackMessage tone="error">{actionError}</FeedbackMessage> : null}

      {addresses.length === 0 ? (
        <EmptyState
          title="Нет адресов доставки"
          description="Добавьте адрес для оформления заказов. Укажите ФИО, пункт СДЭК и телефон."
          action={
            <button
              type="button"
              onClick={() => { hapticSelection(); setMode('create'); }}
              className="rounded-[20px] bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-slate-950"
            >
              Добавить адрес
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              onEdit={() => { hapticSelection(); setMode({ editing: addr }); }}
              onDelete={() => handleDelete(addr.id)}
              isBusy={isBusy}
            />
          ))}

          <button
            type="button"
            onClick={() => { hapticSelection(); setMode('create'); }}
            className="w-full rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Добавить ещё адрес
          </button>

        </div>
      )}
    </PageSection>
  );
}
