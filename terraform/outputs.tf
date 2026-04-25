output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "sql_instance_name" {
  description = "Cloud SQL instance resource name (used in gcloud sql import …)."
  value       = google_sql_database_instance.craft.name
}

output "sql_instance_connection_name" {
  description = "Use with Cloud SQL Auth Proxy: cloud_sql_proxy -instances=CONNECTION_NAME=tcp:3306"
  value       = google_sql_database_instance.craft.connection_name
}

output "sql_private_ip" {
  description = "Private IPv4 of the instance (same VPC / proxy)."
  value       = google_sql_database_instance.craft.private_ip_address
}

output "sql_public_ip" {
  description = "Public IPv4 when sql_public_ip is true; empty otherwise."
  value       = google_sql_database_instance.craft.public_ip_address
}

output "database_name" {
  value = google_sql_database.craft.name
}

output "database_user" {
  value = google_sql_user.craft.name
}

output "database_password" {
  description = "Also stored in Secret Manager secret named in secret_db_password_id."
  value       = random_password.db.result
  sensitive   = true
}

output "secret_db_password_id" {
  value = google_secret_manager_secret.db_password.secret_id
}

output "assets_bucket" {
  description = "Private GCS bucket for Craft media (uploads/). Same resource as media_library_bucket."
  value       = google_storage_bucket.assets.name
}

# Alias for operators who look for “media library” rather than “assets”.
output "media_library_bucket" {
  description = "GCS bucket holding Craft volume files; sync public_html/uploads/ here (see terraform/README.md)."
  value       = google_storage_bucket.assets.name
}

output "media_library_bucket_uri" {
  description = "gs:// URI for scripts (gcloud storage rsync, etc.)."
  value       = google_storage_bucket.assets.url
}

output "migration_bucket" {
  value = google_storage_bucket.migration.name
}

output "app_service_account_email" {
  value = google_service_account.app.email
}
