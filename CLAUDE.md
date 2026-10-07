# LeanHustle Miniapp

Telegram Mini App **и** браузерное веб-приложение для реселл-бизнеса (товары Poizon/Dewu, Китай→Россия) + Telegram-бот @lh_poizonbot. pnpm/tsx-монорепо. Отдельный сервис цен живёт в проекте **dewu-api** (см. «Движок цен»). Доставка Китай→РФ — через форвардера **RAKETA** (my.raketacn.ru), см. «RAKETA».

## Структура
- `apps/web` — Next.js 15, фронт (UI Telegram Mini App и браузерной версии)
- `apps/api` — NestJS-бэкенд (products, catalog, cart, orders, pricing, crypto-payments, delivery-addresses, raketa, loyalty, admin, auth)
- `apps/bot` — Telegram-бот (клиентское меню + панель менеджера)
- `packages/shared` — общие TS-интерфейсы/enum'ы (api и bot берут **собранный `dist`**, web — исходники)

Git: `github.com/mememach1ne/leanhustle-miniapp`, ветка `master`. Коммить и пушить в master без вопросов (см. память).

## Домены / поверхности (всё — один и тот же код)
- **Telegram Mini App** → `apps/web` (бот: кнопка «Открыть MiniApp» → `https://leanhustle.ru`).
- **Браузерная версия:** `https://china.leanhustle.net` (+ `leanhustle.ru`, `www.leanhustle.ru`), за Cloudflare. nginx-сайт `leanhustle`: фронт → `127.0.0.1:3000`, **`/backend-api/` → `127.0.0.1:3002/api/`** (proxy_read_timeout 60s — держи долгие запросы < 60 с).
- Не относится к проекту: `leanhustle.net` — статический сайт владельца (`/var/www/leanhustle.net`); `work.leanhustle.net` — `lh-workbot`.

## Сервер и деплой
- Хост **`91.236.186.168`** (Ubuntu 24.04). SSH-ключ `~/.ssh/lh_workbot_deploy` (root ко всему серверу). Код в **`/opt/app`**, pm2 (через tsx, без сборки api/bot):
  - `web` → `next start -p 3000`; `api` → `tsx apps/api/src/main.ts` (порт **3002**); `bot` → `tsx apps/bot/src/main.ts`
- **БД: локальный PostgreSQL 16 на сервере** (не Neon). Таблицы `_prisma_migrations` нет → `scripts/deploy.sh` (шаг migrate) ломается, деплой делаем вручную.
- **Порядок выкатки** (с локальной машины по ssh):
  1. `git push`, затем на сервере `cd /opt/app && git pull -q`.
  2. Если менялась схема — **сначала** миграция (до рестарта, иначе Prisma падает на новых колонках):
     `bash scripts/apply-sql.sh apps/api/prisma/migrations/<ts>_<name>/migration.sql`, затем `cd apps/api && npx prisma generate`. Миграции пишем руками, аддитивно (`ADD COLUMN IF NOT EXISTS`).
  3. Если менялся `packages/shared` — пересобрать dist: блок `SKIP_SHARED` из `scripts/deploy.sh` (`bash -c "$(sed -n '/if \[ "$SKIP_SHARED" = false \]; then/,/^fi$/p' scripts/deploy.sh)"`).
  4. Если менялся web — `pnpm --filter @lean-poizon/web build` (иногда падает на `next/font` из-за сети — просто повторить; между неудачной и удачной сборкой сайт отдаёт 502).
  5. `pm2 restart api bot web` (только нужные). Проверка: `https://china.leanhustle.net/backend-api/health`.
- Redis не запущен — кэши работают вхолостую, не падают. HTML отдаётся с `no-store` (`export const dynamic = 'force-dynamic'` в layout).
- Секреты в `apps/*/.env` (не коммитить, не печатать). Правки `.env` с паролями делает владелец.

## Ключевые подсистемы
- **Авторизация:** Mini App — Telegram `initData`. Сайт — вход через бота: `POST /auth/bot-login/start` → ссылка `t.me/lh_poizonbot?start=login_<code>` → бот (подписка на @lh_poizon + кнопка «Да, это я») → `/auth/bot-login/confirm` (internal token) → сайт поллит статус. Код в `auth/services/bot-login.service.ts`.
- **Цены:** `pricing.service.ts`. Комиссия из настроек минус скидка лояльности (или ручная `commissionOverride`). **Доставка — таблица «категория × размер»** `pricing/data/delivery-price-table(.data).ts` (цены из калькулятора RAKETA до Москвы); неизвестные категории молча пишутся в `delivery_category_weights` (уведомлений нет). Дозаполнение — по памяти `delivery-price-table`, скрипт `src/scripts/unfilled-delivery-categories.ts`.
- **Оплата:** USDT через Bybit V5 (`crypto-payments`), матчинг по уникальной сумме; ETA зачисления по сетям — `PAYMENT_NETWORK_ETA` в shared.
- **Адреса доставки:** клиент выбирает **город → пункт СДЭК** из справочника RAKETA (`GET /delivery-points/cities|cdek`, компонент `web/components/ui/pickup-point-picker.tsx`). Поля `city_id/city/region/pvz_code/pvz_index` у адреса и `delivery_*` у заказа. Старые текстовые адреса помечены «выберите пункт из списка».
- **Страховка RAKETA** («Защита от рисков», 1% от товаров в ₽, платится с доставкой): галочка в корзине и при ручном заказе → `orders.insurance/insurance_rub`, уходит в RAKETA (`insurance: true`).
- **Уведомления клиенту** по статусам: `orders/services/order-notifications.service.ts` (HTML, без эмодзи, кнопки «Открыть заказ/Оплатить», «Менеджер», «Отследить в СДЭК»).

