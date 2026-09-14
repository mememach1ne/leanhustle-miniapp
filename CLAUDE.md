# LeanHustle Miniapp

Telegram Mini App **и** браузерное веб-приложение для реселл-бизнеса (товары Poizon/Dewu, Китай→Россия). pnpm/tsx-монорепо. Отдельный сервис цен живёт в проекте **dewu-api** (см. раздел «Движок цен»).

## Структура
- `apps/web` — Next.js 15, фронт (UI Telegram Mini App и браузерной версии)
- `apps/api` — NestJS-бэкенд (products, orders, payments, loyalty, admin, auth)
- `apps/bot` — Telegram-бот
- `packages/shared` — общие TS-интерфейсы (напр. `product.interface.ts` → `DewuResolvedProduct`)

Git: `github.com/mememach1ne/leanhustle-miniapp`, ветка `master`.

## Домены / поверхности (всё — один и тот же код)
- **Telegram Mini App** → `apps/web`
- **Браузерная версия:** `https://china.leanhustle.net` (а также `leanhustle.ru`, `www.leanhustle.ru`). nginx-сайт `leanhustle` проксирует: фронт → `127.0.0.1:3000` (web), `/api/` → `127.0.0.1:3002/api/` (api). Отдельного кода нет — это web-сборка того же `/opt/app`.
- Не относится к этому проекту: `leanhustle.net` — статический маркетинг-сайт в `/var/www/leanhustle.net`; `work.leanhustle.net` — сервис `lh-workbot`.

## Сервер и деплой
- Хост **`91.236.186.168`** (Frankfurt, Ubuntu 24.04). SSH-ключ `~/.ssh/lh_workbot_deploy` (назван по workbot, но это root-ключ ко всему серверу).
- Код развёрнут в **`/opt/app`**, запуск под **pm2 через tsx** (TypeScript исполняется напрямую, **сборки нет**):
  - pm2 `web` → `next start -p 3000`
  - pm2 `api` → `tsx apps/api/src/main.ts` (порт **3002**)
  - pm2 `bot` → `tsx apps/bot/src/main.ts`
- Применить изменения: правка исходника (в репо или прямо в `/opt/app`) + **`pm2 restart <web|api|bot>`**. Если правил в `/opt/app` — потом зеркаль в git.
- БД: PostgreSQL через Prisma. **Redis (`localhost:6379`) сейчас НЕ запущен** — кэши, что его используют, работают вхолостую, но не падают.
- Синхронизация репо: локальный `C:\lh miniapp` по коммитам чуть впереди сервера; серверная «дельта» — только инфрафайлы (`package.json` +tsx, `pnpm-workspace.yaml` `onlyBuiltDependencies`, `pnpm-lock.yaml`, `ecosystem.config.js`).

## Движок цен (шов с проектом dewu-api)
Резолв товара: `apps/api` products → `DewuApiClientService.queryProductDetail(dwSpuId)` → HTTP `GET http://127.0.0.1:3777/raw/:spuId` (заголовок `x-api-token`) → `DewuApiRawProductResponse` → `DewuProductMapperService` → `DewuResolvedProduct`.
- Сервис на `127.0.0.1:3777` — это **отдельный проект dewu-api** (репо `C:\dewu-api`, на сервере `/root/dewu-portal`, systemd `lh-dewu-engine`), парсит `distribute.poizon.com`. Правки движка делать в той сессии, здесь — только клиент/маппер.
- Цена по размеру = GLOBAL-цена + ¥2 (`priceYuan = minBidPrice/100 + 2`). Платный `dajisaas.com` заменён движком (env `DEWU_API_*` больше не используются; движок настраивается `DEWU_ENGINE_URL`/`DEWU_ENGINE_TOKEN`).
- Движок недоступен/сессия истекла → api отдаёт `ServiceUnavailable` → фронт переходит в ручной ввод товара.

## Соглашения / осторожно
- Держись стиля существующего кода. Секреты — в `apps/*/.env`; не коммить и не печатать их.
- **Не** используй широкие kill-паттерны вроде `pkill -f 'node server.js'` на сервере — под них попадает и сервис `lh-workbot`. Управляй через pm2 по имени.
- Атрибуция коммитов: в конце сообщения `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
