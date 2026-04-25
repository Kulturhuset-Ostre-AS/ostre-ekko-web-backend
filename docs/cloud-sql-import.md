# Import a local Craft MySQL dump into Cloud SQL

Use this after Terraform has created the **Cloud SQL** instance and the **migration** GCS bucket. Terraform grants the **Cloud SQL service agent** `roles/storage.objectViewer` on the migration bucket so imports can read `gs://…` dumps.

## 1. Export from your upgraded local Craft DB

From **`cms/`** (where `.env` points at local MariaDB/MySQL), follow **[database-export.md](database-export.md)** — same `mysqldump` flags (`--no-tablespaces`, `--single-transaction`, `utf8mb4`, etc.). You should get a file like **`ekko-20260423.sql.gz`**.

## 2. Values from Terraform / GCP

```bash
export PROJECT_ID=your-gcp-project-id
export MIGRATION_BUCKET=…    # terraform output -raw migration_bucket
export SQL_INSTANCE=…        # terraform output -raw sql_instance_name
export DB_NAME=craft         # must match Terraform google_sql_database (default craft)
```

`gcloud config set project "$PROJECT_ID"`

## 3. Upload the dump to the migration bucket

Use any prefix; **`import/`** matches the examples in **`terraform/README.md`**.

```bash
gcloud storage cp ./ekko-20260423.sql.gz "gs://${MIGRATION_BUCKET}/import/craft-upgrade.sql.gz"
```

## 4. Import into Cloud SQL

```bash
gcloud sql import sql "$SQL_INSTANCE" \
  "gs://${MIGRATION_BUCKET}/import/craft-upgrade.sql.gz" \
  --database="$DB_NAME" \
  --quiet
```

`--quiet` skips the **Y/n** confirmation so the command works in scripts and automation.

- The **`craft`** database must already exist (Terraform creates it).
- If the import fails because **tables already exist**, connect with the proxy or a VPC VM, **drop the database or tables** (or use a fresh instance), then run the import again.
- If **`DEFINER`** / privilege errors appear, re-dump with a user that avoids unsupported definer clauses, or post-process the `.sql` file (strip `DEFINER=` clauses) before upload — common when moving from local root users to Cloud SQL.

## 5. Point Craft at Cloud SQL

Set **`cms/.env`** on the runtime that serves Craft (VM, etc.):

| Variable | Typical value |
| -------- | ------------- |
| `DB_SERVER` | Cloud SQL **private IP** (same VPC) or `127.0.0.1` with **Cloud SQL Auth Proxy** |
| `DB_PORT` | `3306` |
| `DB_DATABASE` | Same as `--database=` above (`craft`) |
| `DB_USER` | Terraform DB user (default `craft`) |
| `DB_PASSWORD` | From Secret Manager or `terraform output -raw database_password` (sensitive) |

Then run **`php craft up`** if schema or project config needs to align.

## 6. After import

- Update **`SITE_URL`**, **`GCS_*`**, and other env-specific values for the target environment.
- Re-run **`php craft project-config/apply`** only if you intend to **overwrite** server config from YAML; usually production is source of truth after first deploy — coordinate with your team.
- See **[gcp-vm-docker-deploy.md](gcp-vm-docker-deploy.md)** for the Docker VM stack and **[gcs-craft-plugin.md](gcs-craft-plugin.md)** for asset buckets.

## Reference

- Google: [Import SQL from Cloud Storage](https://cloud.google.com/sql/docs/mysql/import-export/import-export-sql)
- Repo: [`terraform/README.md`](../terraform/README.md) (same `gcloud` commands, shorter)
