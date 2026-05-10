# Local Runbook

## 1. Install tooling

- Install Node.js 20+.
- Install `pnpm` globally:

```bash
npm install -g pnpm
```

- Make sure Docker Desktop is available if you want the quick local PostgreSQL setup.

## 2. Install dependencies

```bash
pnpm install
```

## 3. Create local environment file

```bash
cp .env.example .env
```

Fill in at least:

- `TELEGRAM_BOT_TOKEN`
- `PRIVATE_CHANNEL_ID`
- `RAPIDAPI_DEWU_KEY`
- `MANAGER_TELEGRAM_IDS`
- `BOT_INTERNAL_API_TOKEN`
- seed-related staff variables if you want initial admin and manager accounts

## 4. Start PostgreSQL

Option A: Docker Compose

```bash
pnpm db:up
```

Option B: your own local PostgreSQL instance

- Create database `lean_poizon`
- Update `DATABASE_URL` in `.env`

## 5. Prepare Prisma

```bash
pnpm prisma:generate
pnpm prisma:migrate -- --name init
pnpm prisma:seed
```

Optional:

```bash
pnpm prisma:studio
```

## 6. Start the applications

Start everything in separate terminals:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:bot
```

Or run all three together:

```bash
pnpm dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Health check: `http://localhost:3001/api/health`

## 7. Test the Mini App locally

Outside Telegram:

- Open `http://localhost:3000`
- You should see the fallback mode instead of a crash

Inside Telegram:

- Host the local web app through a tunnel such as `ngrok` or `cloudflared`
- Point your Telegram bot Mini App URL to the tunnel URL
- Open the Mini App from Telegram and complete the auth flow

## 8. Test manager/admin flows

- Seed at least one `admin` and one `manager` account through `SEED_*` variables
- Start the bot with `pnpm dev:bot`
- In Telegram, open the manager bot and run:
  - `/start`
  - `/orders_help`
  - `/new_orders`
  - `/active_orders`
  - `/find_order LP001`
  - `/settings`
  - `/settings_audit`

## 9. Before moving to a server

- Replace all placeholder secrets
- Use a persistent PostgreSQL instance
- Use separate production values for:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `BOT_INTERNAL_API_TOKEN`
  - `TELEGRAM_BOT_TOKEN`
  - `RAPIDAPI_DEWU_KEY`
- Run migrations against the production database before starting the API
