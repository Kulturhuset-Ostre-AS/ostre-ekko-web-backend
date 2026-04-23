#!/usr/bin/env bash
# Upload a MySQL dump to the Terraform migration bucket and import it into Cloud SQL.
# Prerequisites: Terraform applied; gcloud authenticated; dump is .sql or .sql.gz (MySQL).
#
# Usage:
#   ./scripts/import-db-to-cloud-sql.sh /path/to/dump.sql.gz
# Optional env:
#   DATABASE_NAME   — logical DB name (default: terraform output database_name)
#   IMPORT_OBJECT   — object name under bucket (default: import/<basename>)
set -euo pipefail

dump_path="${1:?Usage: $0 /path/to/dump.sql[.gz]}"

if [[ ! -f "$dump_path" ]]; then
  echo "File not found: $dump_path" >&2
  exit 1
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root/terraform"

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform not found in PATH" >&2
  exit 1
fi

project_id="$(terraform output -raw project_id)"
bucket="$(terraform output -raw migration_bucket)"
instance="$(terraform output -raw sql_instance_name)"
database_name="${DATABASE_NAME:-$(terraform output -raw database_name)}"
base="$(basename "$dump_path")"
import_object="${IMPORT_OBJECT:-import/${base}}"
gs_uri="gs://${bucket}/${import_object}"

echo "Project:     $project_id"
echo "Instance:    $instance"
echo "Database:    $database_name"
echo "Upload to:   $gs_uri"
echo

gcloud config set project "$project_id"

echo "Uploading…"
gcloud storage cp --quiet "$dump_path" "$gs_uri"

echo "Starting import (can take several minutes)…"
# --quiet skips the interactive confirmation prompt (safe for CI / agents).
gcloud sql import sql "$instance" "$gs_uri" \
  --database="$database_name" \
  --project="$project_id" \
  --quiet

echo
echo "Done. You may delete the dump from the bucket when finished:"
echo "  gcloud storage rm \"$gs_uri\""
