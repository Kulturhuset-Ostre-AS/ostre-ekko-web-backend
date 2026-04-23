#!/usr/bin/env bash
# Sync repo to VM, write cms/.env from Secret Manager, composer install, docker compose up.
#
#   export TF_STATE_BUCKET=ostre-ekko-web-backend-tfstate GCP_PROJECT_ID=ostre-ekko-web-backend
#   ./scripts/vm-bootstrap.sh [--primary-url http://IP:8080/]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/lib/gcp.sh"

PRIMARY_URL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --primary-url) PRIMARY_URL="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

gcp_require_tf_state_bucket
gcp_terraform_init

if [[ -z "$PRIMARY_URL" ]]; then
  PRIMARY_URL="$(gcp_terraform_output_raw craft_vm_url_hint 2>/dev/null || true)"
fi
if [[ -z "$PRIMARY_URL" || "$PRIMARY_URL" == "null" ]]; then
  echo "Pass --primary-url (public Craft URL, trailing slash). Hint: terraform output craft_vm_url_hint" >&2
  exit 1
fi

"${ROOT}/scripts/vm-sync-repo.sh"

echo "Waiting for first-boot script (/etc/ekko-craft.env, Docker, Cloud SQL proxy)…"
ok=0
for _ in $(seq 1 40); do
  if "${ROOT}/scripts/vm-remote.sh" "sudo test -f /etc/ekko-craft.env" 2>/dev/null; then
    ok=1
    break
  fi
  sleep 15
done
if [[ "$ok" -ne 1 ]]; then
  echo "Timed out waiting for /etc/ekko-craft.env. Inspect: sudo tail -100 /var/log/ekko-craft-startup.log" >&2
  exit 1
fi

b64="$(printf '%s' "$PRIMARY_URL" | base64 | tr -d '\n')"
"${ROOT}/scripts/vm-remote.sh" "export PRIMARY_SITE_URL=\"\$(printf '%s' '${b64}' | base64 -d)\" && sudo -E bash /srv/ekko/app/scripts/vm/write-cms-env.sh"

"${ROOT}/scripts/vm-remote.sh" "cd /srv/ekko/app && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp run --rm php composer install --no-interaction --no-progress"
"${ROOT}/scripts/vm-remote.sh" "cd /srv/ekko/app && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp up -d --build"

echo "Bootstrap done. Try: $PRIMARY_URL"
