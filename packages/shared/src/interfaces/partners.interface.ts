/** Client's referral block (inside «Лояльность»). Amounts in USD. */
export interface ReferralSummaryDto {
  /** t.me/lh_poizonbot?start=ref_<code> */
  link: string;
  /** Share of our commission the referrer gets (%). 0 = program is off. */
  percent: number;
  minPayoutUsd: number;
  invitedCount: number;
  /** Invited users who made at least one paid order. */
  buyersCount: number;
  /** Credited for orders not delivered yet. */
  pendingUsd: number;
  /** Can be requested for payout. */
  availableUsd: number;
  paidUsd: number;
  /** An open payout request, if any. */
  openPayout: { amountUsd: number; createdAt: string } | null;
  recent: Array<{ orderNumber: string; amountUsd: number; status: 'PENDING' | 'AVAILABLE' | 'CANCELLED' | 'PAID'; createdAt: string }>;
}

/** Payout request as staff see it. */
export interface ReferralPayoutAdminDto {
  id: string;
  user: { id: string; telegramId: string; username: string | null; firstName: string };
  amountUsd: number;
  status: 'REQUESTED' | 'PAID' | 'REJECTED';
  createdAt: string;
  processedAt: string | null;
}

export interface PartnerDto {
  staffId: string;
  username: string | null;
  firstName: string | null;
  isOwner: boolean;
  sharePercent: number | null;
}

/** «Прибыль» tab of a partner. Amounts in USD. */
export interface PartnerDashboardDto {
  me: PartnerDto & {
    balanceUsd: number;
    earnedThisMonthUsd: number;
    payoutChain: string | null;
    payoutAddress: string | null;
    /** Withdrawals are blocked for 24 h after the address changes. */
    withdrawBlockedUntil: string | null;
  };
  /** Whether Bybit withdrawals are configured on the server. */
  withdrawEnabled: boolean;
  minWithdrawUsd: number;
  chains: string[];
  entries: Array<{
    id: string;
    kind: 'ORDER' | 'REVERSAL' | 'WITHDRAWAL' | 'ADJUSTMENT';
    orderNumber: string | null;
    amountUsd: number;
    commissionUsd: number | null;
    referralUsd: number | null;
    sharePercent: number | null;
    note: string | null;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    amountUsd: number;
    chain: string;
    address: string;
    trigger: 'MANUAL' | 'MONTHLY';
    status: 'PENDING' | 'SENT' | 'FAILED';
    error: string | null;
    createdAt: string;
  }>;
  /** Owner only: all partners and their shares. */
  partners?: Array<PartnerDto & { balanceUsd: number }>;
  /** Admins with no share yet (owner can make them partners). */
  candidates?: PartnerDto[];
  /** Referral payout requests waiting for a manager. */
  referralPayouts: ReferralPayoutAdminDto[];
}
