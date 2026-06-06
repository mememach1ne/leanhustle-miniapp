import type { PaymentNetwork } from '../enums/payment-network.enum';

export type CryptoPaymentStatus =
  /** Waiting for the customer's deposit to land on Bybit. */
  | 'PENDING'
  /** Deposit found, amount matches, order moved to PAID_AWAITING_PURCHASE. */
  | 'MATCHED'
  /** TTL ran out without a matching deposit. */
  | 'EXPIRED'
  /** Staff or system cancelled the intent (e.g. user picked a different network). */
  | 'CANCELLED';

/** Body for `POST /orders/:id/payment-intent`. */
export interface CreateCryptoPaymentIntentRequest {
  network: PaymentNetwork;
}

/**
 * Response of intent creation + status polling. Everything the UI needs
 * to render the "send USDT to this address" screen.
 */
export interface CryptoPaymentIntentDto {
  id: string;
  orderId: string;
  orderNumber: string;
  network: PaymentNetwork;
  /** Bybit master-account USDT deposit address for this network. */
  address: string;
  /**
   * Memo / address tag for chains that require it (e.g. TON). Empty string
   * if the chain doesn't use tags — clients should still display the field
   * so users don't paste address-only and lose funds.
   */
  addressTag?: string | null;
  /**
   * Exact USDT amount the customer must send. Includes the unique cents
   * suffix used for matching. Always rendered with 2 decimals.
   */
  expectedAmountUsdt: number;
  status: CryptoPaymentStatus;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp — when this intent stops accepting new deposits. */
  expiresAt: string;
  /** Set when status = MATCHED. */
  matchedAt?: string | null;
  /** Set when status = MATCHED. Bybit-side transaction id. */
  txHash?: string | null;
}
