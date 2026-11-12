-- /start menu as a Telegram widget: the last menu message per user (the previous one is deleted).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "menu_message_id" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "menu_state" TEXT;
