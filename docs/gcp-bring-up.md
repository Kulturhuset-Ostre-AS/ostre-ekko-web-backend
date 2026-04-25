# GCP bring-up: Terraform + GCS + Cloud SQL + Craft

Single checklist to align **infrastructure** (Terraform), **object storage** (GCS), **MySQL** (Cloud SQL), and **Craft** configuration. The app VM (or Cloud Run, etc.) is separate — see **[gcp-vm-docker-deploy.md](gcp-vm-docker-deploy.md)**.

## 1. Terraform apply

From **`terraform/`** (Cloud Shell or CI with state backend configured):

```bash
terraform plan
terraform apply
```

Collect outputs (save the DB password somewhere safe — it is also in **Secret Manager**):

```bash
terraform output -raw sql_private_ip
terraform output -raw sql_instance_name
terraform output -raw sql_instance_connection_name
terraform output -raw migration_bucket
terraform output -raw media_library_bucket
terraform output -raw app_service_account_email
terraform output -raw database_password   # sensitive; avoid logs
```

## 2. Media on GCS (assets bucket)

Sync your repo’s **`public_html/uploads/`** tree into the bucket under **`uploads/`** (matches Craft filesystem **subfolders** and the **`craftcms/google-cloud`** layout):

```bash
export PROJECT_ID=your-project-id
export MEDIA_BUCKET=…   # terraform output -raw media_library_bucket

gcloud config set project "$PROJECT_ID"
gcloud storage rsync -r ./public_html/uploads/ "gs://${MEDIA_BUCKET}/uploads/"
```

Re-run this after large CP uploads if you still treat disk as primary and the bucket as backup.

## 3. MySQL dump → Cloud SQL

1. Export locally — **[database-export.md](database-export.md)**.
2. Upload to the **migration** bucket, then import with **`--quiet`** (no **Y/n** prompt):

```bash
export MIGRATION_BUCKET=…    # terraform output -raw migration_bucket
export SQL_INSTANCE=…        # terraform output -raw sql_instance_name

gcloud storage cp ./ekko-YYYYMMDD.sql.gz "gs://${MIGRATION_BUCKET}/import/ekko.sql.gz"

gcloud sql import sql "$SQL_INSTANCE" "gs://${MIGRATION_BUCKET}/import/ekko.sql.gz" \
  --database=craft \
  --quiet
```

Details and troubleshooting: **[cloud-sql-import.md](cloud-sql-import.md)**.

## 4. Craft production `cms/.env`

| Variable | Notes |
| -------- | ----- |
| `ENVIRONMENT` | `production` |
| `DB_SERVER` | Cloud SQL **private IP** from Terraform (same VPC as the app), or `127.0.0.1` with **Cloud SQL Auth Proxy** |
| `DB_DATABASE` / `DB_USER` / `DB_PASSWORD` | Match Terraform (`craft` / `craft` / password output or Secret Manager) |
| `SITE_URL` | Public CMS origin (trailing slash) |
| `GCP_PROJECT_ID`, `GCS_ASSETS_BUCKET`, `GCS_ASSET_BASE_URL`, `GCS_KEY_FILE_JSON` | See **[gcs-craft-plugin.md](gcs-craft-plugin.md)** — on GCE with the Terraform app SA, **`GCS_KEY_FILE_JSON`** can be empty (ADC). |

## 5. Runtime (VM + Docker)

Use **[gcp-vm-docker-deploy.md](gcp-vm-docker-deploy.md)** and **`deploy/vm/bootstrap.sh`** (optional `EKKO_ASSETS_BUCKET` if you still hydrate local disk from GCS).

## 6. Links

| Topic | Doc |
| ----- | --- |
| Terraform only | [`terraform/README.md`](../terraform/README.md) |
| Cloud SQL import | [cloud-sql-import.md](cloud-sql-import.md) |
| GCS + Craft plugin | [gcs-craft-plugin.md](gcs-craft-plugin.md) |
| Local uploads / legacy tree | [local-media-sync.md](local-media-sync.md) |
