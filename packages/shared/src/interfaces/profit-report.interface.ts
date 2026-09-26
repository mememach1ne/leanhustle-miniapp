/**
 * Monthly / arbitrary-range profit report used to split earnings with the
 * investor. "Profit" here is the net service commission:
 *
 *   netProfit = grossCommission − discounts
 *
 * where grossCommission is the commission portion of each fulfilled order's
 * original total, and discounts are the commission waivers on legacy
 * first-order-benefit orders (no longer granted to new orders). Product cost, delivery
 * and duty are pass-through and never counted as profit.
 *
 * Orders are bucketed by the moment they were marked paid
 * (PAID_AWAITING_PURCHASE), regardless of crypto vs manual payment, and
 * CANCELLED orders are excluded.
 */
export interface ProfitReportOrderRow {
  orderNumber: string;
  /** ISO timestamp of the PAID transition (revenue realization date). */
  paidAt: string;
  customerUsername?: string | null;
  grossCommissionUsd: number;
  discountUsd: number;
  netProfitUsd: number;
  netProfitRub: number;
}

export interface ProfitReportDto {
  /** Inclusive range bounds, ISO date strings (yyyy-mm-dd). */
  from: string;
  to: string;
  ordersCount: number;
  /** Gross revenue that passed through (informational). */
  revenueUsd: number;
  grossCommissionUsd: number;
  discountUsd: number;
  netProfitUsd: number;
  netProfitRub: number;
  /** Share that goes to the investor, e.g. 50. */
  investorSharePercent: number;
  investorShareRub: number;
  ownerShareRub: number;
  rows: ProfitReportOrderRow[];
}

export interface ProfitReportQuery {
  /** yyyy-mm-dd inclusive. */
  from: string;
  /** yyyy-mm-dd inclusive. */
  to: string;
}
