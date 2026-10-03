-- RAKETA forwarder automation (stage 1: order registration).
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "fulfillment_manual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "raketa_consolidation_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "raketa_last_error" TEXT;

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "china_track_number" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "raketa_order_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "raketa_track_number" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "raketa_registered_at" TIMESTAMPTZ(6);
