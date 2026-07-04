-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('MANUAL', 'CRYPTO_AUTO');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "paid_via" "PaymentSource";
