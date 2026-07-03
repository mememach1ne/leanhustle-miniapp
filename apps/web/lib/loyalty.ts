import type { CSSProperties } from 'react';

/** Per-tier visual identity: badge icon, colours, and glow ring/aura values. */
export interface TierVisual {
  icon: string;
  /** Badge text colour. */
  text: string;
  ring: string;
  ringStrong: string;
  glowSoft: string;
  glowStrong: string;
}

export const TIER_VISUALS: Record<string, TierVisual> = {
  silver: {
    icon: '🥈',
    text: '#e3eaf3',
    ring: 'rgba(198, 209, 224, 0.45)',
    ringStrong: 'rgba(198, 209, 224, 0.75)',
    glowSoft: 'rgba(198, 209, 224, 0.14)',
    glowStrong: 'rgba(198, 209, 224, 0.32)',
  },
  gold: {
    icon: '🥇',
    text: '#ffd873',
    ring: 'rgba(240, 185, 60, 0.45)',
    ringStrong: 'rgba(240, 185, 60, 0.82)',
    glowSoft: 'rgba(240, 185, 60, 0.16)',
    glowStrong: 'rgba(240, 185, 60, 0.42)',
  },
  platinum: {
    icon: '💎',
    text: '#c7d0ff',
    ring: 'rgba(150, 160, 255, 0.5)',
    ringStrong: 'rgba(150, 160, 255, 0.85)',
    glowSoft: 'rgba(150, 160, 255, 0.2)',
    glowStrong: 'rgba(150, 160, 255, 0.46)',
  },
};

const FALLBACK_VISUAL: TierVisual = {
  icon: '⭐',
  text: '#e3eaf3',
  ring: 'rgba(41, 195, 197, 0.45)',
  ringStrong: 'rgba(41, 195, 197, 0.8)',
  glowSoft: 'rgba(41, 195, 197, 0.16)',
  glowStrong: 'rgba(41, 195, 197, 0.4)',
};

export function tierVisual(key?: string | null): TierVisual {
  if (!key) return FALLBACK_VISUAL;
  return TIER_VISUALS[key] ?? FALLBACK_VISUAL;
}

export function tierIcon(key?: string | null): string {
  return tierVisual(key).icon;
}

/** Inline custom properties consumed by the `.lg-tier-glow` / burst animations. */
export function tierGlowVars(key?: string | null): CSSProperties {
  const v = tierVisual(key);
  return {
    ['--tier-ring' as string]: v.ring,
    ['--tier-ring-strong' as string]: v.ringStrong,
    ['--tier-glow-soft' as string]: v.glowSoft,
    ['--tier-glow-strong' as string]: v.glowStrong,
  };
}

export function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString('ru-RU')}`;
}

/** Discount rendered as a percent, e.g. 4 → "−4%". */
export function formatDiscount(points: number): string {
  return `−${points}%`;
}
