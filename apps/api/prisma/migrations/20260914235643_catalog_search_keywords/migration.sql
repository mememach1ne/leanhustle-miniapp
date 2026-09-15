-- AlterTable
ALTER TABLE "catalog_products" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "popularity_order" DROP NOT NULL,
ALTER COLUMN "price_usd" DROP DEFAULT;
