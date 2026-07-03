'use client';

import Link from 'next/link';

import { LoyaltyDetail } from '../../../../components/profile/loyalty-detail';
import { PageSection } from '../../../../components/ui/page-section';

export default function LoyaltyPage() {
  return (
    <PageSection className="lg:mx-auto lg:max-w-2xl">
      <Link
        href="/profile"
        className="mb-2 inline-block text-xs text-[var(--muted)] transition hover:text-white"
      >
        ← Назад к профилю
      </Link>
      <LoyaltyDetail />
    </PageSection>
  );
}
