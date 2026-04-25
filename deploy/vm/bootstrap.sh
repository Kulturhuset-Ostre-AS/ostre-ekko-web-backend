#!/usr/bin/env bash
# First-time or upgrade: Composer deps, optional GCS → public_html/uploads, rebuild containers.
# Run from the repository root on the VM (e.g. /opt/ostre-ekko-web-backend).
#
# Optional environment:
#   EKKO_ASSETS_BUCKET   If set, runs: gcloud storage rsync gs://$EKKO_ASSETS_BUCKET/uploads/ → public_html/uploads/
#                        (optional when public volumes use craftcms/google-cloud only; still useful for seeds/backfills)
#   HTTP_PORT            Passed to docker compose (default 8080 in compose file)
#
# Usage:
#   EKKO_ASSETS_BUCKET=ekko-assets-abc123 ./deploy/vm/bootstrap.sh
#   ./deploy/vm/bootstrap.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ -n "${EKKO_ASSETS_BUCKET:-}" ]]; then
  echo "Syncing gs://${EKKO_ASSETS_BUCKET}/uploads/ → public_html/uploads/"
  mkdir -p public_html/uploads
  gcloud storage rsync -r "gs://${EKKO_ASSETS_BUCKET}/uploads/" ./public_html/uploads/
fi

echo "composer install (no dev)…"
docker compose run --rm php composer install --no-dev --no-interaction

echo "docker compose build & up…"
docker compose build
export HTTP_PORT="${HTTP_PORT:-8080}"
docker compose up -d

echo "Done. Check: docker compose ps"
