#!/usr/bin/env bash
# Orchestrate the SQL migration (steps 1-5 of MIGRATION.md).
#
# Assumes step 0 is done: Payload + Craft 3 containers are up (docker compose ...
# payload up; docker/00-craft3-up.sh) and a Payload admin user exists (or the scripts
# auto-register SEED_EMAIL/SEED_PASSWORD, default test@ekko.no / test1234).
#
# Long-running (asset transfer + import are ~30-40 min total). Fails fast on error.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/.."

run() { echo; echo "==================== $1 ===================="; node "scripts/$2"; }

# Preflight: Payload reachable?
if ! curl -s -o /dev/null -X POST http://localhost:3000/api/graphql \
      -H 'Content-Type: application/json' -d '{"query":"{__typename}"}' --max-time 8; then
  echo "Payload not reachable at :3000 — run step 0 first (see MIGRATION.md)." >&2; exit 1
fi

run "1/5  export (Craft SQL -> JSON)"        sql-export.mjs
run "2/5  transfer assets (files -> media)"  sql-transfer-assets.mjs
run "3/5  import pass 1 (create docs)"        sql-import.mjs
run "4/5  import pass 2 (relations+matrix)"  sql-import-relations.mjs
run "5/5  verify"                             sql-verify.mjs

echo; echo "✔ migration complete. Point the frontend at Payload (see MIGRATION.md)."
