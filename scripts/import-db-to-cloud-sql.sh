#!/usr/bin/env bash
# Upload a MySQL dump to the Terraform migration bucket and import it into Cloud SQL.
#
# Local file:
#   ./scripts/import-db-to-cloud-sql.sh /path/to/dump.sql.gz
# Already in GCS (e.g. GitHub Actions):
#   SOURCE_GS_URI=gs://bucket/dump.sql.gz ./scripts/import-db-to-cloud-sql.sh
#
# Optional env:
#   SOURCE_GS_URI     — gs://… object to copy into the migration bucket (instead of local file arg)
#   IMPORT_PROJECT_ID, IMPORT_MIGRATION_BUCKET, IMPORT_SQL_INSTANCE, IMPORT_DATABASE_NAME
#                       — if all four set, Terraform is not used (CI-friendly).
#   DATABASE_NAME       — logical DB name when using Terraform outputs (default: terraform output)
#   IMPORT_OBJECT       — object name under bucket (default: import/<basename>)
#   SKIP_IMPORT=1       — only upload/copy to GCS; do not run gcloud sql import sql
#   WAIT_FOR_SQL_INSTANCE=0 — skip wait for RUNNABLE (default: wait)
#   SQL_INSTANCE_WAIT_TIMEOUT_SEC — default 7200
#   SQL_INSTANCE_POLL_INTERVAL_SEC — default 30
#   TERRAFORM_DIR       — default <repo>/terraform
#
# Terraform state (GCS): if `terraform output` fails with AccessDenied, set TF_STATE_BUCKET (and
# GCP_PROJECT_ID or TF_VAR_project_id), run ./scripts/terraform-init.sh, and use the same
# GCLOUD_TF_ACCOUNT pattern as scripts/lib/gcp.sh, or set all IMPORT_* variables.
#
# gcloud identity: defaults to admin@ekko.no (same as scripts/lib/gcp.sh). Override with
# GCLOUD_ACCOUNT or GCLOUD_TF_ACCOUNT only if you must. Unsets CLOUDSDK_CORE_ACCOUNT so a stale
# shell export cannot force the wrong user.
set -euo pipefail

GCLOUD_ACCOUNT="${GCLOUD_ACCOUNT:-${GCLOUD_TF_ACCOUNT:-admin@ekko.no}}"
unset CLOUDSDK_CORE_ACCOUNT || true

dump_path="${1:-}"
source_gs="${SOURCE_GS_URI:-}"

if [[ -n "$source_gs" ]]; then
  if [[ ! "$source_gs" =~ ^gs://[^/]+/.+ ]]; then
    echo "SOURCE_GS_URI must be gs://bucket/path (got: $source_gs)" >&2
    exit 1
  fi
  base="${source_gs##*/}"
elif [[ -n "$dump_path" ]]; then
  if [[ ! -f "$dump_path" ]]; then
    echo "File not found: $dump_path" >&2
    exit 1
  fi
  base="$(basename "$dump_path")"
else
  echo "Usage: $0 /path/to/dump.sql[.gz]" >&2
  echo "   or: SOURCE_GS_URI=gs://bucket/path.sql.gz $0" >&2
  exit 1
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tf_dir="${TERRAFORM_DIR:-$root/terraform}"
import_object="${IMPORT_OBJECT:-import/${base}}"
poll="${SQL_INSTANCE_POLL_INTERVAL_SEC:-30}"
wait_timeout="${SQL_INSTANCE_WAIT_TIMEOUT_SEC:-7200}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found in PATH" >&2
  exit 1
fi

if [[ -n "${IMPORT_PROJECT_ID:-}" && -n "${IMPORT_MIGRATION_BUCKET:-}" && -n "${IMPORT_SQL_INSTANCE:-}" && -n "${IMPORT_DATABASE_NAME:-}" ]]; then
  project_id="$IMPORT_PROJECT_ID"
  bucket="$IMPORT_MIGRATION_BUCKET"
  instance="$IMPORT_SQL_INSTANCE"
  database_name="$IMPORT_DATABASE_NAME"
else
  if ! command -v terraform >/dev/null 2>&1; then
    echo "terraform not found in PATH" >&2
    exit 1
  fi
  if ! cd "$tf_dir"; then
    echo "Missing Terraform directory: $tf_dir" >&2
    exit 1
  fi
  if ! project_id="$(terraform output -raw project_id 2>/dev/null)"; then
    echo "Could not read Terraform outputs from $tf_dir (init + backend auth?)" >&2
    echo "Or set all of: IMPORT_PROJECT_ID IMPORT_MIGRATION_BUCKET IMPORT_SQL_INSTANCE IMPORT_DATABASE_NAME" >&2
    exit 1
  fi
  bucket="$(terraform output -raw migration_bucket)"
  instance="$(terraform output -raw sql_instance_name)"
  database_name="${DATABASE_NAME:-$(terraform output -raw database_name)}"
  cd "$root"
fi

gs_uri="gs://${bucket}/${import_object}"

echo "Project:     $project_id"
echo "Instance:    $instance"
echo "Database:    $database_name"
echo "Upload to:   $gs_uri"
echo

wait_for_runnable() {
  [[ "${WAIT_FOR_SQL_INSTANCE:-1}" == "0" ]] && return 0
  local deadline=$(( $(date +%s) + wait_timeout ))
  echo "Waiting for Cloud SQL instance to be RUNNABLE (timeout ${wait_timeout}s)…"
  while true; do
    local state
    if state="$(gcloud sql instances describe "$instance" --account="$GCLOUD_ACCOUNT" --project="$project_id" --format='value(state)' 2>/dev/null)"; then
      if [[ "$state" == "RUNNABLE" ]]; then
        echo "Instance is RUNNABLE."
        return 0
      fi
      echo "  state=$state"
    else
      echo "  instance not visible yet (creating or permissions)…"
    fi
    if [[ $(date +%s) -ge $deadline ]]; then
      echo "Timed out waiting for RUNNABLE." >&2
      return 1
    fi
    sleep "$poll"
  done
}

wait_for_runnable

if [[ -n "$source_gs" ]]; then
  echo "Copying from $source_gs …"
  gcloud storage cp --quiet --account="$GCLOUD_ACCOUNT" "$source_gs" "$gs_uri"
else
  echo "Uploading…"
  gcloud storage cp --quiet --account="$GCLOUD_ACCOUNT" "$dump_path" "$gs_uri"
fi

if [[ "${SKIP_IMPORT:-}" == "1" ]]; then
  echo
  echo "SKIP_IMPORT=1: upload/copy done; skipping Cloud SQL import."
  echo "Object: $gs_uri"
  exit 0
fi

echo "Starting import (can take several minutes)…"
gcloud sql import sql "$instance" "$gs_uri" \
  --account="$GCLOUD_ACCOUNT" \
  --database="$database_name" \
  --project="$project_id" \
  --quiet

echo
echo "Done. You may delete the dump from the bucket when finished:"
echo "  gcloud storage rm \"$gs_uri\""
