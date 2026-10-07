-- RAKETA insurance ("Защита от рисков", 1% of goods) + custom RAKETA title.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "insurance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "insurance_rub" DECIMAL(12,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "raketa_title" VARCHAR(120);
