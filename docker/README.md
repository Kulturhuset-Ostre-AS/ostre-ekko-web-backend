# Docker (Craft 5, local)

Compose runs **nginx + PHP 8.2 FPM** (`serversideup/php:8.2-fpm-alpine`, see `docker/php/Dockerfile`) with the repo mounted at **`/var/www`** so `public_html/index.php` and `cms/` match production layout.

## Setup

1. Install Docker Engine (or Docker Desktop) with the Compose plugin.
2. **`cms/vendor`**: either run `composer install` on the host before `compose up`, or run once inside PHP:

   ```bash
   docker compose run --rm php composer install --no-interaction
   ```

3. **`cms/.env`**: copy from `cms/.env.example` and set `DB_*`, `SITE_URL`, `SECURITY_KEY`.  
   With the **local MariaDB** profile: `DB_SERVER=db`, `DB_USER=craft`, `DB_PASSWORD=craft`, `DB_DATABASE=craft`.

## Start

**With bundled MariaDB:**

```bash
docker compose --profile local-db up -d --build
```

**Against an external database** (no `db` container; point `DB_SERVER` at it):

```bash
docker compose up -d --build
```

Site on **`http://localhost:${HTTP_PORT:-8080}`**.

## Notes

- **Writable `storage/`:** if the CP complains about permissions, ensure `cms/storage/logs` and `cms/storage/runtime` are writable by the PHP-FPM user (e.g. `chown -R 33:33 cms/storage` for `www-data`, or align host UIDs with a `user:` override in Compose).
- **`cms/vendor` is in `.dockerignore`** so the Docker *build* stays small; the directory still exists on the host volume at runtime — install Composer deps on the host (or in a `php` one-off as above).
- **`public_html/uploads/`** is not in the image; sync it from your backup before expecting images in the CP (see [`docs/local-media-sync.md`](../docs/local-media-sync.md)).
