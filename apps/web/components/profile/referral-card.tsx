'use client';

import type { ReferralSummaryDto } from '@lean-poizon/shared';
import { useEffect, useState } from 'react';

import { referralsApi } from '../../lib/api-client';
import { extractAxiosMessage } from '../../lib/error-utils';
import { getTelegramWebApp, hapticNotification } from '../../lib/telegram-web-app';
import { FeedbackMessage } from '../ui/feedback-message';
import { InfoRow } from '../ui/info-row';
import { SectionCard } from '../ui/section-card';

const usd = (value: number) => `$${value.toFixed(2)}`;
const STATUS_LABEL: Record<ReferralSummaryDto['recent'][number]['status'], string> = {
  PENDING: 'ждёт доставки',
  AVAILABLE: 'доступно',
  PAID: 'выплачено',
  CANCELLED: 'заказ отменён',
};

/** «Приглашай друзей»: personal link, earnings and payout request (part of the loyalty page). */
export function ReferralCard() {
  const [data, setData] = useState<ReferralSummaryDto | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    referralsApi
      .getMine()
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data || data.percent <= 0) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      hapticNotification('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      hapticNotification('error');
    }
  };

  const share = () => {
    const text = 'Заказываю оригинальные вещи с Poizon через LEAN HUSTLE — попробуй тоже:';
    const url = `https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent(text)}`;
    const webApp = getTelegramWebApp();
    if (webApp?.openTelegramLink) webApp.openTelegramLink(url);
    else window.open(url, '_blank', 'noopener');
  };

  const requestPayout = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setData(await referralsApi.requestPayout());
      setMessage({ tone: 'success', text: 'Заявка отправлена — менеджер свяжется с вами для выплаты.' });
      hapticNotification('success');
    } catch (err) {
      setMessage({ tone: 'error', text: extractAxiosMessage(err) ?? 'Не удалось отправить заявку.' });
      hapticNotification('error');
    } finally {
      setBusy(false);
    }
  };

  const canPayout = !data.openPayout && data.availableUsd >= data.minPayoutUsd && data.availableUsd > 0;

  return (
    <SectionCard>
      <h2 className="text-base font-semibold text-white">Приглашай друзей</h2>
      <p className="mt-1 text-xs leading-5 text-white/60">
        Поделитесь своей ссылкой. С каждого заказа приглашённого вы получаете {data.percent}% от нашей комиссии —
        за все его заказы, без ограничения по времени. Бонус становится доступен к выводу, когда заказ доставлен.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="min-w-0 flex-1 truncate rounded-[16px] border border-white/10 bg-white/5 px-3 py-2.5 text-left text-xs text-slate-200"
        >
          {copied ? 'Ссылка скопирована!' : data.link}
        </button>
        <button
          type="button"
          onClick={share}
          className="shrink-0 rounded-[16px] bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-slate-950"
        >
          Поделиться
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <InfoRow label="Приглашено" value={`${data.invitedCount} · из них купили ${data.buyersCount}`} />
        <InfoRow label="Ждёт доставки заказов" value={usd(data.pendingUsd)} />
        <InfoRow label="Доступно к выводу" value={usd(data.availableUsd)} accent />
        {data.paidUsd > 0 ? <InfoRow label="Уже выплачено" value={usd(data.paidUsd)} /> : null}
      </div>

      {message ? (
        <div className="mt-3">
          <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage>
        </div>
      ) : null}

      {data.openPayout ? (
        <p className="mt-4 rounded-[16px] border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          Заявка на вывод {usd(data.openPayout.amountUsd)} отправлена — менеджер свяжется с вами.
        </p>
      ) : (
        <button
          type="button"
          onClick={requestPayout}
          disabled={!canPayout || busy}
          className="mt-4 w-full rounded-[18px] bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Отправляем…' : `Вывести ${usd(data.availableUsd)}`}
        </button>
      )}
      {!data.openPayout && !canPayout ? (
        <p className="mt-2 text-[11px] text-white/45">Вывод через менеджера, от {usd(data.minPayoutUsd)}.</p>
      ) : null}

      {data.recent.length ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Начисления</p>
          <ul className="mt-2 space-y-1.5">
            {data.recent.map((r) => (
              <li key={`${r.orderNumber}-${r.createdAt}`} className="flex justify-between gap-3 text-sm">
                <span className="text-slate-300">
                  Заказ {r.orderNumber}
                  <span className="ml-2 text-xs text-white/40">{STATUS_LABEL[r.status]}</span>
                </span>
                <span className={r.status === 'CANCELLED' ? 'text-white/30 line-through' : 'text-white'}>
                  {usd(r.amountUsd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}
