# Deploying Payload to the cloud (GCP Cloud Run + Cloudflare frontend)

This is the **new Payload stack**, deployed entirely separately from the existing
**Craft production** (which stays on its own VM + Cloud SQL MySQL + `cms.ekko.no`).
Nothing here touches Craft.

## Architecture

```
                          ┌──────────────────────────────────────────┐
  Editors / public ─────► │  Cloud Run: ekko-payload  (Payload 3)     │
   admin.ekko.no    │    - Next server on $PORT (8080)          │
                          │    - GraphQL at /api/graphql              │
                          │    - admin at /admin                      │
                          └───────┬───────────────────────┬──────────┘
                                  │ Cloud SQL socket       │ GCS (storage-gcs)
                                  ▼                        ▼
                   Cloud SQL Postgres 16          GCS bucket
                   ekko-payload-pg                ekko-payload-media-XXXX
                   (db "payload")                 (uploaded media)

  Cloudflare Pages: ostre-ekko-web-frontend
    GRAPHQL_API_URL ──► https://admin.ekko.no/api/graphql
```

## Isolation from Craft production (the safety story)

| Concern | Craft (production) | Payload (new) |
|---|---|---|
| Terraform dir | `terraform/` | `terraform-payload/` |
| Terraform state prefix | `terraform/ekko` | `terraform/ekko-payload` |
| Resource name prefix | `ekko-*`, `ekko-app-*` | `ekko-payload-*` |
| Database | Cloud SQL **MySQL** `ekko-mysql` | Cloud SQL **Postgres** `ekko-payload-pg` |
| Compute | VM `ekko-craft-vm` + cloudflared | Cloud Run `ekko-payload` |
| Media | Craft GCS buckets | `ekko-payload-media-*` |
| CI workflows | `terraform-gcp.yml`, `deploy-cloudflared-token.yml` | `payload-terraform.yml`, `payload-build-image.yml` |

The two share **only** the GCP project and the WIF credentials. They never share
state, names, or resources, so `terraform plan` on one shows **no diff** for the
other. There is intentionally **no second `servicenetworking` connection** (the
`default` VPC can only have one; Craft owns it) — Cloud Run reaches Postgres over
the Cloud SQL Auth Proxy socket, which needs no VPC peering.

## First-time bring-up

Prereqs (already exist for the Craft module — reused): GitHub repo secrets
`GCP_WIF_PROVIDER`, `GCP_WIF_SERVICE_ACCOUNT`, `TF_STATE_BUCKET`; repo var
`GCP_PROJECT_ID`. The WIF service account additionally needs, for the Payload
build/deploy: `roles/run.admin`, `roles/artifactregistry.writer`,
`roles/cloudbuild.builds.editor`, `roles/iam.serviceAccountUser`,
`roles/storage.admin`. Set repo var `PAYLOAD_PUBLIC_SERVER_URL`
(`https://admin.ekko.no`) and `PAYLOAD_CORS` (the frontend origins).

1. **Provision infra** (creates AR repo, Postgres, bucket, secrets, Cloud Run with
   a placeholder image):
   - Actions → **payload-terraform** → `plan` → review → run again with `apply`.
   - Or locally:
     ```
     cd terraform-payload
     terraform init -backend-config="bucket=$TF_STATE_BUCKET" \
                    -backend-config="prefix=terraform/ekko-payload"
     terraform plan -var project_id=$GCP_PROJECT_ID
     ```
2. **Build + push the image**:
   - Actions → **payload-build-image** (runs `deploy/payload/cloudbuild.yaml`).
   - Note the pushed ref, e.g. `europe-north1-docker.pkg.dev/<proj>/ekko-payload/payload:<sha>`.
3. **Deploy the image**: set repo var `PAYLOAD_IMAGE` to that ref (or pass it as the
   `payload_image` input) and run **payload-terraform** → `apply`. This rolls the
   Cloud Run service to the real image.
4. **Import data**: run the migration toolkit (`migration/MIGRATION.md`) against the
   cloud Payload URL instead of `localhost:3000` (set `PAYLOAD_URL`).
5. **DNS / domain**: map `admin.ekko.no` to the Cloud Run service (Cloud Run
   custom domain, or a Cloudflare CNAME/tunnel). Then update `PAYLOAD_PUBLIC_SERVER_URL`
   and re-apply.
6. **Point the frontend**: in Cloudflare Pages (project `ostre-ekko-web-frontend`),
   set `GRAPHQL_API_URL=https://admin.ekko.no/api/graphql`. No code change —
   the endpoint is fully env-driven (see the frontend's `.dev.vars.example`).

## Subsequent image rollouts

Build (step 2) → set `PAYLOAD_IMAGE` → `payload-terraform apply`. Or, for an
image-only rollout without Terraform, `deploy/payload/deploy-cloud-run.sh`.

## Notes / decisions

- **Media must be GCS** — Cloud Run's disk is ephemeral. The `@payloadcms/storage-gcs`
  plugin activates whenever `GCS_BUCKET` is set (Terraform sets it). Locally
  `GCS_BUCKET` is unset, so the docker test env keeps using on-disk uploads — the
  test env is unchanged.
- **`DATABASE_URI`** embeds the DB password (Cloud Run can't template a secret into a
  composite connection string). The password is also in Secret Manager. Acceptable
  for this app; revisit if policy forbids secrets in the revision spec.
- **Cold starts**: `cloud_run_min_instances` defaults to `0` (cheapest). Set it to `1`
  to keep the admin warm at a small always-on cost.
- **Public invoker**: the Cloud Run URL is world-reachable (`allUsers` run.invoker);
  Payload enforces its own auth on `/admin`.
