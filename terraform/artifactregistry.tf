# Artifact Registry for prebuilt Craft container images.
# CI builds and pushes; the VM service account only pulls.

resource "google_artifact_registry_repository" "craft" {
  location      = var.region
  repository_id = "${var.name_prefix}-craft"
  format        = "DOCKER"
  description   = "Prebuilt Craft images (php-fpm with vendor baked in, nginx with public_html baked in)."

  depends_on = [google_project_service.apis]
}

resource "google_artifact_registry_repository_iam_member" "app_reader" {
  location   = google_artifact_registry_repository.craft.location
  repository = google_artifact_registry_repository.craft.name
  role       = "roles/artifactregistry.reader"
  member     = google_service_account.app.member
}
