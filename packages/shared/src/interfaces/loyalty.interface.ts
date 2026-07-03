/**
 * A loyalty tier: once a channel subscriber's lifetime purchase total (goods
 * only, USD) reaches `thresholdUsd`, their service commission is reduced by
 * `discountPercentPoints` percentage points.
 */
export interface LoyaltyTier {
  /** Stable identifier, e.g. 'silver'. */
  key: string;
  /** Display name, e.g. 'Серебро'. */
  name: string;
  /** Cumulative goods spend (USD) required to reach this tier. */
  thresholdUsd: number;
  /** Percentage points subtracted from the commission at this tier. */
  discountPercentPoints: number;
}

/** Default ladder — configurable in business settings. */
export const DEFAULT_LOYALTY_TIERS: LoyaltyTier[] = [
  { key: 'silver', name: 'Серебро', thresholdUsd: 500, discountPercentPoints: 2 },
  { key: 'gold', name: 'Золото', thresholdUsd: 1500, discountPercentPoints: 4 },
  { key: 'platinum', name: 'Платина', thresholdUsd: 3000, discountPercentPoints: 6 },
];

/** Response of GET /loyalty/me — powers the profile teaser. */
export interface LoyaltyStatusDto {
  /** Program enabled at all (business setting). */
  enabled: boolean;
  /** This user qualifies (channel subscriber). */
  eligible: boolean;
  /** Cumulative goods spend (USD) over fulfilled, non-cancelled orders. */
  spentUsd: number;
  /** Effective commission discount applied now (0 if not eligible). */
  discountPercentPoints: number;
  /** Highest reached tier, or null. */
  currentTier: LoyaltyTier | null;
  /** Next tier to unlock, or null at the top. */
  nextTier: LoyaltyTier | null;
  /** Remaining spend to the next tier, or null at the top. */
  amountToNextUsd: number | null;
  /** Full ladder for display. */
  tiers: LoyaltyTier[];
}
