variable "project_id" {
  description = "Existing GCP project ID (shared with the Craft module) where Payload resources are created."
  type        = string
}

variable "region" {
  description = "Primary region for Cloud SQL, buckets, Cloud Run, and Artifact Registry (e.g. europe-north1)."
  type        = string
  default     = "europe-north1"
}

variable "name_prefix" {
  description = "Prefix for all resource names. Keep as ekko-payload to stay isolated from the Craft (ekko-*) module."
  type        = string
  default     = "ekko-payload"
}

variable "vpc_network_name" {
  description = "VPC network name. Only used for the private-network data source; this module does NOT create a servicenetworking connection on it (see main.tf)."
  type        = string
  default     = "default"
}

variable "postgres_version" {
  description = "Cloud SQL PostgreSQL version string (POSTGRES_16 recommended for new instances)."
  type        = string
  default     = "POSTGRES_16"
}

variable "db_tier" {
  description = "Cloud SQL machine tier (e.g. db-f1-micro for dev)."
  type        = string
  default     = "db-f1-micro"
}

variable "db_edition" {
  description = "Cloud SQL edition. ENTERPRISE allows cheap shared-core tiers (db-f1-micro); ENTERPRISE_PLUS only allows db-perf-optimized-* tiers."
  type        = string
  default     = "ENTERPRISE"
}

variable "db_disk_size_gb" {
  description = "Initial data disk size in GB."
  type        = number
  default     = 10
}

variable "db_name" {
  description = "Logical database name inside the Postgres instance (Payload database)."
  type        = string
  default     = "payload"
}

variable "db_user" {
  description = "Application Postgres user for Payload."
  type        = string
  default     = "payload"
}

variable "sql_deletion_protection" {
  description = "When true, Terraform cannot destroy the SQL instance until protection is turned off."
  type        = bool
  default     = false
}

variable "db_backup_start_time" {
  description = "Daily backup window start (HH:MM, UTC)."
  type        = string
  default     = "03:00"
}

variable "media_bucket_force_destroy" {
  description = "If true, `terraform destroy` can delete the (possibly non-empty) media bucket. Keep false for prod."
  type        = bool
  default     = false
}

variable "payload_image" {
  description = "Artifact Registry image ref for the Cloud Run Payload service (e.g. europe-north1-docker.pkg.dev/PROJECT/ekko-payload/payload:latest). Empty uses a placeholder image so the service can be provisioned before the first build."
  type        = string
  default     = ""
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances (0 allows scale-to-zero)."
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances."
  type        = number
  default     = 2
}

variable "payload_public_server_url" {
  description = "The https URL Payload serves at, e.g. https://cms-payload.ekko.no. Exposed as PAYLOAD_PUBLIC_SERVER_URL."
  type        = string
  default     = ""
}

variable "payload_cors" {
  description = "Comma-separated allowed origins for the frontend (Payload CORS). Exposed as PAYLOAD_CORS."
  type        = string
  default     = ""
}

variable "frontend_url" {
  description = "Public base URL of the frontend site. Exposed as FRONTEND_URL; the admin Preview buttons open pages there (falls back to localhost:5173 when empty)."
  type        = string
  default     = ""
}

variable "deploy_service_account_email" {
  description = "Email of the WIF-federated service account GitHub Actions uses to deploy. When non-empty, run.admin + artifactregistry.writer + iam.serviceAccountUser are granted so CI can build/push images and deploy Cloud Run. Leave empty to skip."
  type        = string
  default     = ""
}
