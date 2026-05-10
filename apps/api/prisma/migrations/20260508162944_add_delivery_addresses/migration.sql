-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_address_id" UUID,
ADD COLUMN     "delivery_cdek_address" VARCHAR(512),
ADD COLUMN     "delivery_full_name" VARCHAR(256),
ADD COLUMN     "delivery_phone" VARCHAR(20);

-- CreateTable
CREATE TABLE "delivery_addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(256) NOT NULL,
    "cdek_address" VARCHAR(512) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_addresses_user_id_idx" ON "delivery_addresses"("user_id");

-- AddForeignKey
ALTER TABLE "delivery_addresses" ADD CONSTRAINT "delivery_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "delivery_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
