'use client';

import type { LoyaltyStatusDto, LoyaltyTier } from '@lean-poizon/shared';
import { useEffect, useState } from 'react';

import { loyaltyApi } from '../../lib/api-client';
import { SectionCard } from '../ui/section-card';

const SUBSCRIBE_URL = 'https://t.me/lh_crypto1/8439';

const TIER_ICONS: Record<string, string> = {
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
};

function tierIcon(key: string): string {
  return TIER_ICONS[key] ?? '⭐';
}

function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString('ru-RU')}`;
}

export function LoyaltyCard({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<LoyaltyStatusDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loyaltyApi
      .getStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        // Non-critical — the card just stays hidden.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Program disabled by admin, or failed to load — render nothing.
  if (loading) {
    return (
      <SectionCard className={className}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Программа лояльности</h3>
        </div>
        <div className="mt-4 h-2 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-white/5" />
      </SectionCard>
    );
  }

  if (!status || !status.enabled) {
    return null;
  }

  return (
    <SectionCard className={className}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">Программа лояльности</h3>
        {status.eligible && status.currentTier ? (
          <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
            {tierIcon(status.currentTier.key)} {status.currentTier.name}
          </span>
        ) : null}
      </div>

      {status.eligible ? (
        <EligibleBody status={status} />
      ) : (
        <NotEligibleBody tiers={status.tiers} />
      )}
    </SectionCard>
  );
}

function EligibleBody({ status }: { status: LoyaltyStatusDto }) {
  const { currentTier, nextTier, spentUsd, amountToNextUsd, discountPercentPoints, tiers } = status;

  // Progress towards the next tier: fill from the current tier's threshold
  // (or 0) up to the next tier's threshold.
  const floor = currentTier?.thresholdUsd ?? 0;
  const ceiling = nextTier?.thresholdUsd ?? floor;
  const progress = nextTier
    ? Math.min(100, Math.max(0, ((spentUsd - floor) / (ceiling - floor)) * 100))
    : 100;

  return (
    <div>
      <p className="mt-3 text-2xl font-bold text-white">
        {discountPercentPoints > 0 ? (
          <>
            −{discountPercentPoints}{' '}
            <span className="text-base font-semibold text-white/60">п.п. к комиссии</span>
          </>
        ) : (
          <span className="text-base font-semibold text-white/60">Скидка пока не открыта</span>
        )}
      </p>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/50">
          <span>{formatUsd(spentUsd)}</span>
          {nextTier ? <span>{formatUsd(nextTier.thresholdUsd)}</span> : null}
        </div>
      </div>

      {nextTier && amountToNextUsd !== null ? (
        <p className="mt-2 text-xs leading-5 text-white/60">
          Ещё <span className="font-semibold text-white">{formatUsd(amountToNextUsd)}</span> до уровня{' '}
          <span className="font-semibold text-white">
            {tierIcon(nextTier.key)} {nextTier.name}
          </span>{' '}
          (−{nextTier.discountPercentPoints} п.п.).
        </p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-emerald-200/80">
          Максимальный уровень достигнут — спасибо за доверие!
        </p>
      )}

      <TierLadder tiers={tiers} currentKey={currentTier?.key ?? null} />
    </div>
  );
}

function NotEligibleBody({ tiers }: { tiers: LoyaltyTier[] }) {
  return (
    <div>
      <p className="mt-2 text-xs leading-5 text-white/60">
        Чем больше сумма ваших выкупов, тем выше скидка на комиссию. Доступно подписчикам приватного
        канала.
      </p>

      <TierLadder tiers={tiers} currentKey={null} />

      <a
        href={SUBSCRIBE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="lg-accent-button mt-4 block w-full rounded-[18px] px-4 py-3 text-center text-sm font-semibold text-slate-950 transition active:scale-[0.98]"
      >
        Подписаться и получить скидку
      </a>
    </div>
  );
}

function TierLadder({ tiers, currentKey }: { tiers: LoyaltyTier[]; currentKey: string | null }) {
  return (
    <div className="mt-4 space-y-1.5">
      {tiers.map((tier) => {
        const active = tier.key === currentKey;
        return (
          <div
            key={tier.key}
            className={[
              'flex items-center justify-between rounded-2xl border px-3 py-2 text-xs transition',
              active
                ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10'
                : 'border-white/5 bg-white/[0.03]',
            ].join(' ')}
          >
            <span className={active ? 'font-semibold text-white' : 'text-white/70'}>
              {tierIcon(tier.key)} {tier.name}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-white/40">от {formatUsd(tier.thresholdUsd)}</span>
              <span
                className={[
                  'rounded-full px-2 py-0.5 font-semibold',
                  active ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-white/5 text-white/60',
                ].join(' ')}
              >
                −{tier.discountPercentPoints} п.п.
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
