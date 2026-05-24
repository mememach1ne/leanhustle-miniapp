-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancel_reason" VARCHAR(256),
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(6);
