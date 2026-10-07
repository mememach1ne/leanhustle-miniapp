-- Small key/value store for the RAKETA automation (e.g. the last seen main
-- balance: client top-ups don't show in billing history, only in the balance).
CREATE TABLE IF NOT EXISTS "raketa_state" (
  "key" VARCHAR(64) PRIMARY KEY,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
