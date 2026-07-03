-- AlterTable
ALTER TABLE "business_settings"
  ADD COLUMN "loyalty_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "loyalty_tiers" JSONB NOT NULL DEFAULT '[{"key":"silver","name":"Серебро","thresholdUsd":500,"discountPercentPoints":2},{"key":"gold","name":"Золото","thresholdUsd":1500,"discountPercentPoints":4},{"key":"platinum","name":"Платина","thresholdUsd":3000,"discountPercentPoints":6}]';
