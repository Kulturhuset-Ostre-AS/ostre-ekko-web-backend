# Craft on a GCP VM (same stack as local Docker)

This mirrors **root `docker-compose.yml`** (nginx + PHP-FPM, repo bind-mounted at `/var/www`) on **Compute Engine**. The optional **`local-db`** MariaDB profile is **not** used; Craft talks to **Cloud SQL** from Terraform.

## Prerequisites (already in your project)

- Terraform applied: **Cloud SQL** (private IP), **assets GCS bucket**, **app service account** (`roles/cloudsql.client`, `storage.objectAdmin` on the media bucket).
- A **VM in the same VPC** as Cloud SQL so the instance **private IP** is reachable on port **3306** (default topology when the VM uses the default VPC/subnet in the same region as SQL).

## 1. Create the VM

Typical choices:

- **OS:** Ubuntu 22.04 LTS (or 24.04).
- **Machine type:** `e2-medium` or larger (Craft + Imager benefit from RAM).
- **Disk:** 50–100 GB+ SSD if you keep **`public_html/uploads/`** on local disk (synced from GCS).
- **Service account:** Attach the Terraform **app** service account (output `app_service_account_email`).  
  - If you use a different VM SA, grant it **Cloud SQL Client** on the project and **Storage Object Admin** on the assets bucket (same as Terraform’s `app` SA).
- **Firewall:** Allow **TCP 80** and **443** from the internet (or from your load balancer only). Restrict **SSH (22)** to admin IPs.
- **Scopes:** “Allow full access to all Cloud APIs” is the quick path when the VM SA carries the IAM roles. Alternatively use minimal scopes + IAM.

Install Docker on the VM (official steps are fine):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out and back in, or newgrp docker
```

Install the **Compose plugin** if the script did not (`docker compose version`).

Install **Google Cloud CLI** if you want on-VM `gcloud storage rsync` (VM SA auth via metadata — no JSON key on disk if you use the attached SA).

## 2. Put the code on the VM

Either **git clone** (SSH deploy key for private repos) or **rsync/CI artifact** into a fixed directory, for example **`/opt/ostre-ekko-web-backend`**.

```bash
sudo mkdir -p /opt/ostre-ekko-web-backend
sudo chown "$USER:$USER" /opt/ostre-ekko-web-backend
git clone git@github.com:Kulturhuset-Ostre-AS/ostre-ekko-web-backend.git /opt/ostre-ekko-web-backend
cd /opt/ostre-ekko-web-backend
```

## 3. `cms/.env` for production

Public volumes use **[`craftcms/google-cloud`](https://plugins.craftcms.com/google-cloud)** — set **`GCP_PROJECT_ID`**, **`GCS_ASSETS_BUCKET`**, **`GCS_ASSET_BASE_URL`**, and usually leave **`GCS_KEY_FILE_JSON`** empty when the VM runs as the Terraform app service account. See [`docs/gcs-craft-plugin.md`](gcs-craft-plugin.md).

Copy **`cms/.env.example`** → **`cms/.env`** and set at least:

| Variable | Production notes |
| -------- | ---------------- |
| `ENVIRONMENT` | `production` |
| `SECURITY_KEY` | Same key as before if migrating an existing DB; otherwise generate once and store in Secret Manager. |
| `DB_SERVER` | Cloud SQL **private IP** (`terraform output -raw sql_private_ip`). |
| `DB_PORT` | `3306` |
| `DB_DATABASE` / `DB_USER` | Match Terraform (`craft` by default). |
| `DB_PASSWORD` | From Secret Manager or `terraform output -raw database_password` (treat as sensitive). |
| `SITE_URL` | Public origin of this CMS, e.g. `https://api.example.com/` (must match how nginx is exposed). |

**Craft license:** `cms/config/license.key` is not in git. Copy from Secret Manager, another host, or the control panel.

## 4. Composer dependencies (inside the PHP container)

The image does not bake `vendor/`; run once after clone or deploy:

```bash
cd /opt/ostre-ekko-web-backend
docker compose run --rm php composer install --no-dev --no-interaction
```

## 5. Media on disk (optional but typical)

Browsers still load **`SITE_URL/uploads/…`** from nginx unless you change asset URLs. Sync from the Terraform **assets** bucket (same as `media_library_bucket`):

```bash
BUCKET="ekko-assets-xxxxxxxx"   # your bucket name
gcloud storage rsync -r "gs://${BUCKET}/uploads/" ./public_html/uploads/
```

Or run **`deploy/vm/bootstrap.sh`** with `EKKO_ASSETS_BUCKET` set (see script header).

## 6. Start the stack

Do **not** enable the **`local-db`** profile (omit `--profile local-db`).

```bash
cd /opt/ostre-ekko-web-backend
docker compose up -d --build
```

Nginx listens on **80** inside the compose network; the compose file maps **`${HTTP_PORT:-8080}:80`**. For production on a dedicated VM, set **`HTTP_PORT=80`** (requires root or **cap_net_bind** / authbind; simplest is **`sudo HTTP_PORT=80 docker compose up -d`** or a root-run systemd unit).

HTTPS: terminate TLS on the VM (Caddy, nginx+certbot) in front of port 8080, or place a **GCP HTTPS load balancer** in front and keep the VM HTTP-only on a private NIC.

## 7. Boot persistence (systemd)

Example unit (edit `WorkingDirectory` if your path differs):

- Copy [`deploy/vm/systemd/ekko-craft.service`](../deploy/vm/systemd/ekko-craft.service) to **`/etc/systemd/system/ekko-craft.service`**
- Optional env file **`/etc/default/ekko-craft`**:

  ```bash
  HTTP_PORT=80
  ```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ekko-craft.service
```

The unit runs **`docker compose up -d`** on boot and **`docker compose down`** on stop. Re-run **`deploy/vm/bootstrap.sh`** after code or dependency changes (Composer + optional GCS rsync + rebuild).

## 8. Cloud-init (optional first boot)

[`deploy/vm/cloud-init.yaml`](../deploy/vm/cloud-init.yaml) is a **template**: replace the `git clone` URL, fix paths, and paste into “Startup script” / cloud-init when creating the instance. Prefer tightening SSH and using a deploy key for private GitHub.

## 9. Ongoing operations

- **Deploys:** `git pull` (or rsync), `deploy/vm/bootstrap.sh`, `docker compose exec php php craft up` if migrations/config changed.
- **Queue:** run a long-lived queue listener (second systemd service or `supervisord`) with `docker compose exec php php craft queue/listen` — not covered by the default compose file.
- **Database access from your laptop:** Cloud SQL Auth Proxy or temporary authorized network — not the VM.

For Terraform outputs and bucket sync commands, see [`terraform/README.md`](../terraform/README.md).
