-- Delivery method chosen by the client (carrier × pickup point/courier × tariff)
-- and RAKETA extra services (packaging per parcel, photo report per item).

ALTER TABLE "delivery_addresses"
  ADD COLUMN IF NOT EXISTS "carrier" VARCHAR(16) NOT NULL DEFAULT 'cdek',
  ADD COLUMN IF NOT EXISTS "kind" VARCHAR(8) NOT NULL DEFAULT 'pvz',
  ADD COLUMN IF NOT EXISTS "courier" JSONB;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "delivery_carrier" VARCHAR(16) NOT NULL DEFAULT 'cdek',
  ADD COLUMN IF NOT EXISTS "delivery_kind" VARCHAR(8) NOT NULL DEFAULT 'pvz',
  ADD COLUMN IF NOT EXISTS "delivery_tariff" VARCHAR(8) NOT NULL DEFAULT 'STND',
  ADD COLUMN IF NOT EXISTS "delivery_courier" JSONB,
  ADD COLUMN IF NOT EXISTS "delivery_days_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "delivery_days_max" INTEGER,
  ADD COLUMN IF NOT EXISTS "packaging" VARCHAR(8);

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "photo_report" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "photo_report_comment" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "photo_report_urls" JSONB,
  ADD COLUMN IF NOT EXISTS "photo_report_sent_at" TIMESTAMPTZ(6);
