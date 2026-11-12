-- Multi-link price calculation in the chat with the bot (a widget card).
CREATE TABLE IF NOT EXISTS "chat_calcs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "chat_id" VARCHAR(32) NOT NULL,
  "message_id" INTEGER,
  "status" VARCHAR(12) NOT NULL DEFAULT 'open',
  "lines" JSONB NOT NULL DEFAULT '[]',
  "page" INTEGER NOT NULL DEFAULT 0,
  "expanded" INTEGER,
  "notice" VARCHAR(200),
  "order_id" UUID,
  "widget_state" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "chat_calcs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chat_calcs_chat_status_idx" ON "chat_calcs" ("chat_id", "status");
CREATE INDEX IF NOT EXISTS "chat_calcs_message_idx" ON "chat_calcs" ("chat_id", "message_id");
