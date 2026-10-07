-- Orders created for a not-yet-known client: no owner until claimed via a bot link.
ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "claim_token" VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_claim_token_key" ON "orders"("claim_token");
