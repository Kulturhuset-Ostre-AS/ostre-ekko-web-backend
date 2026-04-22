variable "project_id" {
  description = "Existing GCP project ID (customer org) where resources are created."
  type        = string
}

variable "region" {
  description = "Primary region for Cloud SQL, buckets, and regional resources (e.g. europe-north1)."
  type        = string
  default     = "europe-north1"
}

variable "name_prefix" {
  description = "Short prefix for resource names (lowercase letters, numbers, hyphens)."
  type        = string
  default     = "ekko"
}

variable "vpc_network_name" {
  description = "VPC network name used for Cloud SQL private IP (usually 'default' on new projects)."
  type        = string
  default     = "default"
}

variable "mysql_version" {
  description = "Cloud SQL MySQL version string (MYSQL_8_0 recommended for new instances)."
  type        = string
  default     = "MYSQL_8_0"
}

variable "db_tier" {
  description = "Cloud SQL machine tier (e.g. db-f1-micro for dev, db-custom-2-7680 for small prod)."
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_size_gb" {
  description = "Initial data disk size in GB."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Logical database name inside the instance (Craft DB_DATABASE)."
  type        = string
  default     = "craft"
}

variable "db_user" {
  description = "Application MySQL user (Craft DB_USER)."
  type        = string
  default     = "craft"
}

variable "sql_public_ip" {
  description = "If true, enables a public IPv4 on Cloud SQL (use with authorized CIDRs only). Prefer false and use Cloud SQL Auth Proxy / private connectivity."
  type        = bool
  default     = false
}

variable "sql_authorized_cidrs" {
  description = "Map of name => CIDR allowed to connect over the public IP (only used when sql_public_ip is true), e.g. { home = \"203.0.113.10/32\" }."
  type        = map(string)
  default     = {}
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

variable "db_enable_pitr" {
  description = "Enable point-in-time recovery (requires sufficient disk / edition; may fail on smallest tiers—set false if apply errors)."
  type        = bool
  default     = false
}

variable "db_high_availability" {
  description = "REGIONAL (HA) vs ZONAL instance. HA costs roughly double."
  type        = bool
  default     = false
}

variable "assets_bucket_force_destroy" {
  description = "If true, `terraform destroy` can delete non-empty assets bucket. Keep false for prod."
  type        = bool
  default     = false
}

variable "migration_bucket_force_destroy" {
  description = "If true, destroy can delete the migration bucket even if objects exist."
  type        = bool
  default     = true
}
