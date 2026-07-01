output "cloud_run_url" {
  description = "Public HTTPS URL of the Payload Cloud Run service."
  value       = google_cloud_run_v2_service.payload.uri
}

output "media_bucket" {
  description = "GCS bucket the storage-gcs plugin writes Payload uploads to."
  value       = google_storage_bucket.media.name
}

output "sql_instance_connection_name" {
  description = "Cloud SQL instance connection name (PROJECT:REGION:INSTANCE). Used by the Cloud SQL Auth Proxy socket /cloudsql/<connection_name>."
  value       = google_sql_database_instance.pg.connection_name
}

output "sql_instance_name" {
  description = "Cloud SQL Postgres instance resource name."
  value       = google_sql_database_instance.pg.name
}

output "db_password_secret" {
  description = "Secret Manager secret ID holding the Postgres app password (value NOT exposed)."
  value       = google_secret_manager_secret.db_password.secret_id
}

output "payload_secret_secret" {
  description = "Secret Manager secret ID holding PAYLOAD_SECRET (value NOT exposed)."
  value       = google_secret_manager_secret.payload_secret.secret_id
}

output "artifact_registry_repo" {
  description = "Artifact Registry Docker repository for the Payload image."
  value       = google_artifact_registry_repository.payload.name
}
