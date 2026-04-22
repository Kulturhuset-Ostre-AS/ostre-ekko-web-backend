# Docker on a VM (Craft 3.7)

Compose runs **nginx + PHP 7.4 FPM** with the repo mounted at **`/var/www`** so `public_html/index.php` and `cms/` match production layout.

## On the VM (Debian / Ubuntu on GCP)

1. Install Docker Engine and Compose plugin ([Docker docs](https://docs.docker.com/engine/install/debian/) or Ubuntu equivalent).
2. Clone this repo and `cd` into it.
3. **`cms/vendor`**: either run `composer install` on the host before `compose up`, or run once inside PHP:

   ```bash
   docker compose run --rm php composer install --no-interaction
   ```

4. **`cms/.env`**: copy from `cms/.env.example` and set `DB_*`, `SITE_URL`, `SECURITY_KEY`.  
   - With **local MariaDB** profile: `DB_SERVER=db`, `DB_USER=craft`, `DB_PASSWORD=craft`, `DB_DATABASE=craft`.  
   - With **Cloud SQL**: run the [Auth Proxy](https://cloud.google.com/sql/docs/mysql/connect-auth-proxy) on the VM (host or sidecar) and point `DB_SERVER` at the proxy listen address (often `127.0.0.1`).

## Start

**Against Cloud SQL only** (no `db` container):

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
