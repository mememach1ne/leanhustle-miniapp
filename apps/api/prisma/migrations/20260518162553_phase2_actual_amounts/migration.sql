-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_PAYMENT_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_PAID';
ALTER TYPE "OrderStatus" ADD VALUE 'DUTY_PAYMENT_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'DUTY_PAID';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "actual_delivery_rub" DECIMAL(12,0),
ADD COLUMN     "actual_delivery_set_at" TIMESTAMPTZ(6),
ADD COLUMN     "actual_duty_rub" DECIMAL(12,0),
ADD COLUMN     "actual_duty_set_at" TIMESTAMPTZ(6),
ADD COLUMN     "delivered_at" TIMESTAMPTZ(6),
ADD COLUMN     "delivery_paid_at" TIMESTAMPTZ(6),
ADD COLUMN     "duty_paid_at" TIMESTAMPTZ(6);
