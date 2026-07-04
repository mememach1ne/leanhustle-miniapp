'use client';

import { useId } from 'react';

/** Metallic gradient stops per tier — replaces the tier emoji with a clean gem. */
const TIER_GRADIENTS: Record<string, [string, string]> = {
  silver: ['#eef2f7', '#94a3b8'],
  gold: ['#fde68a', '#e59a0c'],
  platinum: ['#e6ecff', '#8b9cff'],
};

const FALLBACK: [string, string] = ['#cbd5e1', '#64748b'];

/**
 * A faceted gem in the tier's metallic colour, used everywhere a tier is
 * shown (badge, stepper node, ladder). Replaces the 🥈/🥇/💎 emoji.
 */
export function TierIcon({
  tierKey,
  size = 16,
  className = '',
}: {
  tierKey?: string | null;
  size?: number;
  className?: string;
}) {
  const id = useId();
  const [c1, c2] = TIER_GRADIENTS[tierKey ?? ''] ?? FALLBACK;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      {/* gem body */}
      <path d="M5 4 H19 L22 9 L12 21 L2 9 Z" fill={`url(#${id})`} />
      {/* crown shine */}
      <path d="M5 4 H19 L16 9 H8 Z" fill="rgba(255,255,255,0.28)" />
      {/* subtle facet lines */}
      <path
        d="M2 9 H22 M8 9 L12 21 M16 9 L12 21"
        stroke="rgba(15,23,42,0.22)"
        strokeWidth="0.5"
      />
    </svg>
  );
}
