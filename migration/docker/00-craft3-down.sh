#!/usr/bin/env bash
# Tear down the legacy Craft 3 export stack. Pass --keep-db to retain the
# restored database volume for a faster next run.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f $HERE/docker-compose.craft3.yml"
if [ "${1:-}" = "--keep-db" ]; then
  echo "==> Stopping containers (keeping volumes)"
  $COMPOSE down
else
  echo "==> Stopping containers and removing volumes"
  $COMPOSE down -v
fi
