#!/usr/bin/env bash
# terraform output with the same GCS-backend auth as other scripts (pass-through args).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/lib/gcp.sh"
gcp_require_tf_state_bucket
gcp_terraform_init
gcp_with_terraform_token terraform -chdir="${TF_DIR}" output "$@"
