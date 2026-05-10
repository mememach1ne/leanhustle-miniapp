# Manual QA Checklist

Use this checklist after local setup is complete and all three services are running.

## User flow

- Open the Telegram Mini App from Telegram.
- Confirm the user is authenticated and the profile is loaded from the backend.
- Press `Обновить статус подписки` and confirm the profile updates without crashing.
- Paste a valid Dewu or `dw4.co` link into `Калькулятор`.
- Confirm the product is resolved and the card is rendered.
- Select an available SKU and confirm pricing appears.
- Add the product to the cart and confirm success feedback is shown.
- Open `Корзина` and confirm the item snapshot is present.
- Increase quantity with `+`, then decrease with `-`, and confirm totals update correctly.
- Complete checkout and confirm the cart is emptied.
- Open `Мои заказы` and confirm the new order appears in the list.
- Open order details and confirm items, totals, status, and track code section render correctly.

## Manager flow

- Confirm the manager receives a new order notification in Telegram.
- Run `/new_orders` and confirm the new order appears with `Открыть заказ`.
- Run `/active_orders` after status changes and confirm the order moves into the active list.
- Run `/find_order LP001` with a real order number and confirm the order card opens.
- Use `Отправлены реквизиты` and confirm the order moves to `Ожидание оплаты`.
- Use `Товар оплачен` and confirm the order moves to `Оплачен, ожидается выкуп`.
- If the user is a channel subscriber on the first paid order, confirm the subscriber benefit is applied once.
- Use `Выкуплен` and confirm the order moves to `Выкуплен`.
- Use `Ввести трек-код`, submit a track code, and confirm the order moves to `Трек-код получен`.
- Confirm the user can see the updated status and track code in the Mini App.

## Admin flow

- Run `/settings` and confirm current rates, commission, and delivery settings are shown.
- Run `/set_rate` and change one exchange rate as admin.
- Run `/set_commission` and update commission percent as admin.
- Run `/set_delivery` and update delivery price per kg as admin.
- Run `/settings_audit` and confirm the recent settings changes are listed with actor and timestamps.
- Repeat one update as a `manager` account and confirm the API rejects the change with forbidden access.

## Sanity checks

- `GET /api/health` returns `app: ok` and `db: ok`.
- Prisma Studio can connect to the database.
- Bot can read staff-only endpoints through internal API auth headers.
- Checkout does not re-price Dewu data during order creation.
- Re-adding the same SKU to the cart increases `quantity` instead of creating duplicates.
