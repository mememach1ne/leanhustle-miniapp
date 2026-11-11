-- Live order card (Telegram chat widget): message id in the client's chat,
-- last sent data/caption/keyboard (to skip no-op edits) and last refresh.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "widget_message_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "widget_state" TEXT,
  ADD COLUMN IF NOT EXISTS "widget_refreshed_at" TIMESTAMPTZ(6);
