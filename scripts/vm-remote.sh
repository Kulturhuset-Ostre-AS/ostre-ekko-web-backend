#!/usr/bin/env bash
# Run a shell command on the Craft VM via IAP (uses terraform outputs + GCLOUD_SSH_ACCOUNT).
# Usage: ./scripts/vm-remote.sh 'cd /srv/ekko/app && sudo docker compose ps'
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/lib/gcp.sh"

gcp_require_tf_state_bucket
if [[ ! -d "${TF_DIR}/.terraform" ]]; then
  gcp_terraform_init
fi

PROJECT="$(gcp_terraform_output_raw project_id)"
VM="$(gcp_terraform_output_raw craft_vm_name)"
ZONE="$(gcp_terraform_output_raw craft_vm_zone)"

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 'remote command string'" >&2
  exit 1
fi

unset GOOGLE_OAUTH_ACCESS_TOKEN || true
gcp_unset_shell_account_override

exec gcloud compute ssh "$VM" \
  --account="${GCLOUD_SSH_ACCOUNT}" \
  --zone="$ZONE" \
  --project="$PROJECT" \
  --tunnel-through-iap \
  --command="$1"
