-- Payment from the Telegram TON wallet inside the order card (Bot API 10.4
-- widgets): GRAM/TON lands on our Bybit deposit address, the order is paid by
-- the on-chain check, then the server sells it for USDT on Bybit.
ALTER TYPE "PaymentSource" ADD VALUE IF NOT EXISTS 'TON_WALLET';

ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "ton_markup_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0.5;

CREATE TABLE IF NOT EXISTS "ton_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "status" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
  "amount_nano" BIGINT NOT NULL,
  "usd_amount" DECIMAL(12, 2) NOT NULL,
  "ton_usd_rate" DECIMAL(14, 6) NOT NULL,
  "markup_percent" DECIMAL(5, 2) NOT NULL,
  "to_address" VARCHAR(80) NOT NULL,
  "valid_until" TIMESTAMPTZ(6) NOT NULL,
  "msg_hash" VARCHAR(100),
  "from_address" VARCHAR(80),
  "tx_hash" VARCHAR(100),
  "paid_at" TIMESTAMPTZ(6),
  "bybit_deposit_id" VARCHAR(64),
  "sold_at" TIMESTAMPTZ(6),
  "sold_usdt" DECIMAL(14, 6),
  "sell_error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "ton_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ton_payments_order_idx" ON "ton_payments" ("order_id");
CREATE INDEX IF NOT EXISTS "ton_payments_status_idx" ON "ton_payments" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "ton_payments_msg_hash_key" ON "ton_payments" ("msg_hash");
