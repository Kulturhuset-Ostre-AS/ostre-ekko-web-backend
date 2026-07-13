locals {
  apis = toset([
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "vpcaccess.googleapis.com",
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

# Data source only — we read the network for context/documentation but do NOT
# create a servicenetworking connection on it (see the big note below).
data "google_compute_network" "main" {
  name    = var.vpc_network_name
  project = var.project_id
}

# -----------------------------------------------------------------------------
# SERVICE NETWORKING / PRIVATE IP DECISION (read carefully)
# -----------------------------------------------------------------------------
# A VPC can hold only ONE google_service_networking_connection for the
# `servicenetworking.googleapis.com` service. The Craft module
# (terraform/main.tf) ALREADY creates one on the `default` network via its own
# google_compute_global_address + google_service_networking_connection.
#
# Creating a SECOND connection on the same network from this module would
# conflict (both manage the single VPC<->servicenetworking peering), and we are
# forbidden from referencing/importing the Craft module's resources. Sharing a
# PSA connection across two separate Terraform states is not safe.
#
# Therefore this module does NOT give the Postgres instance a VPC private IP and
# does NOT create a service_networking_connection or a PSA global address.
#
# Instead, Cloud Run reaches Postgres over the Cloud SQL Auth Proxy path using
# the instance *connection name* (a Unix socket at /cloudsql/<connection_name>).
# That path does NOT require VPC peering / PSA, so it cannot collide with the
# Craft module's servicenetworking connection.
#
# The instance is configured with:
#   ipv4_enabled                                  = false  (no public IP)
#   enable_private_path_for_google_cloud_services = true   (Google-managed path)
#   (private_network intentionally UNSET — setting it would require a PSA range)
# -----------------------------------------------------------------------------

resource "random_password" "db" {
  length  = 24
  special = true
}

resource "google_sql_database_instance" "pg" {
  name                = "${var.name_prefix}-pg"
  region              = var.region
  database_version    = var.postgres_version
  deletion_protection = var.sql_deletion_protection

  depends_on = [google_project_service.apis]

  settings {
    tier = var.db_tier
    # Shared-core tiers (db-f1-micro / db-g1-small) require the ENTERPRISE edition;
    # the newer ENTERPRISE_PLUS default only allows db-perf-optimized-* tiers.
    edition           = var.db_edition
    availability_type = "ZONAL"
    disk_size         = var.db_disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled    = true
      start_time = var.db_backup_start_time
    }

    ip_configuration {
      # Cloud SQL requires at least one connectivity type. We enable a public IP
      # but grant NO authorized_networks, so nothing on the internet can connect.
      # Cloud Run reaches the DB via the Cloud SQL Auth Proxy socket (instance
      # connection name over Google's internal path), NOT this public IP and NOT
      # via VPC private IP — so private_network stays UNSET and there is no
      # servicenetworking peering to conflict with the Craft-5 test project.
      ipv4_enabled = true
      # No authorized_networks block => the public IP is unreachable from anywhere.
      # (enable_private_path_for_google_cloud_services is omitted: it requires a
      # private network and is not applicable to a public-IP-only instance. Cloud
      # Run connects via the Auth Proxy socket regardless.)
    }
  }
}

resource "google_sql_database" "payload" {
  name     = var.db_name
  instance = google_sql_database_instance.pg.name
}

resource "google_sql_user" "payload" {
  name     = var.db_user
  instance = google_sql_database_instance.pg.name
  password = random_password.db.result
}

# -----------------------------------------------------------------------------
# GCS media bucket for Payload uploads (storage-gcs plugin writes here).
# -----------------------------------------------------------------------------
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "google_storage_bucket" "media" {
  name                        = "${var.name_prefix}-media-${random_id.bucket_suffix.hex}"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = var.media_bucket_force_destroy

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# Runtime service account for the Cloud Run service.
# -----------------------------------------------------------------------------
resource "google_service_account" "run" {
  account_id   = "${var.name_prefix}-run"
  display_name = "${var.name_prefix} Cloud Run runtime"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = google_service_account.run.member
}

resource "google_storage_bucket_iam_member" "run_media_admin" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = google_service_account.run.member
}

# -----------------------------------------------------------------------------
# Secrets: DB password + Payload secret (PAYLOAD_SECRET).
# -----------------------------------------------------------------------------
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.name_prefix}-db-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db.result
}

