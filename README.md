# LEAN POIZON

Production-ready monorepo for a Telegram Mini App service that helps users order items from Dewu (Poizon) to Russia.

## Stack

- `apps/web` — Next.js App Router, TypeScript, Tailwind CSS, Zustand
- `apps/api` — NestJS, Prisma, PostgreSQL
- `apps/bot` — Telegraf, TypeScript
- `packages/shared` — shared DTOs, enums, contracts, utilities
- Monorepo — `pnpm workspaces`

## Project structure

```text
apps/
  api/
  bot/
  web/
packages/
  shared/
docs/
  local-runbook.md
  manual-qa-checklist.md
```

## Available scripts

Root scripts:

- `pnpm dev`
- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm dev:bot`
- `pnpm build`
- `pnpm build:web`
- `pnpm build:api`
- `pnpm build:bot`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma:generate`
- `pnpm prisma:migrate -- --name <migration_name>`
- `pnpm prisma:seed`
- `pnpm prisma:studio`
- `pnpm db:up`
- `pnpm db:down`

## Environment variables

Copy `.env.example` to `.env` and fill the values.

### Database

- `DATABASE_URL`

### API

- `PORT`
- `CORS_ORIGIN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_AUTH_MAX_AGE_SECONDS`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PRIVATE_CHANNEL_ID`
- `RAPIDAPI_DEWU_KEY`
- `RAPIDAPI_DEWU_HOST`
- `RAPIDAPI_DEWU_PRODUCT_ENDPOINT`
- `MANAGER_TELEGRAM_IDS`
- `BOT_INTERNAL_API_TOKEN`

### Web

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_API_BASE_URL`

### Bot

- `BOT_API_URL`
- `BOT_LOG_LEVEL`

### Seed

- `SEED_ADMIN_TELEGRAM_IDS`
- `SEED_ADMIN_USERNAMES`
- `SEED_MANAGER_TELEGRAM_IDS`
- `SEED_MANAGER_USERNAMES`

## Local launch

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

Quick start with Docker:

```bash
pnpm db:up
```

Or run your own PostgreSQL and point `DATABASE_URL` to it.

### 3. Create local env file

```bash
cp .env.example .env
```

Minimum values to fill before a realistic local run:

- `TELEGRAM_BOT_TOKEN`
- `PRIVATE_CHANNEL_ID`
- `RAPIDAPI_DEWU_KEY`
- `MANAGER_TELEGRAM_IDS`
- `BOT_INTERNAL_API_TOKEN`

### 4. Prepare Prisma

```bash
pnpm prisma:generate
pnpm prisma:migrate -- --name init
pnpm prisma:seed
```

The seed is idempotent and:

- creates the singleton `BusinessSettings`
- creates or updates initial `StaffAccount` records from `SEED_*`

### 5. Start services

All at once:

```bash
pnpm dev
```

Or separately:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:bot
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Health: `http://localhost:3001/api/health`

## Local testing notes

### Telegram Mini App auth

- Outside Telegram the web app shows the fallback mode and should not crash.
- To test the real Telegram WebApp auth flow locally, expose the web app through a tunnel such as `ngrok` or `cloudflared`.
- Set the bot Mini App URL to the tunnel URL and open the app from Telegram.

### Manager bot flow

- The bot talks to the API through `BOT_API_URL`.
- Staff API calls are protected by:
  - `x-internal-bot-token`
  - `x-telegram-id`
  - `x-telegram-username`
- The API validates the internal token against `BOT_INTERNAL_API_TOKEN`.
- Seed at least one admin or manager account before testing bot actions.

## Manual QA checklist

Detailed checklist: [docs/manual-qa-checklist.md](C:/lh%20miniapp/docs/manual-qa-checklist.md)

### User

- Open the Mini App from Telegram.
- Authenticate through Telegram WebApp auth.
- Refresh channel subscription status.
- Paste a Dewu link and resolve a product.
- Select a size and receive pricing.
- Add the item to the cart.
- Change quantity in the cart.
- Checkout and create an order.
- Confirm the order appears in `Мои заказы`.

### Manager

- Receive the new order notification in Telegram.
- Open `/new_orders` and `/active_orders`.
- Find an order with `/find_order LP001`.
- Move the order to `Ожидание оплаты`.
- Move the order to `Оплачен, ожидается выкуп`.
- Verify subscriber benefit behavior when applicable.
- Move the order to `Выкуплен`.
- Enter a track code.
- Confirm the user sees the updated status in the Mini App.

### Admin

- Open `/settings`.
- Change a rate through `/set_rate`.
- Change commission through `/set_commission`.
- Change delivery price through `/set_delivery`.
- Review changes through `/settings_audit`.

## Current implementation

- Telegram Mini App auth with server-side Telegram `initData` validation
- Channel subscription refresh through Telegram Bot API
- Dewu product resolve flow through RapidAPI
- Pricing engine with approximate delivery and duty estimation
- Persistent cart with quantity handling and snapshot pricing
- Checkout from cart to order snapshot
- Order numbers with `LP` and `L` prefixes
- Manager/admin bot actions for order status changes and track code input
- Subscriber benefit on the first paid order
- Bot-based business settings management with audit log
- Polished mobile-first Mini App UI

## Deployment preparation

For server deployment:

- deploy `web`, `api`, and `bot` as separate services
- use a managed or separately hosted PostgreSQL instance
- run Prisma migrations before starting the API
- configure production env values for all secrets and external integrations
- keep `web` and `api` reachable by the bot through `BOT_API_URL`

Recommended production service split:

- `apps/web` — public Mini App frontend
- `apps/api` — private application API
- `apps/bot` — Telegram manager/admin bot worker
- PostgreSQL — external or dedicated database service

## Helpful docs

- Local runbook: [docs/local-runbook.md](C:/lh%20miniapp/docs/local-runbook.md)
- Manual QA checklist: [docs/manual-qa-checklist.md](C:/lh%20miniapp/docs/manual-qa-checklist.md)