## RAKETA (форвардер) — автоматизация
- Клиент API кабинета: `apps/api/src/modules/raketa/raketa-client.service.ts` (вход `RAKETA_EMAIL/RAKETA_PASSWORD` из `apps/api/.env`, Bearer в памяти, повторный вход на 401). Неофициальный API — эндпоинты взяты из бандла кабинета; официальный только по договорённости.
- Логика: `apps/api/src/modules/orders/services/raketa-fulfillment.service.ts`:
  1. Китайский трек на вещь (бот «Китайский трек → RAKETA» / админка) → заказ в RAKETA (название без латиницы `raketa/raketa-title.ts`, китайское описание = engine `titleRaw`, продавец Poizon id 5, декларант — владелец). Можно прислать **RA-номер** — привяжет существующий. Дубли по треку не создаются.
  2. Когда все вещи зарегистрированы и у заказа есть ПВЗ → получатель + адрес СДЭК (переиспользуются существующие) → 1 вещь: на заказ (PUT), несколько: **объединение** (`raketa_title` или «LP042 Иванов N шт»).
  3. `orders.fulfillment_manual` — «оформить вручную», автоматика не трогает.
- Админка: `/admin/orders/new` — единая страница создания: клиент по @username (или без клиента: только RAKETA / «оплатит по ссылке»), все размеры, цена от движка или вручную, комиссия %, страховка, «уже оплачен», треки. Ссылка-приглашение `t.me/lh_poizonbot?start=pay_<token>` (`orders.claim_token`, `orders.user_id` nullable) → бот → `POST /orders-claim` (internal token) привязывает заказ.
- Справочные ID: CDEK tk `78cbeab6-821e-48c8-9c2e-028a1ea99805`, тариф `STND`, Москва `0c5b2444-70a0-4932-980c-b4dc0d3f02b5`. Публичный калькулятор: `https://calculator.my.raketacn.ru/api/tk_calculate/{tk}?city_id=…&length&width&height&weight` (цены в копейках).

## Движок цен (шов с проектом dewu-api)
Резолв товара: `apps/api` products → `DewuApiClientService.queryProductDetail(dwSpuId)` → `GET http://127.0.0.1:3777/raw/:spuId` (`x-api-token`) → `DewuProductMapperService` → `DewuResolvedProduct` (в т.ч. `titleCn` = китайское название).
- Сервис на `127.0.0.1:3777` — **отдельный проект dewu-api** (`C:\dewu-api`, на сервере `/root/dewu-portal`, systemd `lh-dewu-engine`). Правки движка — в той сессии; сессия портала обновляется `py -3.14 C:\dewu-api\refresh_session.py`.
- Цена по размеру = GLOBAL-цена + ¥2. Движок недоступен → api `ServiceUnavailable` → фронт предлагает ручной ввод / «сервер не отвечает».

## Бот
- Клиентское меню и тексты: `apps/bot/src/services/order-admin.service.ts` + `commands/start.command.ts`. Кнопки с премиум-эмодзи (`icon_custom_emoji_id`) и цветом (`style: primary|success|danger`, Bot API 9.4). Новые премиум-эмодзи — см. память `bot-premium-emoji-capture`. Эмодзи в уведомлениях клиентам не использовать.
- Deep links: `login_<code>` (вход на сайт), `pay_<token>` (привязка заказа).

## Открытые задачи
- Оплата доставки клиентом через пополнение баланса RAKETA (`POST /billing {amount}` → `returnUrl`) и авто-оплата объединения (`/pay/{id}/consolidation`) — не сделано.
- Доставка считается по Москве; для регионов СДЭК дороже — нет надбавки/расчёта по городу.
- Впервые проверить вживую: создание объединения/получателя/адреса и флаг страховки в RAKETA — ошибки RAKETA видны в карточке заказа (`raketa_last_error`).
- Бот («Другие маркетплейсы») ещё пишет «Рыбка», на сайте/в аппе — Goofish.

## Соглашения / осторожно
- Держись стиля существующего кода. Секреты — в `apps/*/.env`; не коммить и не печатать их.
- **Не** используй широкие kill-паттерны вроде `pkill -f 'node server.js'` на сервере — под них попадает и `lh-workbot`. Управляй через pm2 по имени.
- Атрибуция коммитов: в конце сообщения `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
