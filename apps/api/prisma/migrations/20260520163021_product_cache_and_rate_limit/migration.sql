-- CreateTable
CREATE TABLE "product_cache" (
    "dw_spu_id" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "cached_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_cache_pkey" PRIMARY KEY ("dw_spu_id")
);

-- CreateTable
CREATE TABLE "product_resolve_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dw_spu_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_resolve_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_cache_expires_at_idx" ON "product_cache"("expires_at");

-- CreateIndex
CREATE INDEX "product_resolve_events_user_created_idx" ON "product_resolve_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "product_resolve_events" ADD CONSTRAINT "product_resolve_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
