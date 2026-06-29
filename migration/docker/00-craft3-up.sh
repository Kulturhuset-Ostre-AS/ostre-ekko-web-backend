#!/usr/bin/env bash
# Stand up the legacy Craft 3 app and restore its DB dump so we can export
# content over GraphQL. Idempotent: safe to re-run.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${CRAFT3_SRC:-/Users/sindresorensen/Downloads/api.ekko.no/cms}"
DUMP="${CRAFT3_DUMP:-$SRC/ekko-20260422.sql.gz}"
COMPOSE="docker compose -f $HERE/docker-compose.craft3.yml"

[ -d "$SRC" ]  || { echo "Craft 3 source not found: $SRC"  >&2; exit 1; }
[ -f "$DUMP" ] || { echo "DB dump not found: $DUMP"        >&2; exit 1; }

# Pull SECURITY_KEY / APP_ID from the original .env so Craft boots without
# re-keying. Exported for docker compose interpolation.
if [ -f "$SRC/.env" ]; then
  export CRAFT3_SECURITY_KEY="$(grep -E '^SECURITY_KEY=' "$SRC/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  export CRAFT3_APP_ID="$(grep -E '^APP_ID=' "$SRC/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
export CRAFT3_SRC="$SRC"

echo "==> Starting DB + Craft 3 containers"
$COMPOSE up -d

echo "==> Waiting for MariaDB to be healthy"
until [ "$($COMPOSE ps -q db | xargs docker inspect -f '{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ]; do
  sleep 2; printf '.'
done
echo

# Only restore if the schema isn't already present (idempotent).
HAS_TABLES="$($COMPOSE exec -T db sh -c 'mariadb -uroot -proot ekko -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"ekko\";" 2>/dev/null' || echo 0)"
if [ "${HAS_TABLES:-0}" -gt 5 ]; then
  echo "==> DB already restored ($HAS_TABLES tables); skipping import"
else
  echo "==> Restoring dump ($DUMP) — this takes a minute"
  gunzip -c "$DUMP" | $COMPOSE exec -T db sh -c 'mariadb -uroot -proot ekko'
  echo "==> Restore complete"
fi

# Widen the public GraphQL schema to grant read on EVERY section/entrytype/asset
# volume/category group, so the exporter can reach all content regardless of the
# scopes baked into the dump. (Throwaway instance — safe.)
echo "==> Granting full read scope to the Public GraphQL schema"
$COMPOSE exec -T db sh -c 'mariadb -uroot -proot ekko' <<'SQL' || true
SET @scopes = (
  SELECT CONCAT('[',
    GROUP_CONCAT(CONCAT('"', t, ':read"') SEPARATOR ','),
  ']')
  FROM (
    SELECT CONCAT('sections.', uid) t FROM craft_sections
    UNION ALL SELECT CONCAT('entrytypes.', uid) FROM craft_entrytypes
    UNION ALL SELECT CONCAT('volumes.', uid) FROM craft_volumes
    UNION ALL SELECT CONCAT('categorygroups.', uid) FROM craft_categorygroups
    UNION ALL SELECT CONCAT('taggroups.', uid) FROM craft_taggroups
    UNION ALL SELECT CONCAT('globalsets.', uid) FROM craft_globalsets
  ) s
);
UPDATE craft_gqlschemas SET scope = @scopes WHERE name = 'Public Schema';
SQL

echo
echo "==> Craft 3 GraphQL is up:  http://localhost:8390/api"
echo "    Test:  curl -s http://localhost:8390/api -H 'Content-Type: application/json' \\"
echo "             -d '{\"query\":\"{ entryCount }\"}'"
