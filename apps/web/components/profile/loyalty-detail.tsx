'use client';

import type { LoyaltyStatusDto, LoyaltyTier } from '@lean-poizon/shared';
import { useEffect, useState } from 'react';

import { loyaltyApi } from '../../lib/api-client';
import { formatDiscount, formatUsd, tierGlowVars, tierIcon, tierVisual } from '../../lib/loyalty';
import { EmptyState } from '../ui/empty-state';
import { LoadingBlock } from '../ui/loading-block';
import { SectionCard } from '../ui/section-card';

const SUBSCRIBE_URL = 'https://t.me/lh_crypto1/8439';

export function LoyaltyDetail() {
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
        // Non-critical.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingBlock title="Программа лояльности" description="Загружаем ваш статус..." />;
  }

  if (!status || !status.enabled) {
    return (
      <EmptyState
        title="Программа недоступна"
        description="Программа лояльности сейчас отключена. Загляните чуть позже."
      />
    );
  }

  const currentKey = status.eligible ? status.currentTier?.key ?? null : null;
  const glow = currentKey ? tierGlowVars(currentKey) : undefined;

  return (
    <SectionCard className={currentKey ? 'lg-tier-glow' : ''} style={glow}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Программа лояльности</h2>
          <p className="mt-1 text-xs text-white/50">
            Скидка на комиссию за сумму выкупов (за всё время)
          </p>
        </div>
        {status.eligible && status.currentTier ? (
          <TierBadge tierKey={status.currentTier.key} name={status.currentTier.name} />
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

function TierBadge({ tierKey, name }: { tierKey: string; name: string }) {
  const v = tierVisual(tierKey);
  return (
    <span
      className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{ color: v.text, borderColor: v.ring, background: v.glowSoft }}
    >
      {v.icon} {name}
    </span>
  );
}

function EligibleBody({ status }: { status: LoyaltyStatusDto }) {
  const { currentTier, nextTier, spentUsd, amountToNextUsd, discountPercentPoints, tiers } = status;

  const floor = currentTier?.thresholdUsd ?? 0;
  const ceiling = nextTier?.thresholdUsd ?? floor;
  const progress = nextTier
    ? Math.min(100, Math.max(0, ((spentUsd - floor) / (ceiling - floor)) * 100))
    : 100;

  return (
    <div>
      <p className="mt-4 text-3xl font-bold text-white">
        {discountPercentPoints > 0 ? (
          <>
            {formatDiscount(discountPercentPoints)}{' '}
            <span className="text-base font-semibold text-white/60">к комиссии</span>
          </>
        ) : (
          <span className="text-base font-semibold text-white/60">Скидка пока не открыта</span>
        )}
      </p>

      <div className="mt-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
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
        <p className="mt-2 text-sm leading-6 text-white/60">
          Ещё <span className="font-semibold text-white">{formatUsd(amountToNextUsd)}</span> до уровня{' '}
          <span className="font-semibold text-white">
            {tierIcon(nextTier.key)} {nextTier.name}
          </span>{' '}
          ({formatDiscount(nextTier.discountPercentPoints)}).
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-emerald-200/80">
          Максимальный уровень достигнут — спасибо за доверие!
        </p>
      )}

      <TierLadder tiers={tiers} currentKey={currentTier?.key ?? null} />

      <p className="mt-4 text-xs leading-5 text-white/40">
        Скидка применяется автоматически при расчёте комиссии в калькуляторе и при оформлении заказа.
      </p>
    </div>
  );
}

function NotEligibleBody({ tiers }: { tiers: LoyaltyTier[] }) {
  return (
    <div>
      <p className="mt-3 text-sm leading-6 text-white/60">
        Чем больше сумма ваших выкупов, тем выше скидка на комиссию. Программа доступна подписчикам
        приватного канала.
      </p>

      <TierLadder tiers={tiers} currentKey={null} />

      <a
        href={SUBSCRIBE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="lg-accent-button mt-5 block w-full rounded-[18px] px-4 py-3 text-center text-sm font-semibold text-slate-950 transition active:scale-[0.98]"
      >
        Подписаться и получить скидку
      </a>
    </div>
  );
}

function TierLadder({ tiers, currentKey }: { tiers: LoyaltyTier[]; currentKey: string | null }) {
  return (
    <div className="mt-5 space-y-2">
      {tiers.map((tier) => {
        const active = tier.key === currentKey;
        const v = tierVisual(tier.key);
        return (
          <div
            key={tier.key}
            className="flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-sm transition"
            style={
              active
                ? { borderColor: v.ring, background: v.glowSoft }
                : { borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)' }
            }
          >
            <span
              className={active ? 'font-semibold' : 'text-white/70'}
              style={active ? { color: v.text } : undefined}
            >
              {v.icon} {tier.name}
            </span>
            <span className="flex items-center gap-2.5">
              <span className="text-white/40">от {formatUsd(tier.thresholdUsd)}</span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={
                  active
                    ? { color: v.text, background: v.glowStrong }
                    : { color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)' }
                }
              >
                {formatDiscount(tier.discountPercentPoints)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
