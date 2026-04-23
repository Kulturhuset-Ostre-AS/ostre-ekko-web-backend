# Reproducible GCP / VM scripts

## Goal

Ship **Craft CMS** on **Google Cloud Platform**:

| Piece | Role |
|-------|------|
| **Cloud SQL (MySQL)** | Craft database |
| **Artifact Registry** | Prebuilt php-fpm + nginx Docker images |
| **Compute Engine + Docker** | Pulls + runs the images |
| **Cloud Storage (GCS)** | Media / assets bucket (+ migration bucket for SQL dumps) |
| **Secret Manager** | DB password, fetched by the VM on deploy |

CI builds the images once, pushes them to Artifact Registry, and tells the VM
to `docker compose pull && up -d`. No compilation, no `composer install`, no
source sync happens on the VM.

## Automated deploy (GitHub Actions)

Use the workflow — no local `gcloud` needed, uses Workload Identity Federation:

1. **Actions → deploy-craft → Run workflow**.
2. `terraform_apply_first=yes` on the first run or after changing `terraform/` or the Dockerfiles/compose. Otherwise `no`.
3. Leave `primary_url` blank to use `craft_vm_url_hint`, or paste the public URL (trailing slash).

Flow: WIF auth → (optional `terraform apply`) → build+push **php** and **nginx** images to Artifact Registry (tagged with the git SHA) → IAP-SSH to the VM → write `/srv/ekko/cms.env` (from Secret Manager) + `/srv/ekko/.env.gcp` → `docker compose pull && up -d` → HTTP smoke test. On failure the last step dumps `cloudsql`, `php`, `nginx` container logs.

### One-time setup — grant GitHub permission to deploy

A project owner (`admin@ekko.no`) runs this once to wire WIF and publish the four repo identifiers. No long-lived keys leave GCP; GitHub exchanges its per-run OIDC token for a short-lived GCP token.

```bash
gcloud auth login admin@ekko.no
gh auth login
TF_STATE_BUCKET=ostre-ekko-web-backend-tfstate \
  ./scripts/bootstrap-github-deploy.sh
```

Idempotent. Pins WIF to exactly this repo (`assertion.repository == '…'`) and grants `roles/owner` to the deploy SA — so anyone with **Actions: write** can ship.

---

## Local helpers (optional, for debugging)

Set these once per shell:

```bash
export TF_STATE_BUCKET=ostre-ekko-web-backend-tfstate
export GCP_PROJECT_ID=ostre-ekko-web-backend
export GCLOUD_TF_ACCOUNT=admin@ekko.no
```

### Terraform

```bash
./scripts/terraform-init.sh
./scripts/terraform-plan.sh
./scripts/terraform-apply.sh
./scripts/terraform-output.sh -raw artifact_registry_repo
```

### One-off commands on the VM

```bash
./scripts/vm-remote.sh 'cd /srv/ekko && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp logs --tail=80 cloudsql php nginx'
./scripts/vm-remote.sh 'cd /srv/ekko && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp ps'
```

### Database import

```bash
./scripts/import-db-to-cloud-sql.sh /path/to/dump.sql.gz
```

Or via **Actions → cloud-sql-import → Run workflow** with a `gs://…` URI.

### Uploads → assets bucket

```bash
BUCKET="$(./scripts/terraform-output.sh -raw assets_bucket)"
gcloud storage rsync -r ./public_html/uploads/ "gs://${BUCKET}/uploads/"
```

## Local dev

Plain `docker compose up --build` from the repo root uses the dev overlay: bind-mounts the repo into the php container so edits are live, runs a `mariadb` container (`docker compose --profile local-db up`). The production image layout (multi-stage Dockerfiles, baked vendor, Artifact Registry pull) is only activated on the VM via `docker-compose.gcp.yml`.
