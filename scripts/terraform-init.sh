#!/usr/bin/env bash
# Reproducible: terraform init with GCS backend using GCLOUD_TF_ACCOUNT for state access.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/lib/gcp.sh"
gcp_terraform_init
echo "Terraform init OK."
