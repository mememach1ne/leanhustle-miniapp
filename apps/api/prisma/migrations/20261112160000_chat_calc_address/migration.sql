-- Address choice for «Оформить» in the chat calculation card.
ALTER TABLE "chat_calcs"
  ADD COLUMN IF NOT EXISTS "mode" VARCHAR(12),
  ADD COLUMN IF NOT EXISTS "address_id" UUID;
