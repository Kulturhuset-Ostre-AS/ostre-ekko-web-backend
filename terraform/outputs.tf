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
  value = google_storage_bucket.assets.name
}

output "migration_bucket" {
  value = google_storage_bucket.migration.name
}

output "sql_instance_service_account" {
  description = "Cloud SQL instance SA (has objectViewer on migration bucket for imports)."
  value       = google_sql_database_instance.craft.service_account_email_address
}

output "app_service_account_email" {
  value = google_service_account.app.email
}

output "craft_vm_name" {
  description = "GCE instance name when vm_enabled is true."
  value       = var.vm_enabled ? google_compute_instance.craft[0].name : null
}

output "craft_vm_zone" {
  description = "GCE zone short name (e.g. europe-north1-a)."
  value       = var.vm_enabled ? element(reverse(split("/", google_compute_instance.craft[0].zone)), 0) : null
}

output "craft_vm_external_ip" {
  description = "Ephemeral public IPv4 for HTTP until you add a load balancer / static IP."
  value       = var.vm_enabled ? google_compute_instance.craft[0].network_interface[0].access_config[0].nat_ip : null
}

output "craft_vm_ssh_iap_command" {
  description = "SSH via Identity-Aware Proxy (requires IAP permission + gcloud)."
  value = var.vm_enabled ? format(
    "gcloud compute ssh %s --zone=%s --tunnel-through-iap --project=%s",
    google_compute_instance.craft[0].name,
    element(reverse(split("/", google_compute_instance.craft[0].zone)), 0),
    var.project_id,
  ) : null
}

output "craft_vm_url_hint" {
  description = "Suggested browser URL when vm_enable_http_firewall allows your client."
  value       = var.vm_enabled && var.vm_enable_http_firewall ? "http://${google_compute_instance.craft[0].network_interface[0].access_config[0].nat_ip}:${var.vm_http_port}/" : null
}
