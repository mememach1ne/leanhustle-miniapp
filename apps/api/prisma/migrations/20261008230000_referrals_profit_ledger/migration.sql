-- Referral program + partners' profit ledger.

-- Who invited whom.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "users_referred_by_id_idx" ON "users"("referred_by_id");

-- Bonus per order of an invited user (share of our commission).
CREATE TABLE IF NOT EXISTS "referral_rewards" (
  "id" UUID PRIMARY KEY,
  "referrer_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referred_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "order_id" UUID NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
  "commission_usd" DECIMAL(12,2) NOT NULL,
  "percent" DECIMAL(5,2) NOT NULL,
  "amount_usd" DECIMAL(12,2) NOT NULL,
  -- PENDING (order not delivered yet) | AVAILABLE | CANCELLED | PAID
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "payout_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "available_at" TIMESTAMPTZ(6)
);
CREATE INDEX IF NOT EXISTS "referral_rewards_referrer_idx" ON "referral_rewards"("referrer_id", "status");

-- Payout requests (paid by a manager by hand for now).
CREATE TABLE IF NOT EXISTS "referral_payouts" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount_usd" DECIMAL(12,2) NOT NULL,
  -- REQUESTED | PAID | REJECTED
  "status" VARCHAR(16) NOT NULL DEFAULT 'REQUESTED',
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "processed_at" TIMESTAMPTZ(6),
  "processed_by_staff_id" UUID REFERENCES "staff_accounts"("id") ON DELETE SET NULL
);

-- Partners (profit split) on staff accounts.
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "is_owner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "profit_share_percent" DECIMAL(5,2);
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "payout_chain" VARCHAR(16);
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "payout_address" VARCHAR(128);
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "payout_address_changed_at" TIMESTAMPTZ(6);

-- Partner balance movements (USD): + order share, − reversal / withdrawal.
CREATE TABLE IF NOT EXISTS "profit_entries" (
  "id" UUID PRIMARY KEY,
  "staff_id" UUID NOT NULL REFERENCES "staff_accounts"("id") ON DELETE CASCADE,
  "order_id" UUID REFERENCES "orders"("id") ON DELETE SET NULL,
  -- ORDER | REVERSAL | WITHDRAWAL | ADJUSTMENT
  "kind" VARCHAR(16) NOT NULL,
  "amount_usd" DECIMAL(12,2) NOT NULL,
  "commission_usd" DECIMAL(12,2),
  "referral_usd" DECIMAL(12,2),
  "share_percent" DECIMAL(5,2),
  "withdrawal_id" UUID,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "profit_entries_staff_order_kind_key" ON "profit_entries"("staff_id", "order_id", "kind");
CREATE INDEX IF NOT EXISTS "profit_entries_staff_idx" ON "profit_entries"("staff_id", "created_at");

-- USDT withdrawals of partner balances through Bybit.
CREATE TABLE IF NOT EXISTS "profit_withdrawals" (
  "id" UUID PRIMARY KEY,
  "staff_id" UUID NOT NULL REFERENCES "staff_accounts"("id") ON DELETE CASCADE,
  "amount_usd" DECIMAL(12,2) NOT NULL,
  "chain" VARCHAR(16) NOT NULL,
  "address" VARCHAR(128) NOT NULL,
  -- MANUAL | MONTHLY
  "trigger" VARCHAR(16) NOT NULL,
  -- PENDING | SENT | FAILED
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "bybit_withdraw_id" VARCHAR(64),
  "error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Ledger bookkeeping on orders. Orders paid before the ledger existed are
-- marked as already accounted, so nothing is credited retroactively.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "profit_accounted_at" TIMESTAMPTZ(6);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "profit_reversed_at" TIMESTAMPTZ(6);
UPDATE "orders" SET "profit_accounted_at" = now() WHERE "paid_at" IS NOT NULL AND "profit_accounted_at" IS NULL;
