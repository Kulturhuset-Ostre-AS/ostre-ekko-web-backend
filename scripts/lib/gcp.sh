#!/usr/bin/env bash
# shellcheck shell=bash
# Shared helpers for Terraform (GCS backend) and gcloud against ostre-ekko / Craft GCP.
#
# Correct project identity for Ekko is admin@ekko.no (defaults below). If your shell exports
# CLOUDSDK_CORE_ACCOUNT to another user, Terraform / IAP will use the wrong refresh token —
# we unset it before every gcloud call.

set -euo pipefail

gcp_unset_shell_account_override() {
  # Otherwise gcloud ignores --account and refreshes the wrong user (often failing in CI).
  unset CLOUDSDK_CORE_ACCOUNT || true
}

gcp_repo_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  printf '%s\n' "$here"
}

REPO_ROOT="$(gcp_repo_root)"
export REPO_ROOT
TF_DIR="${REPO_ROOT}/terraform"
export TF_DIR

# Account used for terraform when ADC cannot read remote state.
export GCLOUD_TF_ACCOUNT="${GCLOUD_TF_ACCOUNT:-admin@ekko.no}"

# Optional: account for `gcloud compute ssh` / scp.
export GCLOUD_SSH_ACCOUNT="${GCLOUD_SSH_ACCOUNT:-$GCLOUD_TF_ACCOUNT}"

gcp_print_access_token() {
  gcp_unset_shell_account_override
  gcloud auth print-access-token --account="${GCLOUD_TF_ACCOUNT}"
}

gcp_with_terraform_token() {
  (
    export TF_IN_AUTOMATION=true
    export GOOGLE_OAUTH_ACCESS_TOKEN
    GOOGLE_OAUTH_ACCESS_TOKEN="$(gcp_print_access_token)"
    if [[ -z "${TF_VAR_project_id:-}" && -n "${GCP_PROJECT_ID:-}" ]]; then
      export TF_VAR_project_id="${GCP_PROJECT_ID}"
    fi
    "$@"
  )
}

gcp_require_tf_state_bucket() {
  if [[ -z "${TF_STATE_BUCKET:-}" ]]; then
    echo "Set TF_STATE_BUCKET to the GCS bucket that holds Terraform state." >&2
    exit 1
  fi
}

gcp_terraform_init() {
  gcp_require_tf_state_bucket
  local prefix="${TF_STATE_PREFIX:-terraform/ekko}"
  gcp_with_terraform_token terraform -chdir="${TF_DIR}" init -input=false \
    -backend-config="bucket=${TF_STATE_BUCKET}" \
    -backend-config="prefix=${prefix}" \
    -reconfigure
}

gcp_terraform_output_raw() {
  local key="$1"
  gcp_with_terraform_token terraform -chdir="${TF_DIR}" output -raw "$key"
}
