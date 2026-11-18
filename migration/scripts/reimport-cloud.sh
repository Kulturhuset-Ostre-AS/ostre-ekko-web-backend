#!/usr/bin/env bash
# Full reset + re-import of Craft content into the CLOUD Payload (ekko-payload).
# Built for the cutover; also used to refresh the beta. Run it in a terminal —
# it needs a fresh `gcloud auth login admin@ekko.no` (session control expires it
# after a few hours) and asks you to type RESET before emptying tables. No Payload
# password: it authenticates with the import service user's API key from Secret
# Manager.
#
#   bash scripts/reimport-cloud.sh [--dump]
#
#   --dump   take a fresh mysqldump from Craft prod (ssh api.ekko.no), restore it
#            into the local craft3 db and re-export data/sql. Without it the
#            existing data/sql export is imported.
#
# Steps: preflight → (dump + export) → snapshot Payload-only fields → Cloud SQL
# backup → confirm → reset content tables (cloud-sql-proxy) → new assets →
# passes 1-3 + globals → restore Payload-only fields → verify.
#
# Everything that needs gcloud runs before the long import, so an expiring
# gcloud session can't break the run halfway. The import itself only uses the
# Payload REST API. Log: data/sql/reimport-cloud-<timestamp>.log
#
# Rollback: restore the backup this script prints (gcloud sql backups restore
# <id> --restore-instance=ekko-payload-pg --project=ekko-payload).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/.."

PROJECT=ekko-payload
INSTANCE=ekko-payload-pg
CONNECTION="$PROJECT:europe-north1:$INSTANCE"
GCLOUD_ACCOUNT="${GCLOUD_ACCOUNT:-admin@ekko.no}"
export PAYLOAD_URL="${PAYLOAD_URL:-https://payload-api.ekko.no/api}"
export CRAFT_WEB="${CRAFT_WEB:-https://api.ekko.no}"
CRAFT_SSH="${CRAFT_SSH:-api.ekko.no}"
PROXY_PORT="${PROXY_PORT:-5434}"
TS="$(date +%Y%m%d-%H%M)"
LOG="data/sql/reimport-cloud-$TS.log"

DUMP=0
for a in "$@"; do
  case "$a" in
    --dump) DUMP=1 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

step() { echo; echo "==================== $* ===================="; }
die() { echo "✗ $*" >&2; exit 1; }
gc() { gcloud --account="$GCLOUD_ACCOUNT" --project="$PROJECT" "$@"; }

# ---------------------------------------------------------------- preflight
step "preflight"
for t in gcloud cloud-sql-proxy docker node curl; do command -v "$t" >/dev/null || die "$t not found"; done
docker info >/dev/null 2>&1 || die "docker is not running"
gc auth print-access-token >/dev/null 2>&1 \
  || die "gcloud session for $GCLOUD_ACCOUNT expired — run: gcloud auth revoke $GCLOUD_ACCOUNT; gcloud auth login $GCLOUD_ACCOUNT"
echo "✓ gcloud ($GCLOUD_ACCOUNT)"

# No passwords: the import runs as the service user import@ekko.no, whose API key
# lives in Secret Manager (reachable through the gcloud login above).
PAYLOAD_API_KEY="$(gc secrets versions access latest --secret=ekko-payload-import-api-key 2>/dev/null)" \
  || die "could not read secret ekko-payload-import-api-key (see deploy/payload/README.md, «Import service user»)"
export PAYLOAD_API_KEY
ME=$(node -e '
  fetch(process.env.PAYLOAD_URL + "/users/me", { headers: { Authorization: "users API-Key " + process.env.PAYLOAD_API_KEY } })
    .then((r) => r.json()).then((j) => { if (!j.user) process.exit(1); console.log(j.user.email) }).catch(() => process.exit(1))') \
  || die "the import API key was rejected at $PAYLOAD_URL"
echo "✓ Payload API key ($ME @ $PAYLOAD_URL)"

# From here on everything is logged (the key above is not).
exec > >(tee -a "$LOG") 2>&1
echo "log: $LOG"

# asset-map.json must describe THIS Payload's media, or upload fields point at wrong files.
MEDIA_TOTAL=$(curl -s "$PAYLOAD_URL/media?limit=1&depth=0" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).totalDocs ?? -1))')
MAP_TOTAL=$(node -e 'const m=require("./data/sql/asset-map.json");console.log(Object.keys(m).length)')
echo "media in Payload: $MEDIA_TOTAL, asset-map entries: $MAP_TOTAL"
[ "$MEDIA_TOTAL" -ge "$MAP_TOTAL" ] || die "asset-map has more entries than Payload has media — wrong asset-map for this Payload?"

# ------------------------------------------------------------ dump + export
if [ "$DUMP" = 1 ]; then
  step "dump Craft prod -> local craft3 db -> data/sql"
  DUMPFILE="data/craft-dumps/ekko-$TS.sql.gz"
  mkdir -p data/craft-dumps
  # The DB password stays on the server: a 0600 defaults file in ~/tmp, removed on exit.
  ssh -o BatchMode=yes "$CRAFT_SSH" 'bash -s' > "$DUMPFILE" <<'EOF'
