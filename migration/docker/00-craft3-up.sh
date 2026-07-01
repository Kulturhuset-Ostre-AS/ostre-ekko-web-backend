#!/usr/bin/env bash
# Stand up the legacy Craft 3 app + restore its DB dump so the SQL export scripts can
# read the content directly from MariaDB (via `docker compose exec`). Idempotent.
#
# The SQL migration path (sql-export.mjs etc.) does NOT use Craft's GraphQL — it reads
# the tables directly — so we only need: containers up, DB restored, storage writable
# (Craft still boots to serve asset files at /uploads for sql-transfer-assets.mjs).
#
# Env overrides:
#   CRAFT3_SRC   path to the Craft 3 `cms` dir (default: ~/Downloads/api.ekko.no/cms)
#   CRAFT3_WEB   path to the web root (public_html)  (default: sibling of CRAFT3_SRC)
#   CRAFT3_DUMP  path to the .sql.gz dump (default: newest *.sql.gz in CRAFT3_SRC)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${CRAFT3_SRC:-/Users/sindresorensen/Downloads/api.ekko.no/cms}"
WEB="${CRAFT3_WEB:-$(cd "$SRC/.." && pwd)/public_html}"
# Default to the newest dump in the source dir so a fresh dump is picked up automatically.
DUMP="${CRAFT3_DUMP:-$(ls -t "$SRC"/*.sql.gz 2>/dev/null | head -1)}"
COMPOSE="docker compose -f $HERE/docker-compose.craft3.yml"

[ -d "$SRC" ]  || { echo "Craft 3 source not found: $SRC"  >&2; exit 1; }
[ -d "$WEB" ]  || { echo "Craft 3 web root not found: $WEB (expected sibling public_html)" >&2; exit 1; }
[ -n "${DUMP:-}" ] && [ -f "$DUMP" ] || { echo "DB dump not found in $SRC (*.sql.gz)" >&2; exit 1; }
echo "==> Using dump: $DUMP"

# Reuse the original SECURITY_KEY / APP_ID so Craft boots without re-keying
# (cookieValidationKey is derived from SECURITY_KEY).
if [ -f "$SRC/.env" ]; then
  export CRAFT3_SECURITY_KEY="$(grep -E '^SECURITY_KEY=' "$SRC/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  export CRAFT3_APP_ID="$(grep -E '^APP_ID=' "$SRC/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
export CRAFT3_SRC="$SRC" CRAFT3_WEB="$WEB"

echo "==> Starting DB + Craft 3 containers"
$COMPOSE up -d

echo "==> Waiting for MariaDB to be healthy"
until [ "$($COMPOSE ps -q db | xargs docker inspect -f '{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ]; do
  sleep 2; printf '.'
done
echo

# Restore only if not already present (idempotent).
HAS_TABLES="$($COMPOSE exec -T db sh -c 'mariadb -uroot -proot ekko -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"ekko\";" 2>/dev/null' || echo 0)"
if [ "${HAS_TABLES:-0}" -gt 5 ]; then
  echo "==> DB already restored ($HAS_TABLES tables); skipping import"
else
  echo "==> Restoring dump — this takes a minute"
  gunzip -c "$DUMP" | $COMPOSE exec -T db sh -c 'mariadb -uroot -proot ekko'
  echo "==> Restore complete"
fi

# Craft needs a writable storage dir to boot (serves asset files at /uploads).
echo "==> Ensuring Craft storage is writable"
$COMPOSE exec -T -u root craft sh -c 'mkdir -p /app/cms/storage/runtime /app/cms/storage/logs && chmod -R 0777 /app/cms/storage' || true

# Sanity: report real content counts so a bad/empty dump is caught immediately.
echo "==> Content in the restored DB:"
$COMPOSE exec -T db sh -c 'mariadb -uroot -proot ekko -N -e "
  SELECT CONCAT(\"   entries: \", COUNT(*)) FROM craft_entries;
  SELECT CONCAT(\"   assets:  \", COUNT(*)) FROM craft_assets;"' 2>/dev/null || true

echo
echo "==> Craft 3 is up."
echo "    Asset files serve at: http://localhost:8390/uploads/...  (used by sql-transfer-assets.mjs)"
echo "    SQL export reads the DB via: docker compose -f docker-compose.craft3.yml exec db mariadb ..."
echo "    Next:  node ../scripts/sql-export.mjs"
