terraform {
  required_version = ">= 1.5.0"

  # Remote state on GCS (no local Terraform state files). Configure on first init, e.g.:
  #   terraform init -backend-config="bucket=YOUR_TFSTATE_BUCKET" -backend-config="prefix=ekko/terraform"
  # Create the bucket once (Cloud Shell or gcloud) before init.
  backend "gcs" {}

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.40.0, < 7.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
