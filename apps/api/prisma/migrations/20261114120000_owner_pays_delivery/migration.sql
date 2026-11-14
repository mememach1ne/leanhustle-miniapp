-- «Доставку оплачу сам»: the owner pays the RAKETA delivery from the cabinet balance (bonuses first), no link to the client.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "owner_pays_delivery" BOOLEAN NOT NULL DEFAULT false;
