/*
  Warnings:

  - You are about to drop the column `price_rub` on the `catalog_products` table. All the data in the column will be lost.
  - Added the required column `price_usd` to the `catalog_products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- DEFAULT 0 lets this apply against the already-populated production table;
-- CatalogSyncService.sync() overwrites every active row's price_usd on the
-- very next run (triggered manually right after this deploy).
ALTER TABLE "catalog_products" DROP COLUMN "price_rub",
ADD COLUMN     "price_usd" DECIMAL(10,2) NOT NULL DEFAULT 0;
