#!/usr/bin/env bash
# Applies a SQL file to the production database (DATABASE_URL from apps/api/.env).
# Usage (on the server): bash scripts/apply-sql.sh path/to/migration.sql
set -euo pipefail

cd "$(dirname "$0")/.."
SQL_FILE="${1:?usage: bash scripts/apply-sql.sh path/to/file.sql}"

DB_URL="$(grep -E '^DATABASE_URL=' apps/api/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
if [ -z "$DB_URL" ]; then
  echo "DATABASE_URL not found in apps/api/.env" >&2
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "OK: applied $SQL_FILE"
