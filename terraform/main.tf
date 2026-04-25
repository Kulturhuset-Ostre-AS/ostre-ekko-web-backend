locals {
  apis = toset([
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iap.googleapis.com",
  ])
}

resource "google_project_service" "apis" {
  for_each = local.apis

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

data "google_project" "current" {
  project_id = var.project_id
}

data "google_compute_network" "main" {
  name    = var.vpc_network_name
  project = var.project_id
}

resource "google_compute_global_address" "private_sql_peering" {
  name          = "${var.name_prefix}-sql-psa"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = data.google_compute_network.main.id

  depends_on = [google_project_service.apis]
}

resource "google_service_networking_connection" "private_sql" {
  network                 = data.google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_sql_peering.name]

  depends_on = [google_project_service.apis]
}

resource "random_password" "db" {
  length  = 24
  special = true
}

resource "google_sql_database_instance" "craft" {
  name                = "${var.name_prefix}-mysql"
  region              = var.region
  database_version    = var.mysql_version
  deletion_protection = var.sql_deletion_protection

  depends_on = [
    google_project_service.apis,
    google_service_networking_connection.private_sql,
  ]

  settings {
    tier              = var.db_tier
    availability_type = var.db_high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = var.db_disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = var.db_backup_start_time
      point_in_time_recovery_enabled = var.db_enable_pitr
    }

    ip_configuration {
      ipv4_enabled                                  = var.sql_public_ip
      private_network                               = data.google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true

      dynamic "authorized_networks" {
        for_each = var.sql_public_ip ? var.sql_authorized_cidrs : {}
        content {
          name  = authorized_networks.key
          value = authorized_networks.value
        }
      }
    }

    database_flags {
      name  = "character_set_server"
      value = "utf8mb4"
    }
    database_flags {
      name  = "collation_server"
      value = "utf8mb4_unicode_ci"
    }
  }
}

resource "google_sql_database" "craft" {
  name     = var.db_name
  instance = google_sql_database_instance.craft.name
}

resource "google_sql_user" "craft" {
  name     = var.db_user
  instance = google_sql_database_instance.craft.name
  password = random_password.db.result
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "google_storage_bucket" "assets" {
  name                        = "${var.name_prefix}-assets-${random_id.bucket_suffix.hex}"
  location                    = var.region
  uniform_bucket_level_access = var.assets_bucket_uniform_bucket_level_access
  force_destroy               = var.assets_bucket_force_destroy

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket" "migration" {
  name                        = "${var.name_prefix}-migr-${random_id.bucket_suffix.hex}"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = var.migration_bucket_force_destroy

  depends_on = [google_project_service.apis]
}

# So `gcloud sql import sql … gs://migration-bucket/…` can read the object.
# See https://cloud.google.com/sql/docs/mysql/import-export/import-export-sql
resource "google_storage_bucket_iam_member" "migration_cloudsql_import" {
  bucket = google_storage_bucket.migration.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-cloud-sql.iam.gserviceaccount.com"

  depends_on = [
    google_project_service.apis,
    google_storage_bucket.migration,
  ]
}

resource "google_service_account" "app" {
  account_id   = "${var.name_prefix}-app"
  display_name = "${var.name_prefix} Craft application"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "app_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = google_service_account.app.member
}

resource "google_storage_bucket_iam_member" "app_assets_admin" {
  bucket = google_storage_bucket.assets.name
  role   = "roles/storage.objectAdmin"
  member = google_service_account.app.member
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.name_prefix}-mysql-app-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "db_password_app_accessor" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.app.member
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db.result
}

# Roles granted to the GitHub Actions (WIF) service account so the
# `deploy-cloudflared-token` workflow can SSH into the VM via IAP and
# update /srv/ekko/cloudflared.env. Gated on deploy_service_account_email;
# leave that variable empty to skip these bindings entirely.
locals {
  deploy_sa_roles = var.deploy_service_account_email == "" ? toset([]) : toset([
    "roles/iap.tunnelResourceAccessor", # reach instances over IAP
    "roles/compute.osAdminLogin",       # SSH as a sudoer via OS Login
    "roles/compute.instanceAdmin.v1",   # describe/list instances (gcloud ssh needs this)
  ])
}

resource "google_project_iam_member" "deploy_sa" {
  for_each = local.deploy_sa_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${var.deploy_service_account_email}"
}
