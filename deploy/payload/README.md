# Payload CMS — Cloud Run deploy

Container build + deploy assets for the **Payload 3 (Next 16)** CMS on Google
Cloud Run. This is a **separate deployment** from the production Craft CMS
(`deploy/vm/`, `terraform/`) and does not touch it.

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
