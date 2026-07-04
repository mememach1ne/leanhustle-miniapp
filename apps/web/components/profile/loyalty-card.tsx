'use client';

import type { LoyaltyStatusDto, LoyaltyTier } from '@lean-poizon/shared';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';

import { loyaltyApi } from '../../lib/api-client';
import { formatDiscount, formatUsd, tierGlowVars, tierVisual } from '../../lib/loyalty';
import { SectionCard } from '../ui/section-card';

const LAST_TIER_STORAGE_KEY = 'loyalty:lastTierKey';

/**
 * Compact loyalty teaser for the profile grid. Shows the live tier /
 * discount / progress at a glance and links to the full programme page.
 * When the user crosses into a higher tier, a one-off celebration burst
 * plays (persistent tier-coloured glow the rest of the time).
 */
export function LoyaltyCard({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<LoyaltyStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loyaltyApi
      .getStatus()
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        maybeCelebrate(data);
      })
      .catch(() => {
        // Non-critical — the card just stays hidden.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fire the celebration only when the tier index actually increased vs. the
   * last one we recorded for this browser. First-ever load sets a baseline
   * silently. */
  const maybeCelebrate = (data: LoyaltyStatusDto) => {
    if (!data.eligible || !data.currentTier) return;

    const currentIndex = data.tiers.findIndex((t) => t.key === data.currentTier?.key);
    if (currentIndex < 0) return;

    let stored: number | null = null;
    try {
      const raw = window.localStorage.getItem(LAST_TIER_STORAGE_KEY);
      if (raw !== null) {
        const idx = data.tiers.findIndex((t) => t.key === raw);
        stored = idx >= 0 ? idx : null;
      }
    } catch {
      stored = null;
    }

    if (stored !== null && currentIndex > stored) {
      setCelebrating(true);
      celebrateTimer.current = setTimeout(() => setCelebrating(false), 2600);
    }

    try {
      window.localStorage.setItem(LAST_TIER_STORAGE_KEY, data.currentTier.key);
    } catch {
      // ignore storage failures (private mode etc.)
    }
  };

  if (loading) {
    return (
      <SectionCard className={className}>
        <div className="flex items-center justify-between">
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

  const currentTier = status.eligible ? status.currentTier : null;
  const glow = currentTier ? tierGlowVars(currentTier.key) : undefined;
  const v = currentTier ? tierVisual(currentTier.key) : null;

  const cardClasses = [
    'relative flex h-full flex-col overflow-hidden transition active:scale-[0.99]',
    currentTier ? 'lg-tier-glow' : '',
    celebrating ? 'lg-tier-burst' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link
      href="/profile/loyalty"
      aria-label="Открыть программу лояльности"
      className={['block lg:h-full', className].filter(Boolean).join(' ')}
    >
      <SectionCard className={cardClasses} style={glow}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Программа лояльности</h3>
          {currentTier && v ? (
            <span
              className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ color: v.text, borderColor: v.ring, background: v.glowSoft }}
            >
              {v.icon} {currentTier.name}
            </span>
          ) : (
            <span className="shrink-0 text-white/30">→</span>
          )}
        </div>

        {status.eligible ? (
          <EligibleTeaser status={status} />
        ) : (
          <p className="mt-2 text-xs leading-5 text-white/60">
            Скидка на комиссию для подписчиков приватного канала. Нажмите, чтобы узнать больше.
          </p>
        )}

        {/* Celebration banner */}
        {celebrating && currentTier && v ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
            <span
              className="lg-tier-banner mt-2 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-lg"
              style={{ color: v.text, borderColor: v.ringStrong, background: v.glowStrong }}
            >
              ✨ Новый уровень — {v.icon} {currentTier.name} ✨
            </span>
          </div>
        ) : null}
      </SectionCard>
    </Link>
  );
}

function EligibleTeaser({ status }: { status: LoyaltyStatusDto }) {
  const { currentTier, nextTier, spentUsd, amountToNextUsd, discountPercentPoints } = status;

  const floor = currentTier?.thresholdUsd ?? 0;
  const ceiling = nextTier?.thresholdUsd ?? floor;
  const progress = nextTier
    ? Math.min(100, Math.max(0, ((spentUsd - floor) / (ceiling - floor)) * 100))
    : 100;

  return (
    <div>
      <p className="mt-1.5 text-sm font-semibold text-white">
        {discountPercentPoints > 0 ? (
          <>
            Ваша скидка{' '}
            <span className="text-[var(--accent)]">{formatDiscount(discountPercentPoints)}</span>
          </>
        ) : (
          <span className="text-white/60">Скидка пока не открыта</span>
        )}
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-white/50">
        {nextTier && amountToNextUsd !== null
          ? `Ещё ${formatUsd(amountToNextUsd)} до «${nextTier.name}» · подробнее →`
          : 'Максимальный уровень · подробнее →'}
      </p>

      <TierStepper tiers={status.tiers} currentKey={currentTier?.key ?? null} />
    </div>
  );
}

/** Compact horizontal tier ladder: Серебро → Золото → Платина, current node lit. */
function TierStepper({ tiers, currentKey }: { tiers: LoyaltyTier[]; currentKey: string | null }) {
  const currentIndex = currentKey ? tiers.findIndex((tier) => tier.key === currentKey) : -1;

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <div className="flex items-start">
        {tiers.map((tier, index) => {
          const reached = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const v = tierVisual(tier.key);

          return (
            <Fragment key={tier.key}>
              {index > 0 ? (
                <div
                  className="mt-3.5 h-0.5 flex-1 rounded-full"
                  style={{
                    background:
                      index <= currentIndex ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                  }}
                />
              ) : null}
              <div className="flex flex-col items-center">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={
                    isCurrent
                      ? {
                          background: v.glowStrong,
                          boxShadow: `0 0 0 1px ${v.ringStrong}, 0 0 12px ${v.glowStrong}`,
                        }
                      : reached
                        ? { background: 'rgba(41,195,197,0.15)' }
                        : { background: 'rgba(255,255,255,0.05)', opacity: 0.5 }
                  }
                >
                  {v.icon}
                </div>
                <span
                  className="mt-1 text-[10px]"
                  style={{ color: isCurrent ? v.text : 'rgba(255,255,255,0.4)' }}
                >
                  {formatUsd(tier.thresholdUsd)}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
