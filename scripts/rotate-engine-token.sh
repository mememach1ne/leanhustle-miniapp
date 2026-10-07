#!/usr/bin/env bash
# Rotates the price-engine token (dewu-api `API_TOKEN` <-> api `DEWU_ENGINE_TOKEN`)
# on the server. The new token is never printed.
#   ssh root@<server> "bash /opt/app/scripts/rotate-engine-token.sh"
set -euo pipefail

API_ENV=/opt/app/apps/api/.env
ENGINE_ENV=/root/dewu-portal/.env
DROPIN_DIR=/etc/systemd/system/lh-dewu-engine.service.d
NEW=$(openssl rand -hex 32)

set_var() {
  local file=$1 key=$2
  touch "$file"
  chmod 600 "$file"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${NEW}|" "$file"
  else
    printf '%s=%s\n' "$key" "$NEW" >>"$file"
  fi
}

# Engine side: .env plus a systemd drop-in (wins over any Environment= in the unit).
set_var "$ENGINE_ENV" API_TOKEN
mkdir -p "$DROPIN_DIR"
printf '[Service]\nEnvironment=API_TOKEN=%s\n' "$NEW" >"$DROPIN_DIR/token.conf"
chmod 600 "$DROPIN_DIR/token.conf"
systemctl daemon-reload
systemctl restart lh-dewu-engine

# Our api side.
set_var "$API_ENV" DEWU_ENGINE_TOKEN
pm2 restart api >/dev/null

sleep 8
code_new=$(curl -s -o /dev/null -w '%{http_code}' -H "x-api-token: ${NEW}" http://127.0.0.1:3777/search || true)
code_none=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3777/search || true)
api_health=$(curl -s -m 10 http://127.0.0.1:3002/api/health || true)

echo "engine with new token: HTTP ${code_new} (expected 400)"
echo "engine without token:  HTTP ${code_none} (expected 401)"
echo "api health: ${api_health}"
if [ "$code_new" = "400" ] && [ "$code_none" = "401" ]; then
  echo "OK: token rotated"
else
  echo "CHECK FAILED"
  exit 1
fi
