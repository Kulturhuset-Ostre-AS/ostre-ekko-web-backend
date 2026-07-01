terraform {
  # Remote state on GCS. Config supplied at init via -backend-config, e.g.:
  #   terraform init \
  #     -backend-config="bucket=YOUR_TFSTATE_BUCKET" \
  #     -backend-config="prefix=terraform/ekko-payload"
  #
  # IMPORTANT: the intended state prefix is `terraform/ekko-payload`, which is
  # DISTINCT from the Craft module's `terraform/ekko`. The two modules share a
  # GCP project but MUST NOT share Terraform state — keep the prefixes separate.
  backend "gcs" {}
}
