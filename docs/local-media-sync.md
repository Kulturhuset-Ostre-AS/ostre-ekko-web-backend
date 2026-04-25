# Local media (uploads + Imager cache)

Craft volumes use **`public_html/uploads/`** (see `@assetBasePath` / `@assetBaseUrl` in `cms/config/general.php` and filesystems in `cms/config/project/project.yaml`):

| Volume        | Disk path                         | Public URL (under `SITE_URL`)   |
| ------------- | --------------------------------- | ------------------------------- |
| Artist Photos | `uploads/photos/artists/`         | `/uploads/photos/artists/`      |
| Event Photo   | `uploads/photos/events/`         | `/uploads/photos/events/`       |
| Mixtapes      | `uploads/mixtapes/`             | `/uploads/mixtapes/`            |
| User Photos   | `cms/storage/userphotos/`       | (no public URL)                 |

These directories are **gitignored**; copy them from a host backup or another checkout when you need real files locally.

## Production copy on GCP

Terraform provisions a private **GCS** bucket for this tree (outputs **`media_library_bucket`** and **`assets_bucket`** — same bucket). After `terraform apply`, sync local `public_html/uploads/` to `gs://…/uploads/` as described in [`terraform/README.md`](../terraform/README.md) (section *Media library — upload uploads/ to GCS*). From there, copy or mount onto the Craft web root in your runtime (or evolve to a CDN / remote filesystem plugin if you change how URLs are generated). For a **Compute Engine VM** using the same Docker Compose stack as locally, use [`gcp-vm-docker-deploy.md`](gcp-vm-docker-deploy.md) and **`deploy/vm/bootstrap.sh`** (optional `EKKO_ASSETS_BUCKET`) to pull uploads back onto disk.

Full GCP ordering (Terraform, bucket sync, SQL import): [`gcp-bring-up.md`](gcp-bring-up.md).

## From a legacy `api.ekko.no` tree (e.g. `~/Downloads/api.ekko.no`)

If you have a full document-root dump with the same layout as production:

```bash
REPO=/path/to/ostre-ekko-web-backend
LEGACY=~/Downloads/api.ekko.no/public_html

rsync -a --delete "$LEGACY/uploads/" "$REPO/public_html/uploads/"
```

Optional: copy **Imager X** transform cache so thumbnails load without regenerating everything:

```bash
mkdir -p "$REPO/public_html/imager"
rsync -a --delete "$LEGACY/imager/" "$REPO/public_html/imager/"
```

## Docker / nginx

The compose stack mounts the repo at **`/var/www`** and nginx `root` is **`/var/www/public_html`**, so synced files are served as static assets (`try_files` in `docker/nginx/default.conf`).

Set **`SITE_URL`** in `cms/.env` to the same origin the browser uses (for example `http://localhost` if that is how you open the site), so GraphQL asset URLs match where files are actually served.
