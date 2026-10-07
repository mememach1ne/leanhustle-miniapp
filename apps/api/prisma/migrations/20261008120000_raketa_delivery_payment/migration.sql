-- RAKETA delivery payment cycle: auto "Собрать", price from RAKETA,
-- client pays via a RAKETA balance top-up link, then the server pays RAKETA.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_assembled_at" TIMESTAMPTZ(6);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_price_total" DECIMAL(12,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_price_lines" JSONB;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_price_at" TIMESTAMPTZ(6);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_topup_amount" DECIMAL(12,0);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_topup_url" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_topup_created_at" TIMESTAMPTZ(6);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_topup_seen_ids" JSONB;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_topup_billing_id" VARCHAR(64);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_paid_at" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_raketa_topup_billing_id_key" ON "orders"("raketa_topup_billing_id");

-- Consolidations seen at RAKETA (incl. ones created outside our orders):
-- remembers what the server already did so restarts don't repeat it.
CREATE TABLE IF NOT EXISTS "raketa_consolidations" (
  "id" VARCHAR(64) PRIMARY KEY,
  "title" VARCHAR(255),
  "assembled_at" TIMESTAMPTZ(6),
  "price_notified_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
