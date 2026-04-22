# GCP baseline (Terraform) — Ekko / Craft

Creates in an **existing** customer project:

- Enabled service APIs
- **VPC peering** reserved range + **private IP** Cloud SQL for **MySQL**
- Optional **public IP** on Cloud SQL with **authorized networks** (off by default)
- Application **database** + **user** (random password)
- **GCS** buckets: long-lived **assets** + **migration** (SQL dump upload / `gcloud sql import`), with **Cloud SQL instance → migration bucket** `objectViewer` IAM for imports
- **Service account** for the future app VM / runtime with **Cloud SQL Client** + **object admin on assets bucket** only
- **Secret Manager** secret holding the DB password (app SA can read it)

This does **not** create VMs, load balancers, or Craft itself — only the data plane you will point Craft at.

---

## Run Terraform **without** installing it on your laptop

State is stored in **Google Cloud Storage** (configured at `terraform init`), not on your Mac.

### Option A — **Google Cloud Shell** (simplest)

Cloud Shell already includes Terraform and `gcloud`, authenticated as **you** in the browser.

1. Open [Cloud Shell](https://shell.cloud.google.com/) in the **customer project** (project picker).
2. **Create a state bucket once** (name must be globally unique):

   ```bash
   PROJECT_ID=$(gcloud config get-value project)
   gcloud storage buckets create "gs://${PROJECT_ID}-tfstate" \
     --project="${PROJECT_ID}" \
     --location=europe-north1 \
     --uniform-bucket-level-access
   ```

3. Clone this repo (or upload the `terraform/` folder), then:

   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars (e.g. nano) — set project_id, etc.

   terraform init \
     -backend-config="bucket=${PROJECT_ID}-tfstate" \
     -backend-config="prefix=terraform/ekko"

   terraform plan
   terraform apply
   ```

4. Read outputs in Cloud Shell:

   ```bash
   terraform output -raw database_password
   terraform output assets_bucket
   terraform output migration_bucket
   terraform output sql_instance_connection_name
   ```

First apply often takes **15–25 minutes** (Cloud SQL + service networking).

### Option B — **GitHub Actions** (no Terraform anywhere on your machine)

Use the workflow **`.github/workflows/terraform-gcp.yml`**, which runs `terraform plan` / `apply` on GitHub runners.

1. Create the **same kind of GCS state bucket** in the GCP project (or reuse the Cloud Shell bucket).
2. Configure [Workload Identity Federation](https://github.com/google-github-actions/auth#setting-up-workload-identity-federation) so GitHub can impersonate a **GCP service account** that has rights to create Cloud SQL, buckets, IAM, etc. (often **Editor** on that project for a dedicated “terraform” SA — tighten later.)
3. In the GitHub repo, add:
   - **Variables:** `GCP_PROJECT_ID`, optionally `GCP_REGION` (defaults to `europe-north1` in Terraform if unset — the workflow passes `TF_VAR_region` only if you set `GCP_REGION`).
   - **Secrets:** `GCP_WIF_PROVIDER`, `GCP_WIF_SERVICE_ACCOUNT`, `TF_STATE_BUCKET` (the state bucket name only, e.g. `my-project-tfstate`).

Then **Actions → terraform-gcp → Run workflow**, choose **plan** or **apply**.

> The workflow passes `TF_VAR_project_id` from `GCP_PROJECT_ID`. Add more `TF_VAR_*` GitHub Variables if you need to override other Terraform variables without committing `terraform.tfvars`.

---

## Prerequisites (any path)

- Billing linked to the project
- A **default VPC** (or set `vpc_network_name` in `terraform.tfvars` to an existing VPC)

---

## After apply — `gcloud` from Cloud Shell or your laptop

You do **not** need Terraform to import SQL or sync files — only `gcloud` (Cloud Shell has it).

### Upload SQL dump and import into Cloud SQL

Terraform grants the **Cloud SQL instance service account** **`roles/storage.objectViewer`** on the **migration** bucket so `gcloud sql import sql` can read the object. Apply Terraform **before** importing; if the bucket existed without this rule, run **`terraform apply`** once to add IAM.

**Option 1 — helper script** (repo root, Terraform initialized so `terraform output` works):

```bash
chmod +x scripts/import-db-to-cloud-sql.sh
./scripts/import-db-to-cloud-sql.sh ~/path/to/ekko-20260422.sql.gz
```

If the dump targets a different **logical** database name than Terraform’s `db_name` (default `craft`):

```bash
DATABASE_NAME=ekkonqcr_ekko ./scripts/import-db-to-cloud-sql.sh ~/path/to/dump.sql.gz
```

**Option 2 — manual `gcloud`**

Cloud SQL for MySQL usually accepts **`.sql` or `.sql.gz`**. If import rejects gzip, decompress and upload a plain `.sql`.

```bash
PROJECT_ID=…
MIGRATION_BUCKET=…   # terraform output -raw migration_bucket
INSTANCE=…           # terraform output -raw sql_instance_name

gcloud config set project "$PROJECT_ID"

gcloud storage cp ./path/to/ekko-20260422.sql.gz "gs://${MIGRATION_BUCKET}/import/ekko.sql.gz"

gcloud sql import sql "$INSTANCE" "gs://${MIGRATION_BUCKET}/import/ekko.sql.gz" \
  --database=craft
```

Imports apply to the **named database** (`--database=`). Use Terraform’s `db_name` unless you intentionally import elsewhere. Prefer an **empty** database for first import.

### Upload media (`uploads/`) to the assets bucket

```bash
ASSETS_BUCKET=…   # terraform output assets_bucket

gcloud storage rsync -r ./public_html/uploads/ "gs://${ASSETS_BUCKET}/uploads/"
```

---

## Connect Craft / admin tools

- **Private IP only (default):** use **Cloud SQL Auth Proxy** or a host **in the same VPC** (e.g. Compute Engine VM).
- **Temporary public IP:** set `sql_public_ip = true` and `sql_authorized_cidrs` in `terraform.tfvars`, apply, connect, then turn public IP off again.

---

## Destroy

Run from the **same place** you use for Terraform (Cloud Shell or CI), with the **same backend config** on `init`:

```bash
terraform destroy
```

If SQL refuses destroy, set `sql_deletion_protection = false` and apply first. Buckets with `force_destroy = false` must be emptied before destroy.
