#!/usr/bin/env bash
# Sets one secret in apps/api/.env without it ending up in shell history or
# on screen (hidden prompt), then restarts the api.
#   ssh -t root@<server> bash /opt/app/scripts/set-env-secret.sh CRYPTOBOT_API_TOKEN
set -euo pipefail

KEY="${1:-}"
ENV_FILE=/opt/app/apps/api/.env

case "$KEY" in
  CRYPTOBOT_API_TOKEN | XROCKET_API_TOKEN | BYBIT_WITHDRAW_API_KEY | BYBIT_WITHDRAW_API_SECRET) ;;
  *)
    echo "Usage: $0 CRYPTOBOT_API_TOKEN|XROCKET_API_TOKEN|BYBIT_WITHDRAW_API_KEY|BYBIT_WITHDRAW_API_SECRET" >&2
    exit 1
    ;;
esac

read -rsp "Вставьте значение для $KEY и нажмите Enter: " VALUE
echo
VALUE="$(printf '%s' "$VALUE" | tr -d '[:space:]')"
if [ -z "$VALUE" ]; then
  echo "Пусто — ничего не изменено." >&2
  exit 1
fi
if ! printf '%s' "$VALUE" | grep -Eq '^[A-Za-z0-9:_.-]+$'; then
  echo "Значение содержит неожиданные символы — ничего не изменено." >&2
  exit 1
fi

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
if grep -q "^${KEY}=" "$ENV_FILE"; then
  sed -i "s|^${KEY}=.*|${KEY}=${VALUE}|" "$ENV_FILE"
else
  printf '%s=%s\n' "$KEY" "$VALUE" >>"$ENV_FILE"
fi

pm2 restart api >/dev/null
echo "OK: $KEY сохранён, api перезапущен."
