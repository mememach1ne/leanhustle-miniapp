'use client';

import type { CryptoPaymentIntentDto } from '@lean-poizon/shared';
import {
  PAYMENT_NETWORK_LABELS,
  PAYMENT_NETWORK_SHORT,
  PaymentNetwork,
} from '@lean-poizon/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cryptoPaymentsApi } from '../../lib/api-client';
import { extractAxiosMessage } from '../../lib/error-utils';
import { hapticNotification } from '../../lib/telegram-web-app';
import { FeedbackMessage } from './feedback-message';
import { SectionCard } from './section-card';

const MANAGER_TELEGRAM_URL = 'https://t.me/lh_poizonmanager';

interface Props {
  orderId: string;
  /**
   * Called when the polling matcher detects payment and the order is
   * transitioned. The parent should refetch the order so the new status
   * propagates to the rest of the page.
   */
  onMatched: () => void;
}

export function CryptoPaymentPanel({ orderId, onMatched }: Props) {
  const [intent, setIntent] = useState<CryptoPaymentIntentDto | null>(null);
  const [networks, setNetworks] = useState<PaymentNetwork[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState<'address' | 'amount' | null>(null);
  const onMatchedRef = useRef(onMatched);
  onMatchedRef.current = onMatched;

  // Initial fetch: existing intent (if any) + the list of enabled networks.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [latest, list] = await Promise.all([
          cryptoPaymentsApi.getStatus(orderId),
          cryptoPaymentsApi.getNetworks().catch(() => ({ networks: [] })),
        ]);
        if (cancelled) return;
        setIntent(latest);
        setNetworks(list.networks);
      } catch (err) {
        if (cancelled) return;
        setError(extractAxiosMessage(err) ?? 'Не удалось загрузить статус оплаты.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Live polling while we have a PENDING intent. 5 seconds is plenty:
  // Bybit deposits arrive in batches, not in real time.
  useEffect(() => {
    if (!intent || intent.status !== 'PENDING') return;
    const interval = setInterval(async () => {
      try {
        const latest = await cryptoPaymentsApi.getStatus(orderId);
        if (!latest) return;
        setIntent(latest);
        if (latest.status === 'MATCHED') {
          hapticNotification('success');
          onMatchedRef.current();
        }
      } catch {
        // Network blip — keep the interval running.
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [intent, orderId]);

  const pickNetwork = useCallback(
    async (network: PaymentNetwork) => {
      setSubmitting(true);
      setError(null);
      try {
        const created = await cryptoPaymentsApi.createIntent(orderId, { network });
        setIntent(created);
      } catch (err) {
        setError(
          extractAxiosMessage(err) ??
            'Не удалось создать платёж. Попробуйте другую сеть или свяжитесь с менеджером.',
        );
        hapticNotification('error');
      } finally {
        setSubmitting(false);
      }
    },
    [orderId],
  );

  const handleSwitchNetwork = async () => {
    // Drop the current pending intent locally so the picker shows again.
    // The backend will cancel it lazily on the next createIntent call.
    setIntent(null);
  };

  const copy = async (text: string, what: 'address' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyOk(what);
      hapticNotification('success');
      setTimeout(() => setCopyOk(null), 1500);
    } catch {
      hapticNotification('error');
    }
  };

  if (loading) {
    return (
      <SectionCard>
        <p className="text-sm text-white/60">Загружаем варианты оплаты…</p>
      </SectionCard>
    );
  }

  if (error && !intent) {
    return (
      <SectionCard>
        <FeedbackMessage tone="error">{error}</FeedbackMessage>
        <ManagerFallback />
      </SectionCard>
    );
  }

  if (!intent || intent.status === 'EXPIRED' || intent.status === 'CANCELLED') {
    return (
      <SectionCard>
        <h3 className="text-sm font-semibold text-white">Оплата USDT</h3>
        <p className="mt-1 text-xs text-white/60">
          Выберите сеть USDT, на которую вам удобно отправить оплату. Мы
          сгенерируем точную сумму, и после поступления заказ автоматически
          уйдёт в выкуп.
        </p>
        {intent?.status === 'EXPIRED' ? (
          <p className="mt-2 text-[11px] text-amber-300">
            Предыдущая оплата по этому заказу истекла. Выберите сеть заново.
          </p>
        ) : null}
        <div className="mt-3 space-y-1.5">
          {(networks ?? []).map((network) => (
            <button
              key={network}
              type="button"
              disabled={submitting}
              onClick={() => pickNetwork(network)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {PAYMENT_NETWORK_LABELS[network]}
            </button>
          ))}
        </div>
        <ManagerFallback />
      </SectionCard>
    );
  }

  if (intent.status === 'MATCHED') {
    return (
      <SectionCard>
        <h3 className="text-sm font-semibold text-emerald-300">
          ✅ Оплата подтверждена
        </h3>
        <p className="mt-1 text-xs text-white/60">
          Сумма {intent.expectedAmountUsdt.toFixed(2)} USDT получена. Заказ
          переходит в выкуп.
        </p>
      </SectionCard>
    );
  }

  // PENDING — show address + amount + timer.
  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Оплата USDT</h3>
          <p className="text-xs text-white/60">
            Сеть: <span className="font-semibold">{PAYMENT_NETWORK_SHORT[intent.network]}</span>
          </p>
        </div>
        <Countdown expiresAt={intent.expiresAt} />
      </div>

      {/* QR with the deposit address. We deliberately encode the bare
          address rather than a chain-specific deep link so all wallets
          on all chains parse it consistently — the customer still has to
          type the amount (we show it in big text below). */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="rounded-2xl bg-white p-3">
          <QRCodeSVG
            value={intent.address}
            size={168}
            level="M"
            includeMargin={false}
          />
        </div>
        <p className="text-[11px] text-white/50">
          Отсканируйте QR в кошельке, затем введите сумму вручную.
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <CopyRow
          label="Сумма (точно)"
          value={`${intent.expectedAmountUsdt.toFixed(2)} USDT`}
          copyValue={intent.expectedAmountUsdt.toFixed(2)}
          highlight={copyOk === 'amount'}
          onCopy={(text) => copy(text, 'amount')}
        />
        <CopyRow
          label="Адрес кошелька"
          value={intent.address}
          copyValue={intent.address}
          mono
          highlight={copyOk === 'address'}
          onCopy={(text) => copy(text, 'address')}
        />
        {intent.addressTag ? (
          <CopyRow
            label="Memo / Tag (обязательно!)"
            value={intent.addressTag}
            copyValue={intent.addressTag}
            mono
            onCopy={(text) => copy(text, 'address')}
            tone="warning"
          />
        ) : null}
      </div>

      <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/5 p-2 text-[11px] text-amber-200">
        ⚠️ Отправьте <span className="font-semibold">ровно</span>{' '}
        {intent.expectedAmountUsdt.toFixed(2)} USDT в сети{' '}
        {PAYMENT_NETWORK_SHORT[intent.network]}. Другая сумма или сеть = деньги
        не найдём автоматически.
      </p>

      <p className="mt-2 flex items-center gap-2 text-xs text-white/60">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
        Ждём поступление… статус обновится автоматически.
      </p>

      <button
        type="button"
        onClick={handleSwitchNetwork}
        className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
      >
        Выбрать другую сеть
      </button>

      <ManagerFallback />
    </SectionCard>
  );
}

function CopyRow({
  label,
  value,
  copyValue,
  onCopy,
  mono,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  copyValue: string;
  onCopy: (text: string) => void;
  mono?: boolean;
  highlight?: boolean;
  tone?: 'warning';
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
        tone === 'warning'
          ? 'border-amber-400/40 bg-amber-400/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
        <p
          className={`mt-0.5 truncate text-sm text-white ${
            mono ? 'font-mono text-[12px]' : 'font-semibold'
          }`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(copyValue)}
        className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
          highlight
            ? 'bg-emerald-400 text-slate-950'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        {highlight ? '✓' : 'Копировать'}
      </button>
    </div>
  );
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${
        remainingMs < 5 * 60_000
          ? 'border-rose-400/40 bg-rose-400/10 text-rose-200'
          : 'border-white/10 bg-white/5 text-white/70'
      }`}
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}

function ManagerFallback() {
  return (
    <a
      href={MANAGER_TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/80 hover:bg-white/10"
    >
      💬 Оплатить другим способом / связаться с менеджером
    </a>
  );
}
