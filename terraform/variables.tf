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

# --- Craft application VM (Compute Engine + Docker / Compose on host) ---

variable "vm_enabled" {
  description = "If false, no GCE instance or VM firewall rules are managed."
  type        = bool
  default     = true
}

variable "vm_zone" {
  description = "GCE zone (e.g. europe-north1-a). Null = {region}-a."
  type        = string
  default     = null
  nullable    = true
}

variable "vm_subnetwork_name" {
  description = "Subnet for the VM. Default VPC (auto mode): use \"default\" in each region."
  type        = string
  default     = "default"
}

variable "vm_machine_type" {
  description = "GCE machine type. e2-small is a reasonable minimum for Docker; e2-micro is tighter on RAM."
  type        = string
  default     = "e2-small"
}

variable "vm_boot_disk_gb" {
  type    = number
  default = 30
}

variable "vm_boot_disk_type" {
  type    = string
  default = "pd-balanced"
}

variable "vm_boot_disk_image" {
  type    = string
  default = "debian-cloud/debian-12"
}

variable "vm_preemptible" {
  description = "If true, use Spot pricing (can be reclaimed; not for production)."
  type        = bool
  default     = false
}

variable "vm_http_port" {
  description = "Host TCP port published by docker-compose nginx (must match HTTP_PORT / compose)."
  type        = number
  default     = 8080
}

variable "vm_enable_http_firewall" {
  description = "Ingress from vm_http_source_ranges to vm_http_port on instances tagged for Craft."
  type        = bool
  default     = true
}

variable "vm_enable_iap_ssh_firewall" {
  description = "Allow SSH (tcp/22) from the IAP TCP forwarding range to instances tagged for IAP."
  type        = bool
  default     = true
}

variable "vm_http_source_ranges" {
  description = "CIDRs allowed to reach vm_http_port. Narrow in production (e.g. office / Cloudflare only)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "vm_cloud_sql_proxy_version" {
  description = "Cloud SQL Auth Proxy v2 release tag (see connector releases on GitHub / GCS)."
  type        = string
  default     = "v2.14.2"
}

variable "craft_git_repo_url" {
  description = "Optional public git clone URL; if set, startup clones into /srv/ekko/app. Leave empty for manual deploy."
  type        = string
  default     = ""
}
