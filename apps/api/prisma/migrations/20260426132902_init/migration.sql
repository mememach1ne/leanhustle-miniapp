-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PAYMENT_PENDING', 'PAID_AWAITING_PURCHASE', 'PURCHASED', 'TRACK_CODE_RECEIVED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'MANAGER');

-- CreateEnum
CREATE TYPE "SettingsScope" AS ENUM ('DEFAULT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "telegram_id" VARCHAR(32) NOT NULL,
    "username" VARCHAR(64),
    "first_name" VARCHAR(128) NOT NULL,
    "last_name" VARCHAR(128),
    "photo_url" TEXT,
    "language_code" VARCHAR(16),
    "is_channel_subscriber" BOOLEAN NOT NULL DEFAULT false,
    "has_used_subscriber_benefit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "dewu_link" TEXT NOT NULL,
    "dw_spu_id" VARCHAR(64) NOT NULL,
    "dw_sku_id" VARCHAR(64) NOT NULL,
    "product_title" VARCHAR(512) NOT NULL,
    "product_image" TEXT,
    "category_l1" VARCHAR(128),
    "category_l2" VARCHAR(128),
    "category_l3" VARCHAR(128),
    "size_label" VARCHAR(128) NOT NULL,
    "version_label" VARCHAR(128),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_yuan" DECIMAL(12,2) NOT NULL,
    "total_usd" DECIMAL(12,2) NOT NULL,
    "delivery_rub" DECIMAL(12,0) NOT NULL,
    "duty_rub" DECIMAL(12,0) NOT NULL,
    "category_group" VARCHAR(32) NOT NULL,
    "delivery_category" VARCHAR(32),
    "estimated_weight_kg" DECIMAL(6,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(32) NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_staff_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "is_channel_subscriber_at_checkout" BOOLEAN NOT NULL DEFAULT false,
    "subscriber_benefit_applied" BOOLEAN NOT NULL DEFAULT false,
    "subscriber_benefit_amount_rub" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "items_count" INTEGER NOT NULL DEFAULT 0,
    "original_total_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "benefit_discount_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_rub" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "duty_rub" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "pricing_cny_to_usd" DECIMAL(12,6) NOT NULL,
    "pricing_cny_to_rub" DECIMAL(12,4) NOT NULL,
    "pricing_commission_percent" DECIMAL(5,2) NOT NULL,
    "customer_comment" TEXT,
    "track_code" VARCHAR(128),
    "paid_at" TIMESTAMPTZ(6),
    "purchased_at" TIMESTAMPTZ(6),
    "track_code_received_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "dewu_link" TEXT NOT NULL,
    "dw_spu_id" VARCHAR(64) NOT NULL,
    "dw_sku_id" VARCHAR(64) NOT NULL,
    "product_title" VARCHAR(512) NOT NULL,
    "product_image" TEXT,
    "category_l1" VARCHAR(128),
    "category_l2" VARCHAR(128),
    "category_l3" VARCHAR(128),
    "size_label" VARCHAR(128) NOT NULL,
    "version_label" VARCHAR(128),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_yuan" DECIMAL(12,2) NOT NULL,
    "original_total_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_usd" DECIMAL(12,2) NOT NULL,
    "delivery_rub" DECIMAL(12,0) NOT NULL,
    "duty_rub" DECIMAL(12,0) NOT NULL,
    "category_group" VARCHAR(32) NOT NULL,
    "delivery_category" VARCHAR(32),
    "estimated_weight_kg" DECIMAL(6,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sequences" (
    "prefix" VARCHAR(8) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_sequences_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "changed_by_staff_id" UUID,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "created_by_staff_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_accounts" (
    "id" UUID NOT NULL,
    "telegram_id" VARCHAR(32),
    "username" VARCHAR(64),
    "first_name" VARCHAR(128),
    "last_name" VARCHAR(128),
    "role" "StaffRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" UUID NOT NULL,
    "scope" "SettingsScope" NOT NULL DEFAULT 'DEFAULT',
    "cny_to_usd" DECIMAL(12,6) NOT NULL,
    "cny_to_rub" DECIMAL(12,4) NOT NULL,
    "eur_to_rub" DECIMAL(12,4) NOT NULL,
    "commission_percent" DECIMAL(5,2) NOT NULL,
    "delivery_price_per_kg_rub" DECIMAL(12,2) NOT NULL,
    "duty_threshold_eur" DECIMAL(12,2) NOT NULL,
    "duty_percent" DECIMAL(5,2) NOT NULL,
    "duty_processing_fee_rub" DECIMAL(12,2) NOT NULL,
    "updated_by_staff_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings_audit_logs" (
    "id" UUID NOT NULL,
    "settings_id" UUID NOT NULL,
    "changed_by_staff_id" UUID,
    "previous_values" JSONB,
    "next_values" JSONB NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "users_last_active_at_idx" ON "users"("last_active_at");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_dw_spu_id_idx" ON "cart_items"("dw_spu_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_dw_sku_id_key" ON "cart_items"("cart_id", "dw_sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_assigned_staff_status_idx" ON "orders"("assigned_staff_id", "status");

-- CreateIndex
CREATE INDEX "orders_paid_at_idx" ON "orders"("paid_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_dw_spu_id_idx" ON "order_items"("dw_spu_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_status_history_changed_by_staff_id_idx" ON "order_status_history"("changed_by_staff_id");

-- CreateIndex
CREATE INDEX "order_notes_order_id_created_at_idx" ON "order_notes"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_notes_created_by_staff_id_idx" ON "order_notes"("created_by_staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_accounts_telegram_id_key" ON "staff_accounts"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_accounts_username_key" ON "staff_accounts"("username");

-- CreateIndex
CREATE INDEX "staff_accounts_role_is_active_idx" ON "staff_accounts"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "business_settings_scope_key" ON "business_settings"("scope");

-- CreateIndex
CREATE INDEX "settings_audit_logs_settings_id_created_at_idx" ON "settings_audit_logs"("settings_id", "created_at");

-- CreateIndex
CREATE INDEX "settings_audit_logs_changed_by_staff_id_idx" ON "settings_audit_logs"("changed_by_staff_id");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_staff_id_fkey" FOREIGN KEY ("changed_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_updated_by_staff_id_fkey" FOREIGN KEY ("updated_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings_audit_logs" ADD CONSTRAINT "settings_audit_logs_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "business_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings_audit_logs" ADD CONSTRAINT "settings_audit_logs_changed_by_staff_id_fkey" FOREIGN KEY ("changed_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