set -euo pipefail
cd ~/api.ekko.no/cms
get() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }
CNF=$(mktemp ~/tmp/.mycnf.XXXXXX); chmod 600 "$CNF"; trap 'rm -f "$CNF"' EXIT
H=$(get DB_SERVER); [ "$H" = localhost ] && H=127.0.0.1
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' "$H" "$(get DB_PORT)" "$(get DB_USER)" "$(get DB_PASSWORD)" > "$CNF"
mysqldump --defaults-extra-file="$CNF" --no-tablespaces --single-transaction --quick --routines --triggers --default-character-set=utf8mb4 "$(get DB_DATABASE)" | gzip -9
EOF
  gzip -t "$DUMPFILE" && gzcat "$DUMPFILE" | tail -1 | grep -q 'Dump completed' || die "dump $DUMPFILE is incomplete"
  echo "✓ $DUMPFILE ($(du -h "$DUMPFILE" | cut -f1))"

  COMPOSE=(docker compose -f docker/docker-compose.craft3.yml)
  "${COMPOSE[@]}" up -d db
  for _ in $(seq 1 30); do "${COMPOSE[@]}" exec -T db healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1 && break; sleep 2; done
  "${COMPOSE[@]}" exec -T db mariadb -uroot -proot -e 'DROP DATABASE IF EXISTS ekko; CREATE DATABASE ekko CHARACTER SET utf8mb4;'
  gzcat "$DUMPFILE" | "${COMPOSE[@]}" exec -T db mariadb -uroot -proot ekko
  echo "✓ restored into craft3 db"

  cp -a data/sql "data/sql-backup-$TS"
  node scripts/sql-export.mjs | tee "data/sql/export-$TS.log"
  DROPPED=$(grep -c 'dropped unparseable' "data/sql/export-$TS.log" || true)
  [ "$DROPPED" = 0 ] || die "export dropped $DROPPED row(s) — see data/sql/export-$TS.log"
  echo "✓ export (previous export kept in data/sql-backup-$TS)"
fi

# ------------------------------------------------- snapshot Payload-only data
step "snapshot Payload-only fields"
node scripts/payload-only-fields.mjs snapshot

# ---------------------------------------------------------- backup + confirm
step "Cloud SQL backup"
gc sql backups create --instance="$INSTANCE" --description="reimport-cloud $TS"
BACKUP_ID=$(gc sql backups list --instance="$INSTANCE" --filter="description='reimport-cloud $TS'" --format='value(id)' --limit=1 2>/dev/null || true)
# Fallback: newest on-demand backup (the list is newest-first).
[ -n "$BACKUP_ID" ] || BACKUP_ID=$(gc sql backups list --instance="$INSTANCE" --filter="type=ON_DEMAND" --format='value(id)' --limit=1)
[ -n "$BACKUP_ID" ] || die "backup not found"
echo "✓ backup $BACKUP_ID — rollback: gcloud sql backups restore $BACKUP_ID --restore-instance=$INSTANCE --project=$PROJECT"

echo
echo "About to EMPTY the content tables in the CLOUD Payload ($CONNECTION):"
echo "  events, news, arena, artists, performance, locations, organizers"
echo "  + cascades: orders, orders_items, tickets, globals' relation tables"
echo "Media, users, members and customers are kept."
read -r -p "Type RESET to continue: " CONFIRM
[ "$CONFIRM" = RESET ] || die "aborted (nothing changed besides the backup)"

# -------------------------------------------------------------------- reset
step "reset content tables (cloud)"
cloud-sql-proxy --gcloud-auth --address 0.0.0.0 --port "$PROXY_PORT" "$CONNECTION" > "data/sql/proxy-$TS.log" 2>&1 &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do grep -q 'ready for new connections' "data/sql/proxy-$TS.log" && break; sleep 1; done
grep -q 'ready for new connections' "data/sql/proxy-$TS.log" || die "cloud-sql-proxy did not start (see data/sql/proxy-$TS.log)"
PGPASSWORD="$(gc secrets versions access latest --secret=ekko-payload-db-password)" \
PGHOST=host.docker.internal PGPORT="$PROXY_PORT" PGUSER=payload PGDATABASE=payload \
  node scripts/sql-reset.mjs --cloud
kill $PROXY_PID 2>/dev/null || true
trap - EXIT

# ------------------------------------------------------------------- import
step "transfer new assets (from $CRAFT_WEB)"
node scripts/sql-transfer-assets.mjs
step "pass 1 (create docs)";        node scripts/sql-import.mjs
step "pass 2 (relations + matrix)"; node scripts/sql-import-relations.mjs
step "pass 3 (drafts)";             node scripts/sql-import-drafts.mjs
step "globals";                     node scripts/sql-import-globals.mjs

step "restore Payload-only fields"
node scripts/payload-only-fields.mjs restore

step "verify"
if node scripts/sql-verify.mjs; then
  echo; echo "✔ re-import complete — verification passed"
else
  echo; echo "⚠ re-import complete, but verification flagged something — read the verify output above."
  echo "  (Known flag: the mixtape m4a is >32MB and can't be served through Cloud Run.)"
fi
echo "backup before reset: $BACKUP_ID   log: $LOG"
