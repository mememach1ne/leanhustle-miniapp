'use client';

import type { LoyaltyStatusDto } from '@lean-poizon/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { loyaltyApi } from '../../lib/api-client';
import { useAuthStore } from '../../store/auth-store';

const SUPPORT_TELEGRAM_URL = 'https://t.me/lh_poizonmanager';

export function Header() {
  const status = useAuthStore((state) => state.status);
  const [loyalty, setLoyalty] = useState<LoyaltyStatusDto | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    loyaltyApi
      .getStatus()
      .then((data) => {
        if (!cancelled) setLoyalty(data);
      })
      .catch(() => {
        // Non-critical — the header falls back to the support pill.
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const tier = loyalty?.enabled && loyalty.eligible ? loyalty.currentTier : null;

  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Image
          src="/lh-logo.webp"
          alt="Lean Hustle Poizon"
          width={34}
          height={34}
          className="h-[34px] w-[34px] shrink-0 rounded-[11px] object-cover"
          priority
        />
        <span className="font-display truncate text-[14px] font-bold tracking-[0.02em] text-white">
          LEAN HUSTLE
        </span>
      </div>

      {tier ? (
        <Link
          href="/profile/loyalty"
          className="inline-flex h-[34px] shrink-0 items-center rounded-full border border-[#4a3c16] bg-[#2a2412] px-3 text-[13px] font-bold text-[#ffd27a]"
        >
          {tier.name} · −{tier.discountPercentPoints}%
        </Link>
      ) : (
        <a
          href={SUPPORT_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="lg-surface inline-flex h-[34px] shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-bold text-white"
        >
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
          Поддержка
        </a>
      )}
    </header>
  );
}
