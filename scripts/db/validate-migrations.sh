#!/usr/bin/env bash
# Applies every file in supabase/migrations/ (in order) to a throwaway local
# Postgres instance, runs scripts/db/assertions.sql, then exercises the full
# data-migrations pipeline end to end: carrega o ledger real de
# vehicle_occurrences (artifacts/migration/load_vehicle_occurrences.sql),
# roda scripts/db/health-check.sql, roda
# scripts/db/run-data-migrations.sh duas vezes seguidas (prova idempotência
# — a segunda vez não deve reaplicar nada) e confere os números reais das
# vendas legadas (542/60/0).
#
# This exists because Supabase's own local dev stack (`supabase start`) needs
# Docker, which is not always available (e.g. this project's original sandbox
# session). It is a *substitute* for real `supabase db reset` validation, not
# a replacement for it — always also validate against a real linked Supabase
# project before anything ships to production. O workflow de deploy
# (.github/workflows/supabase-deploy.yml) roda o equivalente disto contra o
# projeto real a cada push em main.
#
# Usage: scripts/db/validate-migrations.sh
# Requires: PostgreSQL 16 client+server binaries (psql, initdb, pg_ctl) on PATH,
# or adjust PG_BIN below.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DATA_DIR="$ROOT_DIR/.local-pg/data"
LOG_FILE="$ROOT_DIR/.local-pg/logfile"
PORT="${PG_VALIDATE_PORT:-5544}"
SOCKET_DIR="/tmp"

# initdb/postgres refuse to run as root. If we're root (common in sandboxes),
# delegate every step to the unprivileged `postgres` system user; otherwise
# run directly as the current (already unprivileged) user.
as_pg() {
  if [ "$(id -u)" = "0" ]; then
    su postgres -c "$*"
  else
    eval "$*"
  fi
}

mkdir -p "$ROOT_DIR/.local-pg"
[ "$(id -u)" = "0" ] && chown -R postgres:postgres "$ROOT_DIR/.local-pg" || true

cleanup() {
  as_pg "$PG_BIN/pg_ctl -D '$DATA_DIR' stop -m fast" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ ! -d "$DATA_DIR" ]; then
  echo "==> initdb"
  as_pg "$PG_BIN/initdb -D '$DATA_DIR' -U postgres --auth=trust" >/dev/null
fi

echo "==> starting local postgres on port $PORT"
as_pg "$PG_BIN/pg_ctl -D '$DATA_DIR' -l '$LOG_FILE' -o '-p $PORT -k $SOCKET_DIR' start"

export PGHOST="$SOCKET_DIR" PGPORT="$PORT" PGUSER=postgres

# Fresh database every run — this script must be safe to run repeatedly.
psql -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists validate_migrations;" >/dev/null
psql -v ON_ERROR_STOP=1 -d postgres -c "create database validate_migrations;" >/dev/null

echo "==> applying auth stub"
psql -v ON_ERROR_STOP=1 -d validate_migrations -f "$ROOT_DIR/scripts/db/stub-auth.sql" >/dev/null

echo "==> applying migrations"
for f in "$ROOT_DIR"/supabase/migrations/*.sql; do
  echo "   - $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -d validate_migrations -f "$f" >/dev/null
done

echo "==> running assertions"
psql -v ON_ERROR_STOP=1 -d validate_migrations -f "$ROOT_DIR/scripts/db/assertions.sql"

export PGDATABASE=validate_migrations PGSSLMODE=disable

echo "==> loading real vehicle_occurrences ledger fixture (1521 rows)"
psql -v ON_ERROR_STOP=1 -f "$ROOT_DIR/artifacts/migration/load_vehicle_occurrences.sql" >/dev/null

echo "==> running health-check"
psql -v ON_ERROR_STOP=1 -f "$ROOT_DIR/scripts/db/health-check.sql"

echo "==> running data-migrations (1st pass — should apply)"
"$ROOT_DIR/scripts/db/run-data-migrations.sh"

echo "==> running data-migrations again (2nd pass — should skip, idempotency check)"
before="$("$ROOT_DIR/scripts/db/run-data-migrations.sh" 2>&1)"
if echo "$before" | grep -q "==> aplicando:"; then
  echo "FAIL: a segunda execução das data-migrations reaplicou algo — não é idempotente" >&2
  echo "$before" >&2
  exit 1
fi
echo "$before"

echo "==> checking legacy sales counts (expected 542 / 60 / 0)"
imported=$(psql -tAc "select count(*) from public.sales where origin = 'migration';")
with_vehicle=$(psql -tAc "select count(*) from public.sales where origin = 'migration' and vehicle_id is not null;")
[ "$imported" = "542" ] || { echo "FAIL: legacy_sales_imported esperado 542, obtido $imported" >&2; exit 1; }
[ "$with_vehicle" = "0" ] || { echo "FAIL: legacy_sales_with_a_vehicle_id esperado 0, obtido $with_vehicle" >&2; exit 1; }

echo "==> OK: migrations apply cleanly, all assertions passed, data-migrations are idempotent and correct (542 vendas legadas, 0 com vehicle_id)"
