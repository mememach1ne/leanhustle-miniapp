-- CreateTable
CREATE TABLE "catalog_products" (
    "spu_id" VARCHAR(32) NOT NULL,
    "title" TEXT NOT NULL,
    "article" VARCHAR(64),
    "image_url" TEXT NOT NULL,
    "price_cny" DECIMAL(10,2) NOT NULL,
    "price_rub" DECIMAL(10,2) NOT NULL,
    "sold_text" VARCHAR(32),
    "sold_rank" INTEGER NOT NULL DEFAULT 0,
    "popularity_order" INTEGER NOT NULL,
    "category" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("spu_id")
);

-- CreateIndex
CREATE INDEX "catalog_products_active_order_idx" ON "catalog_products"("is_active", "popularity_order");

-- CreateIndex
CREATE INDEX "catalog_products_sold_rank_idx" ON "catalog_products"("sold_rank");
