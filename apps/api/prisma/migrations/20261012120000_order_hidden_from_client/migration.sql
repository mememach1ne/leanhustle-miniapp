-- Staff can hide an order from the client while it's being fixed.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "hidden_from_client" BOOLEAN NOT NULL DEFAULT false;
