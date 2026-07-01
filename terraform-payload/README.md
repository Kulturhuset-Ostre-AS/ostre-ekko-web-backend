# GCP baseline (Terraform) — Payload CMS (`ekko-payload`)

A **separate, isolated** Terraform root module that provisions a Payload CMS
data plane in the **same GCP project** as the Craft module (`terraform/`), but
sharing **nothing else**.

Creates (all named `ekko-payload-*`):

- Enabled service APIs (sqladmin, storage, secretmanager, servicenetworking,
  run, artifactregistry, compute, iam, cloudresourcemanager, vpcaccess).
- **Cloud SQL for PostgreSQL 16** (zonal, small tier, daily backup) — reached by
  Cloud Run over the **Cloud SQL Auth Proxy** (instance connection name), not via
  VPC private IP.
- Application **database** + **user** (random password in Secret Manager).
- **GCS media bucket** (`ekko-payload-media-<suffix>`) for the storage-gcs plugin.
- **Runtime service account** (`ekko-payload-run`) with Cloud SQL Client, object
  admin on the media bucket, and secret accessor on the two secrets.
- **Secrets**: DB password + `PAYLOAD_SECRET`.
- **Artifact Registry** Docker repo (`ekko-payload`).
- **Cloud Run v2 service** (`ekko-payload`), publicly invokable, wired to the DB
  socket and secrets.

> **WARNING — isolation.** This module and the Craft `terraform/` module share
> the GCP **project only**. They must **never** be applied against the **same
> Terraform state** and must not reference each other's resources. This module
> uses its own state prefix `terraform/ekko-payload` (the Craft module uses
> `terraform/ekko`). All resource names are prefixed `ekko-payload-` so nothing
> collides with the Craft `ekko-*` / `ekko-app-*` resources.

---

## Service networking decision (why no private IP)

A VPC allows only **one** `google_service_networking_connection` for
`servicenetworking.googleapis.com`. The **Craft module already creates one** on
the `default` network. A second connection from this module would conflict, and
sharing a PSA connection across two separate states is unsafe.

So this module gives the Postgres instance **no VPC private IP**. It sets:

```hcl
ip_configuration {
  ipv4_enabled                                  = false
  enable_private_path_for_google_cloud_services = true
  # private_network intentionally UNSET (no PSA range required)
}
```

Cloud Run connects via the **Cloud SQL Auth Proxy** using the instance
**connection name** (Unix socket at `/cloudsql/<connection_name>`), which does
**not** require VPC peering. See the long comment block in `main.tf`.

---

## How the image is built

The Cloud Run service runs the Payload container from Artifact Registry
(`ekko-payload` repo). CI builds and pushes that image — **see `deploy/payload/`**
for the Cloud Build / Artifact Registry flow. On the **first apply**, leave
`payload_image = ""` to provision the service with a placeholder image, then set
`payload_image` (or let CI deploy) once a real image exists.

> The container's start command **must bind to `$PORT`** (Cloud Run injects it),
> defaulting to 3000, which is the declared container port.

---

## Run Terraform

State lives in **GCS**, configured at `terraform init`. Use the **separate**
prefix `terraform/ekko-payload`.

```bash
cd terraform-payload
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set project_id, payload_public_server_url, etc.

terraform init \
  -backend-config="bucket=${PROJECT_ID}-tfstate" \
  -backend-config="prefix=terraform/ekko-payload"

terraform plan
terraform apply
```

You can reuse the same state **bucket** as the Craft module, but you **must** use
the distinct **prefix** above so the two states never overlap.

First apply takes a while (Cloud SQL provisioning).

### GitHub Actions

Mirror `.github/workflows/terraform-gcp.yml` (WIF + GCS backend), but set
`working-directory: terraform-payload` and
`-backend-config="prefix=terraform/ekko-payload"`. Do **not** point the existing
Craft workflow at this directory.

---

## Outputs

```bash
terraform output cloud_run_url
terraform output media_bucket
terraform output sql_instance_connection_name
terraform output sql_instance_name
terraform output db_password_secret        # secret ID only (value not exposed)
terraform output payload_secret_secret     # secret ID only (value not exposed)
terraform output artifact_registry_repo
```

Raw secrets are **not** output; read them from Secret Manager if needed.

---

## Destroy

```bash
terraform destroy
```

Init with the **same** `terraform/ekko-payload` backend config first. If SQL
refuses destroy, set `sql_deletion_protection = false` and apply. The media
bucket must be empty unless `media_bucket_force_destroy = true`.
