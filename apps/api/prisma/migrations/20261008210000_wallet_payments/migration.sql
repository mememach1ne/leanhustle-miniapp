-- Payments through Telegram wallets (CryptoBot, xRocket) + settings for
-- their fees (paid by the client) and for the referral program.
ALTER TYPE "PaymentSource" ADD VALUE IF NOT EXISTS 'CRYPTOBOT';
ALTER TYPE "PaymentSource" ADD VALUE IF NOT EXISTS 'XROCKET';

ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "cryptobot_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 3;
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "xrocket_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 1.5;
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "referral_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "referral_min_payout_usd" DECIMAL(12,2) NOT NULL DEFAULT 20;

CREATE TABLE IF NOT EXISTS "wallet_invoices" (
  "id" UUID PRIMARY KEY,
  "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "provider" VARCHAR(16) NOT NULL,
  "external_id" VARCHAR(64) NOT NULL,
  "pay_url" TEXT NOT NULL,
  "base_usd" DECIMAL(12,2) NOT NULL,
  "fee_percent" DECIMAL(5,2) NOT NULL,
  "amount_usdt" DECIMAL(12,2) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "paid_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_invoices_provider_external_id_key" ON "wallet_invoices"("provider", "external_id");
CREATE INDEX IF NOT EXISTS "wallet_invoices_status_idx" ON "wallet_invoices"("status");
CREATE INDEX IF NOT EXISTS "wallet_invoices_order_id_idx" ON "wallet_invoices"("order_id");
