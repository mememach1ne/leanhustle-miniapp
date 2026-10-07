'use client';

import type { PartnerDashboardDto } from '@lean-poizon/shared';
import { useEffect, useState } from 'react';

import { partnersApi } from '../../lib/api-client';
import { extractAxiosMessage } from '../../lib/error-utils';
import { hapticNotification } from '../../lib/telegram-web-app';
import { FeedbackMessage } from '../ui/feedback-message';
import { InfoRow } from '../ui/info-row';
import { SectionCard } from '../ui/section-card';

const usd = (value: number) => `$${value.toFixed(2)}`;
const date = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const name = (p: { username: string | null; firstName: string | null }) =>
  p.username ? `@${p.username}` : p.firstName ?? 'Без имени';

const KIND_LABEL = { ORDER: 'Заказ', REVERSAL: 'Отмена', WITHDRAWAL: 'Вывод', ADJUSTMENT: 'Возврат' } as const;
const STATUS_LABEL = { PENDING: 'в обработке', SENT: 'отправлено', FAILED: 'ошибка' } as const;

/** «Прибыль»: the partner's balance and history, withdrawals, owner's share settings, referral payouts. */
export function PartnerProfitPanel() {
  const [data, setData] = useState<PartnerDashboardDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [chain, setChain] = useState('TRX');
  const [address, setAddress] = useState('');
  const [shares, setShares] = useState<Record<string, string>>({});

  const apply = (d: PartnerDashboardDto) => {
    setData(d);
    setChain(d.me.payoutChain ?? 'TRX');
    setAddress(d.me.payoutAddress ?? '');
    setShares(
      Object.fromEntries(
        [...(d.partners ?? []), ...(d.candidates ?? [])].map((p) => [p.staffId, p.sharePercent === null ? '' : String(p.sharePercent)]),
      ),
    );
  };

  useEffect(() => {
    partnersApi
      .getDashboard()
      .then(apply)
      .catch((err) => setLoadError(extractAxiosMessage(err) ?? 'Не удалось загрузить данные.'));
  }, []);

  const run = async (action: () => Promise<PartnerDashboardDto>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      apply(await action());
      setMessage({ tone: 'success', text: success });
      hapticNotification('success');
    } catch (err) {
      setMessage({ tone: 'error', text: extractAxiosMessage(err) ?? 'Не получилось.' });
      hapticNotification('error');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <FeedbackMessage tone="error">{loadError}</FeedbackMessage>;
  if (!data) return <p className="text-sm text-white/60">Загружаем…</p>;

  const { me } = data;
  const blocked = me.withdrawBlockedUntil ? new Date(me.withdrawBlockedUntil) > new Date() : false;
  const canWithdraw =
    data.withdrawEnabled && Boolean(me.payoutAddress) && !blocked && me.balanceUsd >= data.minWithdrawUsd;
  const sharesTotal = Object.values(shares).reduce((acc, v) => acc + (Number(v) || 0), 0);

  return (
    <div className="space-y-4">
      {message ? <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage> : null}

      <SectionCard>
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Ваша доля {me.sharePercent !== null ? `${me.sharePercent}%` : '—'}
        </p>
        <p className="mt-2 text-3xl font-bold text-white">{usd(me.balanceUsd)}</p>
        <p className="mt-1 text-xs text-white/50">За этот месяц: {usd(me.earnedThisMonthUsd)}</p>
        <button
          type="button"
          disabled={!canWithdraw || busy}
          onClick={() => run(() => partnersApi.withdraw(), 'Вывод отправлен в Bybit.')}
          className="mt-4 w-full rounded-[18px] bg-emerald-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Вывести {usd(me.balanceUsd)} USDT
        </button>
        <p className="mt-2 text-[11px] leading-4 text-white/45">
          {!data.withdrawEnabled
            ? 'Вывод через Bybit ещё не настроен на сервере.'
            : !me.payoutAddress
              ? 'Сохраните адрес кошелька ниже.'
              : blocked
                ? `Адрес недавно изменён — вывод доступен с ${date(me.withdrawBlockedUntil!)}.`
                : `От ${usd(data.minWithdrawUsd)}. 1-го числа каждого месяца баланс выводится автоматически.`}
        </p>
      </SectionCard>

      <SectionCard>
        <h3 className="text-sm font-semibold text-white">Кошелёк для вывода (USDT)</h3>
        <div className="mt-3 flex gap-2">
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            {data.chains.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Адрес кошелька"
            className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
        <button
          type="button"
          disabled={busy || !address.trim()}
          onClick={() => run(() => partnersApi.setPayoutAddress(chain, address), 'Адрес сохранён.')}
          className="mt-3 w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white disabled:opacity-40"
        >
          Сохранить адрес
        </button>
        <p className="mt-2 text-[11px] leading-4 text-white/45">
          После смены адреса вывод на него доступен через 24 часа, оба партнёра получают уведомление. Адрес должен быть в
          белом списке вывода Bybit.
        </p>
      </SectionCard>

      {data.partners ? (
        <SectionCard>
          <h3 className="text-sm font-semibold text-white">Партнёры и доли</h3>
          <div className="mt-3 space-y-2">
            {[...data.partners, ...(data.candidates ?? [])].map((p) => (
              <div key={p.staffId} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {name(p)}
                  {p.isOwner ? <span className="ml-1 text-xs text-white/40">владелец</span> : null}
                  {'balanceUsd' in p ? (
                    <span className="ml-2 text-xs text-white/40">{usd((p as { balanceUsd: number }).balanceUsd)}</span>
                  ) : null}
                </span>
                <input
                  type="number"
                  value={shares[p.staffId] ?? ''}
                  placeholder="—"
                  onChange={(e) => setShares((prev) => ({ ...prev, [p.staffId]: e.target.value }))}
                  className="w-20 rounded-xl bg-white/5 px-3 py-2 text-right text-sm text-white outline-none"
                />
                <span className="text-xs text-white/50">%</span>
              </div>
            ))}
          </div>
          <p className={`mt-2 text-[11px] ${sharesTotal === 100 ? 'text-white/45' : 'text-amber-200'}`}>
            Сумма долей: {sharesTotal}% (должно быть 100%). Пустое поле — не партнёр.
          </p>
          <button
            type="button"
            disabled={busy || sharesTotal !== 100}
            onClick={() =>
              run(
                () =>
                  partnersApi.setShares(
                    Object.entries(shares).map(([staffId, v]) => ({ staffId, sharePercent: v.trim() ? Number(v) : null })),
                  ),
                'Доли сохранены.',
              )
            }
            className="mt-3 w-full rounded-[16px] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            Сохранить доли
          </button>
        </SectionCard>
      ) : null}

      {data.referralPayouts.length ? (
        <SectionCard>
          <h3 className="text-sm font-semibold text-white">Заявки рефералов на вывод</h3>
          <ul className="mt-3 space-y-3">
            {data.referralPayouts.map((p) => (
              <li key={p.id} className="rounded-[16px] border border-white/10 bg-white/5 p-3">
                <div className="flex justify-between text-sm text-white">
                  <span>{p.user.username ? `@${p.user.username}` : `${p.user.firstName} (id ${p.user.telegramId})`}</span>
                  <span className="font-semibold">{usd(p.amountUsd)}</span>
                </div>
                <p className="mt-1 text-[11px] text-white/45">{date(p.createdAt)}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => partnersApi.processReferralPayout(p.id, 'paid'), 'Отмечено как выплачено.')}
                    className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Выплачено
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => partnersApi.processReferralPayout(p.id, 'rejected'), 'Заявка отклонена.')}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                  >
                    Отклонить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard>
        <h3 className="text-sm font-semibold text-white">История начислений</h3>
        {data.entries.length === 0 ? (
          <p className="mt-2 text-xs text-white/50">Пока пусто — начисления появятся с новыми оплаченными заказами.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 text-slate-300">
                  {KIND_LABEL[e.kind]} {e.orderNumber ?? ''}
                  <span className="block text-[11px] text-white/40">
                    {e.kind === 'ORDER' && e.commissionUsd !== null
                      ? `комиссия ${usd(e.commissionUsd)}${e.referralUsd ? ` − реф. ${usd(e.referralUsd)}` : ''} × ${e.sharePercent}% · `
                      : e.note
                        ? `${e.note} · `
                        : ''}
                    {date(e.createdAt)}
                  </span>
                </span>
                <span className={e.amountUsd < 0 ? 'shrink-0 text-rose-300' : 'shrink-0 text-emerald-300'}>
                  {e.amountUsd < 0 ? '−' : '+'}
                  {usd(Math.abs(e.amountUsd))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {data.withdrawals.length ? (
        <SectionCard>
          <h3 className="text-sm font-semibold text-white">Выводы</h3>
          <div className="mt-3 space-y-2">
            {data.withdrawals.map((w) => (
              <InfoRow
                key={w.id}
                label={`${date(w.createdAt)} · ${w.chain}${w.trigger === 'MONTHLY' ? ' · ежемесячный' : ''} · ${STATUS_LABEL[w.status]}`}
                value={usd(w.amountUsd)}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
