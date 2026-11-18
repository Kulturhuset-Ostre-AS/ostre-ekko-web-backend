# Payload CMS — Cloud Run deploy

Container build + deploy assets for the **Payload 3 (Next 16)** CMS on Google
Cloud Run. This is a **separate deployment** from the production Craft CMS
(legacy Craft 3.7 on ProISP) and does not touch it.

## What lives where

| Thing | Source of truth |
| --- | --- |
| Prod image | `migration/payload-app/Dockerfile.prod` |
| Build → AR | `deploy/payload/cloudbuild.yaml` |
| Image-only rollout | `deploy/payload/deploy-cloud-run.sh` |
| AR repo `ekko-payload`, Cloud Run service `ekko-payload`, secrets, Cloud SQL, service account, scaling | **`terraform-payload/`** |

The Artifact Registry repo, the Cloud Run service, the secrets
(`PAYLOAD_SECRET`, `DATABASE_URI`, …), the Cloud SQL instance and the service
account are all provisioned by Terraform. Terraform must run first — the AR repo
in particular must exist before any image push.

## Build → push

Builds `Dockerfile.prod` with context `migration/payload-app` and tags the image
`:$SHORT_SHA` and `:latest` under `…/ekko-payload/payload`.

```sh
gcloud builds submit . \
  --config=deploy/payload/cloudbuild.yaml \
  --substitutions=SHORT_SHA=$(git rev-parse --short HEAD) \
  --project=YOUR_PROJECT_ID
```

Default region is `europe-north1` (override with `--substitutions=_REGION=…`).

## Deploy — two paths

**1. Terraform (primary).** Set the `payload_image` variable in
`terraform-payload/` to the freshly pushed ref and `terraform apply`. Terraform
is the source of truth for the whole service, so use this for anything beyond a
plain image swap.

```sh
terraform apply -var="payload_image=europe-north1-docker.pkg.dev/PROJECT/ekko-payload/payload:SHORT_SHA"
```

**2. Script (convenience / image-only).** When you just need to roll a new image
onto the already-provisioned service (e.g. a quick CI redeploy) without going
through the Terraform var:

```sh
PROJECT_ID=my-proj \
IMAGE=europe-north1-docker.pkg.dev/my-proj/ekko-payload/payload:SHORT_SHA \
./deploy/payload/deploy-cloud-run.sh
```

This only changes the container image; env, secrets, Cloud SQL, SA and scaling
stay as Terraform configured them.

## Cloud Run PORT gotcha

Cloud Run injects a `PORT` env var (default **8080**) and the container **must**
listen on it. The image runs `next start -p ${PORT:-3000}`, so on Cloud Run it
binds 8080 automatically and falls back to 3000 for local `docker run`. The
Dockerfile also `ENV PORT=8080` + `EXPOSE 8080`. Do not hardcode a different
port in the service config.

## Notes

- **No lockfile yet.** `migration/payload-app` has no `package-lock.json`, so the
  build uses `npm install`. Commit a lockfile and switch `Dockerfile.prod` to
  `npm ci` for reproducible builds.
- **Media → GCS.** The container filesystem is ephemeral. Setting `GCS_BUCKET`
  (and `GCS_PROJECT_ID`) enables the `@payloadcms/storage-gcs` plugin;
  credentials come from Cloud Run's Application Default Credentials (the service
  account). These env vars are wired by Terraform.

## Import service user (no passwords)

The Craft → Payload import (`migration/scripts/reimport-cloud.sh` and the
`sql-*` passes) authenticates as the service user **`import@ekko.no`** with an
API key (`users.auth.useAPIKey`), not with anyone's password. The key lives in
Secret Manager as **`ekko-payload-import-api-key`** (project `ekko-payload`), so
the only login needed is `gcloud auth login admin@ekko.no` (passkey in the
browser). The scripts send `Authorization: users API-Key <key>` whenever
`PAYLOAD_API_KEY` is set; without it they fall back to `SEED_EMAIL` /
`SEED_PASSWORD` for local test databases.

### Incremental sync (only what changed in Craft)

```sh
cd migration
bash scripts/reimport-cloud.sh --sync            # changes since the last import
bash scripts/reimport-cloud.sh --sync --prune    # … and delete entries deleted in Craft
```

`--sync` takes a fresh dump from Craft, but sends only entries whose
`dateUpdated` is newer than the last import (plus anything not imported yet). It
does no reset and has no `RESET` prompt, and fields that exist only in Payload are
left alone. The watermark is in `migration/data/sql/last-sync.json`, and every run
with a fresh dump (`--dump` or `--sync`) moves it forward. Override it with
`--since='YYYY-MM-DD HH:MM:SS'` (UTC). Entries deleted in Craft are listed. With
`--prune` they are deleted in Payload; the Cloud SQL backup taken at the start of
every run is the only undo. If a row fails, the sync stops without moving the
watermark, so the next `--sync` sends everything again (every step is idempotent).
Known gap: a Craft draft that is discarded without saving the entry stays as a
draft in Payload until the next full import.

At cutover: freeze editing in Craft, run `--sync --prune`, then switch DNS.

To rotate the key: generate a new random value, set it on the user (Payload
admin → Users → import@ekko.no → API key, or the local API with
`enableAPIKey: true, apiKey: <key>`), and add it as a new version of the secret.
Payload 3.90+ never shows an existing key again, so keep the value only in the
secret.
