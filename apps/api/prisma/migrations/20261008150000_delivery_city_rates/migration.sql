-- CDEK (RF leg) prices per million-plus city from the public RAKETA
-- calculator for reference parcels; used to adjust the Moscow-based table.
CREATE TABLE IF NOT EXISTS "delivery_city_rates" (
  "city_id" VARCHAR(64) PRIMARY KEY,
  -- RF-leg rubles for each reference parcel, in RegionalDeliveryService order.
  "points" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
