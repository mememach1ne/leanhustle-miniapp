-- Parcel tracking: RAKETA number of the whole parcel (RAC… consolidation or
-- the single item's RA…) and the CDEK track of the RF leg.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_parcel_track" VARCHAR(64);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raketa_tk_track" VARCHAR(64);
