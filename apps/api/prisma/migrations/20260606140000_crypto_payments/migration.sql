-- CreateEnum
CREATE TYPE "CryptoPaymentStatus" AS ENUM ('PENDING', 'MATCHED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "crypto_payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "network" VARCHAR(16) NOT NULL,
    "address" VARCHAR(128) NOT NULL,
    "address_tag" VARCHAR(64),
    "expected_amount_usdt" DECIMAL(20,6) NOT NULL,
    "status" "CryptoPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "tx_hash" VARCHAR(128),
    "bybit_deposit_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "crypto_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crypto_payments_status_network_idx" ON "crypto_payments"("status", "network");

-- CreateIndex
CREATE INDEX "crypto_payments_order_status_idx" ON "crypto_payments"("order_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_payments_bybit_deposit_id_uniq" ON "crypto_payments"("bybit_deposit_id");

-- AddForeignKey
ALTER TABLE "crypto_payments" ADD CONSTRAINT "crypto_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
