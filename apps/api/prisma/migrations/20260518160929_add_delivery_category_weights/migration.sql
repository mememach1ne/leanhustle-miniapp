-- CreateTable
CREATE TABLE "delivery_category_weights" (
    "id" UUID NOT NULL,
    "category_key" VARCHAR(640) NOT NULL,
    "category_l1" VARCHAR(200),
    "category_l2" VARCHAR(200),
    "category_l3" VARCHAR(200),
    "title" VARCHAR(200) NOT NULL,
    "weight_kg" DECIMAL(8,3),
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_staff_id" UUID,
    "encounter_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "delivery_category_weights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_category_weights_category_key_key" ON "delivery_category_weights"("category_key");

-- CreateIndex
CREATE INDEX "delivery_category_weights_weight_kg_idx" ON "delivery_category_weights"("weight_kg");

-- CreateIndex
CREATE INDEX "delivery_category_weights_lookup_idx" ON "delivery_category_weights"("category_l1", "category_l2", "category_l3");

-- AddForeignKey
ALTER TABLE "delivery_category_weights" ADD CONSTRAINT "delivery_category_weights_updated_by_staff_id_fkey" FOREIGN KEY ("updated_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
