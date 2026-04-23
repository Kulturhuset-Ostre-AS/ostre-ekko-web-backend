#!/usr/bin/env bash
# From your laptop: pack the repo (minus heavy/secret paths) and extract to /srv/ekko/app on the Craft VM via IAP.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/lib/gcp.sh"

gcp_require_tf_state_bucket
gcp_terraform_init

PROJECT="$(gcp_terraform_output_raw project_id)"
VM="$(gcp_terraform_output_raw craft_vm_name)"
ZONE="$(gcp_terraform_output_raw craft_vm_zone)"

if [[ -z "$VM" || "$VM" == "null" ]]; then
  echo "Terraform output craft_vm_name is empty — set vm_enabled=true and apply." >&2
  exit 1
fi

echo "Project=$PROJECT VM=$VM zone=$ZONE"
echo "Streaming tarball to VM (IAP)…"

# macOS tar: avoid AppleDouble / xattr pax headers that GNU tar on Debian warns about.
export COPYFILE_DISABLE=1

unset GOOGLE_OAUTH_ACCESS_TOKEN || true
gcp_unset_shell_account_override

tar -C "$ROOT" \
  --exclude='./.git' \
  --exclude='./.terraform' \
  --exclude='./cms/vendor' \
  --exclude='./cms/.env' \
  --exclude='./cms/storage' \
  --exclude='./node_modules' \
  --exclude='./.cursor' \
  -czf - . | gcloud compute ssh "$VM" \
  --account="${GCLOUD_SSH_ACCOUNT}" \
  --zone="$ZONE" \
  --project="$PROJECT" \
  --tunnel-through-iap \
  --command="sudo mkdir -p /srv/ekko/app && sudo tar -xzf - -C /srv/ekko/app --strip-components=0 && \
    sudo chmod -R a+rX /srv/ekko/app/public_html /srv/ekko/app/docker /srv/ekko/app/cms && \
    if sudo test -f /srv/ekko/app/cms/.env; then \
      sudo chown root:www-data /srv/ekko/app/cms/.env 2>/dev/null || sudo chown root:33 /srv/ekko/app/cms/.env; \
      sudo chmod 640 /srv/ekko/app/cms/.env; \
    fi"

echo "Repo synced to /srv/ekko/app"