resource "google_secret_manager_secret_iam_member" "db_password_accessor" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.run.member
}

resource "random_password" "payload_secret" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "payload_secret" {
  secret_id = "${var.name_prefix}-payload-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "payload_secret" {
  secret      = google_secret_manager_secret.payload_secret.id
  secret_data = random_password.payload_secret.result
}

resource "google_secret_manager_secret_iam_member" "payload_secret_accessor" {
  secret_id = google_secret_manager_secret.payload_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.run.member
}

# -----------------------------------------------------------------------------
# Artifact Registry repo holding the Payload container image.
# -----------------------------------------------------------------------------
resource "google_artifact_registry_repository" "payload" {
  repository_id = var.name_prefix
  location      = var.region
  format        = "DOCKER"
  description   = "Payload CMS container images (isolated from the Craft module)."

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# Cloud Run service.
# -----------------------------------------------------------------------------
locals {
  # If no image is provided yet, use a placeholder so the service provisions.
  # CI (see deploy/payload/) pushes the real image and redeploys.
  payload_image = var.payload_image != "" ? var.payload_image : "us-docker.pkg.dev/cloudrun/container/hello"

  # Cloud SQL Auth Proxy socket connection string. Host is the Unix socket dir
  # /cloudsql/<connection_name>; no VPC private IP involved. The password is
  # urlencode()'d — random_password can contain @ # / etc. that would otherwise
  # break URL parsing (node-postgres parses this as a URL).
  database_uri = "postgres://${var.db_user}:${urlencode(random_password.db.result)}@/${var.db_name}?host=/cloudsql/${google_sql_database_instance.pg.connection_name}"
}

resource "google_cloud_run_v2_service" "payload" {
  name     = var.name_prefix
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    # Mount the Cloud SQL instance so the Auth Proxy socket appears at
    # /cloudsql/<connection_name> inside the container.
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.pg.connection_name]
      }
    }

    containers {
      image = local.payload_image

      # Cloud Run injects PORT matching container_port; the container's start
      # command binds it (`next start -p $PORT`). We standardize on 8080 to match
      # Dockerfile.prod (ENV PORT=8080 / EXPOSE 8080) and Cloud Run's default, so
      # the declared port, the injected PORT, and the Next listen port all agree.
      ports {
        container_port = 8080
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      # DATABASE_URI is assembled from a secret-backed password, so the full
      # string embeds a secret value. It is passed as a plain env var here
      # because Cloud Run cannot template a secret into a composite string;
      # the password itself also remains available in Secret Manager.
      env {
        name  = "DATABASE_URI"
        value = local.database_uri
      }

      env {
        name = "PAYLOAD_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.payload_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DATABASE_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "PAYLOAD_PUBLIC_SERVER_URL"
        value = var.payload_public_server_url
      }

      env {
        name  = "PAYLOAD_CORS"
        value = var.payload_cors
      }

      env {
        name  = "FRONTEND_URL"
        value = var.frontend_url
      }

      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.media.name
      }

      env {
        name  = "GCS_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.payload_secret_accessor,
    google_secret_manager_secret_iam_member.db_password_accessor,
  ]
}

# Public site: allow unauthenticated invocation. This makes the Cloud Run URL
# world-reachable — expected for a public CMS that enforces its own auth on the
# admin panel.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.payload.location
  name     = google_cloud_run_v2_service.payload.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# -----------------------------------------------------------------------------
# Roles for the GitHub Actions (WIF) deploy service account. Gated on
# deploy_service_account_email exactly like the Craft module gates deploy_sa.
# Leave the variable empty to skip these bindings entirely.
# -----------------------------------------------------------------------------
locals {
  deploy_sa_roles = var.deploy_service_account_email == "" ? toset([]) : toset([
    "roles/run.admin",               # deploy/update the Cloud Run service
    "roles/artifactregistry.writer", # push images to Artifact Registry
    "roles/iam.serviceAccountUser",  # act as the runtime SA when deploying
  ])
}

resource "google_project_iam_member" "deploy_sa" {
  for_each = local.deploy_sa_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${var.deploy_service_account_email}"
}
