#!/usr/bin/env python
"""
Read-only snapshot of the RAKETA cabinet (my.raketacn.ru) for planning the
order-registration automation.

What it does:
  1. Opens my.raketacn.ru/login in a real browser window.
  2. YOU log in by hand (the script never sees the password).
  3. It then only READS: GET requests to the cabinet API (declarants,
     addresses, recipients, sample orders, dictionaries) and screenshots of
     the create-order / consolidation forms (nothing is submitted).
  4. Saves everything to the scratch folder below. Passport data, phones,
     e-mails and tokens are masked before writing.

Run:
  py -3.14 "C:\\lh miniapp\\scripts\\raketa_inspect.py"
"""
import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ORIGIN = "https://my.raketacn.ru"
OUT_DIR = Path(r"C:\Users\sergey\AppData\Local\Temp\claude\C--lh-miniapp\07ea33c6-9d0f-4db3-985b-944d649c3acd\scratchpad\raketa_snapshot")

# GET-only endpoints (relative to /api).
ENDPOINTS = [
    "/auth/me/",
    "/user_data",
    "/declarants?page=1",
    "/customer_recipients?page=1",
    "/customer_addresses",
    "/customer_addresses_full",
    "/customer_orders?page=1",
    "/consolidations?page=1",
    "/uncreated_orders",
    "/tk_list",
    "/get_additional_service_list",
    "/get_order_marketplace_list",
    "/order_stage_list",
    "/consolidation_stage_list",
    "/sellers",
    "/billing_history?page=1",
    "/get_possible_consolidation_add_orders",
]

# Pages to screenshot (only opened, never submitted).
PAGES = ["/delivery/create", "/consolidation/create", "/addresses", "/delivery", "/consolidation"]

SENSITIVE = re.compile(
    r"passport|inn$|snils|birth|series|issue|document_number|phone|email|token|password|secret|card|carrot_hash",
    re.I,
)


def mask(value):
    s = str(value)
    return "***" if len(s) <= 4 else s[:2] + "***" + s[-2:]


def redact(obj):
    if isinstance(obj, dict):
        return {k: (mask(v) if (SENSITIVE.search(k) and v not in (None, "", [], {})) and not isinstance(v, (dict, list)) else redact(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v) for v in obj]
    return obj


def api_get(page, token, path):
    return page.evaluate(
        """async ([path, token]) => {
            const r = await fetch('/api' + path, { headers: {
                Authorization: 'Bearer ' + token, Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest' } });
            let body = null; try { body = await r.json(); } catch (e) { body = '(not json)'; }
            return { status: r.status, body };
        }""",
        [path, token],
    )


def first_id(resp):
    body = (resp or {}).get("body")
    data = body.get("data") if isinstance(body, dict) else None
    items = data.get("data") if isinstance(data, dict) else data
    if isinstance(items, list) and items and isinstance(items[0], dict):
        return items[0].get("id")
    return None


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()
        page.goto(ORIGIN + "/login", wait_until="domcontentloaded")
        print("\n>>> Войди в открывшемся окне в кабинет RAKETA. Жду до 10 минут...\n")

        token = None
        for i in range(600):
            try:
                # Any open tab of this window counts (login may open a new one).
                for pg in ctx.pages:
                    token = pg.evaluate(
                        """() => localStorage.getItem('token') ||
                            Object.keys(localStorage).filter(k => /token/i.test(k))
                              .map(k => localStorage.getItem(k)).find(v => v && v.length > 20) || null"""
                    )
                    if token:
                        page = pg
                        break
            except Exception:
                token = None
            if token:
                break
            if i % 15 == 0:
                print(f"  ...жду вход ({i} c), адрес: {page.url}")
            time.sleep(1)
        if not token:
            browser.close()
            print("ОШИБКА: вход не обнаружен.")
            sys.exit(1)

        print("Вход обнаружен. Читаю данные (только чтение)...")
        time.sleep(2)
        result = {}
        for path in ENDPOINTS:
            result[path] = api_get(page, token, path)
            print(f"  GET {path} -> {result[path]['status']}")

        order_id = first_id(result.get("/customer_orders?page=1"))
        if order_id:
            for path in (f"/customer_order/{order_id}", f"/price/order/{order_id}"):
                result[path] = api_get(page, token, path)
                print(f"  GET {path} -> {result[path]['status']}")
        cons_id = first_id(result.get("/consolidations?page=1"))
        if cons_id:
            for path in (f"/consolidation/{cons_id}", f"/price/consolidation/{cons_id}"):
                result[path] = api_get(page, token, path)
                print(f"  GET {path} -> {result[path]['status']}")

        (OUT_DIR / "api.json").write_text(json.dumps(redact(result), ensure_ascii=False, indent=1), encoding="utf-8")

        for path in PAGES:
            try:
                page.goto(ORIGIN + path, wait_until="networkidle", timeout=30000)
                time.sleep(2)
                name = path.strip("/").replace("/", "_") or "home"
                page.screenshot(path=str(OUT_DIR / f"{name}.png"), full_page=True)
                print(f"  screenshot {path}")
            except Exception as e:
                print(f"  screenshot {path} failed: {e}")

        browser.close()
    print(f"\nГотово. Файлы: {OUT_DIR}\nНапиши Claude «готово».")


if __name__ == "__main__":
    main()
