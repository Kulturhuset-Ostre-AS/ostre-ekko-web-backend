# Reproducible GCP / VM scripts

## Goal (why this repo)

Ship **Craft CMS** on **Google Cloud Platform**, not “inside GCS”:

| Piece | Role |
|--------|------|
| **Cloud SQL (MySQL)** | Craft database |
| **Compute Engine + Docker** | nginx + PHP — **the site and Control Panel run here** |
| **Cloud Storage (GCS)** | Media / assets bucket (+ migration bucket for SQL dumps) |
| **Secret Manager** | DB password for the app VM |

Terraform + scripts exist to get that stack **repeatable and production-shaped**. GCS stores files; it does not execute PHP.

## Automated deploy (GitHub Actions)

Prefer the workflow — no local `gcloud` auth needed, uses Workload Identity Federation:

1. Open **Actions → deploy-craft → Run workflow**.
2. Choose `terraform_apply_first=yes` the first time, or after changing `terraform/` or VM metadata.
3. Leave `primary_url` blank to use `craft_vm_url_hint`, or paste the public URL (trailing slash).

It runs: WIF auth → (optional `terraform apply`) → IAP SSH → sync repo to `/srv/ekko/app` → `scripts/vm/write-cms-env.sh` → `composer install` → `docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp up -d --build` → HTTP smoke test. On failure it dumps `cloudsql`, `php`, `nginx` logs.

### One-time setup — grant GitHub permission to deploy

Before the workflow can run, a project owner (admin@ekko.no) binds GitHub → GCP via Workload Identity Federation and uploads the four repo identifiers. No long-lived keys leave GCP; GitHub exchanges its per-run OIDC token for a short-lived GCP token.

```bash
gcloud auth login admin@ekko.no
gh auth login
TF_STATE_BUCKET=ostre-ekko-web-backend-tfstate \
  ./scripts/bootstrap-github-deploy.sh
```

The script is idempotent. It pins WIF to exactly this repo (`assertion.repository == '…'`) and grants `roles/owner` to the deploy SA — effectively, anyone with **Actions: write** on this repo can ship. Tighten that by wrapping the workflow job in a GitHub **Environment** (`environment: production`) with required reviewers.

The local scripts below are the same pipeline, for debugging or one-offs.

---

Set these once per shell (or use a small `.env` you `source` — do not commit secrets):

```bash
export TF_STATE_BUCKET=ostre-ekko-web-backend-tfstate   # GCS bucket for Terraform state
export TF_STATE_PREFIX=terraform/ekko                 # optional; default in scripts/lib/gcp.sh
export GCP_PROJECT_ID=ostre-ekko-web-backend           # sets TF_VAR_project_id if unset
export TF_VAR_project_id=ostre-ekko-web-backend       # optional if GCP_PROJECT_ID set
export GCLOUD_TF_ACCOUNT=admin@ekko.no                 # required identity for this project (state + Terraform + IAP)
export GCLOUD_SSH_ACCOUNT=admin@ekko.no                # optional; defaults to GCLOUD_TF_ACCOUNT

Do **not** leave `CLOUDSDK_CORE_ACCOUNT` set to another user in the same shell — scripts unset it, but a bad export breaks `gcloud auth` refresh. Use **admin@ekko.no** for Ekko.
```

## Terraform (remote state)

```bash
./scripts/terraform-init.sh
./scripts/terraform-plan.sh
./scripts/terraform-apply.sh
```

`GOOGLE_OAUTH_ACCESS_TOKEN` is only set inside subshells used for Terraform, so `gcloud sql import` and IAP SSH are not forced through a narrow OAuth token.

## Database import (existing)

```bash
./scripts/import-db-to-cloud-sql.sh /path/to/dump.sql.gz
```

If Terraform cannot read state with your ADC, set `TF_STATE_BUCKET` + use the same `GCLOUD_TF_ACCOUNT` pattern, or set `IMPORT_PROJECT_ID`, `IMPORT_MIGRATION_BUCKET`, `IMPORT_SQL_INSTANCE`, `IMPORT_DATABASE_NAME` (see script header).

## Craft VM (after Terraform apply)

1. Grant your Google user **IAP TCP tunnel** + **Compute SSH** on the project.
2. From repo root:

```bash
./scripts/terraform-output.sh -raw craft_vm_url_hint
./scripts/vm-bootstrap.sh --primary-url "http://THE_IP:8080/"
```

Use the URL hint from `terraform-output.sh -raw craft_vm_url_hint`, or pass any public `SITE_URL` (trailing slash).

This runs, in order: **`vm-sync-repo.sh`**, **`write-cms-env.sh`** (writes **`cms/.env`** + **`.env.gcp`**), **`composer install`**, then **`docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp up -d --build`** (Cloud SQL Auth Proxy **inside Docker**, DB host **`cloudsql`**).

If the VM was created **before** `/etc/ekko-craft.env` existed in Terraform, run **`./scripts/terraform-apply.sh`** then **stop/start** the instance (or replace it) so the startup script runs again, **or** copy the **`EKKO_*`** lines (including **`EKKO_CLOUDSQL_CONNECTION`**) into `/etc/ekko-craft.env`.

**HTTP 500:** re-run **`write-cms-env.sh`**, then **`docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp up -d --build`**. If the DB still fails, check **`docker compose … logs cloudsql`** (proxy must reach the instance connection name). Older VMs may still have a **host** `cloud-sql-proxy` systemd unit — you can **`sudo systemctl disable --now cloud-sql-proxy`**; the proxy now runs **inside Compose**.

### One-off remote command

```bash
./scripts/vm-remote.sh 'cd /srv/ekko/app && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp logs --tail=50 cloudsql php'
```

### Uploads → assets bucket

```bash
BUCKET="$(./scripts/terraform-output.sh -raw assets_bucket)"
gcloud storage rsync -r ./public_html/uploads/ "gs://${BUCKET}/uploads/"
```
