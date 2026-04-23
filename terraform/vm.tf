locals {
  vm_zone = coalesce(var.vm_zone, "${var.region}-a")
}

data "google_compute_subnetwork" "vm" {
  name    = var.vm_subnetwork_name
  region  = var.region
  project = var.project_id
}

resource "google_compute_instance" "craft" {
  count = var.vm_enabled ? 1 : 0

  name         = "${var.name_prefix}-craft-vm"
  machine_type = var.vm_machine_type
  zone         = local.vm_zone

  tags = ["${var.name_prefix}-craft-vm", "${var.name_prefix}-iap-ssh"]

  boot_disk {
    initialize_params {
      image = var.vm_boot_disk_image
      size  = var.vm_boot_disk_gb
      type  = var.vm_boot_disk_type
    }
  }

  network_interface {
    network    = data.google_compute_network.main.id
    subnetwork = data.google_compute_subnetwork.vm.id
    access_config {}
  }

  service_account {
    email  = google_service_account.app.email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  metadata_startup_script = templatefile("${path.module}/templates/craft-vm-startup.sh.tpl", {
    cloud_sql_connection_name = google_sql_database_instance.craft.connection_name
    craft_git_repo_url        = var.craft_git_repo_url
    project_id                = var.project_id
    db_secret_id              = google_secret_manager_secret.db_password.secret_id
    db_user                   = var.db_user
    db_name                   = var.db_name
    assets_bucket             = google_storage_bucket.assets.name
  })

  dynamic "scheduling" {
    for_each = var.vm_preemptible ? [1] : []
    content {
      preemptible                 = true
      automatic_restart           = false
      provisioning_model          = "SPOT"
      instance_termination_action = "STOP"
    }
  }

  shielded_instance_config {
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  allow_stopping_for_update = true

  depends_on = [
    google_project_service.apis,
    google_sql_database_instance.craft,
  ]
}

resource "google_compute_firewall" "craft_iap_ssh" {
  count   = var.vm_enabled && var.vm_enable_iap_ssh_firewall ? 1 : 0
  name    = "${var.name_prefix}-craft-iap-ssh"
  network = data.google_compute_network.main.name

  description = "SSH via Identity-Aware Proxy (tcp/22 from IAP forwarding range)."

  direction     = "INGRESS"
  priority      = 1000
  source_ranges = ["35.235.240.0/20"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  target_tags = ["${var.name_prefix}-iap-ssh"]

  depends_on = [google_project_service.apis]
}

resource "google_compute_firewall" "craft_http" {
  count   = var.vm_enabled && var.vm_enable_http_firewall ? 1 : 0
  name    = "${var.name_prefix}-craft-http"
  network = data.google_compute_network.main.name

  description = "HTTP to nginx (docker-compose default port)."

  direction     = "INGRESS"
  priority      = 1010
  source_ranges = var.vm_http_source_ranges

  allow {
    protocol = "tcp"
    ports    = [tostring(var.vm_http_port)]
  }

  target_tags = ["${var.name_prefix}-craft-vm"]

  depends_on = [google_project_service.apis]
}
