-- CDEK pickup point picked from the RAKETA directory + RAKETA recipient/address ids.
ALTER TABLE "delivery_addresses"
  ADD COLUMN IF NOT EXISTS "city_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "city" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "region" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "pvz_code" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "pvz_index" VARCHAR(16);

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "delivery_city_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "delivery_city" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "delivery_region" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "delivery_pvz_code" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "delivery_pvz_index" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "raketa_recipient_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "raketa_address_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "raketa_delivery_assigned_at" TIMESTAMPTZ(6);
