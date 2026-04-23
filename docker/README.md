# Docker on a VM (Craft 3.7)

Compose runs **nginx + PHP 7.4 FPM** with the repo mounted at **`/var/www`** so `public_html/index.php` and `cms/` match production layout.

## On the VM (Debian / Ubuntu on GCP)

1. Install Docker Engine and Compose plugin ([Docker docs](https://docs.docker.com/engine/install/debian/) or Ubuntu equivalent).
2. Clone this repo and `cd` into it.
3. **`cms/vendor`**: either run `composer install` on the host before `compose up`, or run once inside PHP:

   ```bash
   docker compose run --rm php composer install --no-interaction
   ```
   On a **GCP VM** with Cloud SQL, use the same **`-f …gcp.yml` + `--env-file .env.gcp`** as in the Cloud SQL block below for `composer` and `up`.

4. **`cms/.env`**: copy from `cms/.env.example` and set `DB_*`, `SITE_URL`, `SECURITY_KEY`.  
   - With **local MariaDB** profile: `DB_SERVER=db`, `DB_USER=craft`, `DB_PASSWORD=craft`, `DB_DATABASE=craft`.  
   - With **Cloud SQL on the GCP VM**: use the **Compose overlay** so the Auth Proxy runs **in Docker** next to PHP (recommended — avoids `host.docker.internal` issues):

     ```bash
     sudo bash scripts/vm/write-cms-env.sh --primary-url 'http://YOUR_IP:8080/'
     docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp up -d --build
     ```

     `write-cms-env.sh` creates **`.env.gcp`** (`EKKO_CLOUDSQL_CONNECTION=…`) and **`cms/.env`** with **`DB_SERVER=cloudsql`**.

## Start

**Against Cloud SQL on GCP** (proxy + PHP in Compose):

```bash
docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp up -d --build
```

**Local / quick** (no GCP overlay — no Cloud SQL proxy in Compose):

```bash
docker compose up -d --build
```

**With bundled MariaDB for quick smoke tests:**

```bash
docker compose --profile local-db up -d --build
```

Site on **`http://VM_IP:${HTTP_PORT:-8080}`** (or SSH tunnel to `localhost:8080`).

## Notes

- **Writable `storage/`:** if the CP complains about permissions, ensure `cms/storage/logs` and `cms/storage/runtime` are writable by the PHP-FPM user (e.g. `chown -R 33:33 cms/storage` for `www-data`, or align host UIDs with a `user:` override in Compose).
- **`cms/vendor` is in `.dockerignore`** so the Docker *build* stays small; the directory still exists on the host volume at runtime — install Composer deps on the VM (or in a `php` one-off as above).
- **`public_html/uploads/`** is not in the image; sync from GCS or your backup onto the VM disk (or mount an NFS / gcsfuse volume) before expecting images in the CP.
- For production hardening: TLS at a load balancer or `nginx` + certs, non-root where practical, log rotation, and resource limits on the compose services.
