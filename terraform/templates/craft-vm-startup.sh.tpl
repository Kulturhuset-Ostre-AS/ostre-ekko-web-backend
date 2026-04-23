#!/bin/bash
# Managed by Terraform (template). Installs Docker + Compose and optional Cloud SQL Auth Proxy.
set -eo pipefail
export DEBIAN_FRONTEND=noninteractive
exec > >(tee /var/log/ekko-craft-startup.log) 2>&1

apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl gnupg git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $${VERSION_CODENAME} stable" >/etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker

# Cloud SQL Auth Proxy runs inside Docker (docker-compose.gcp.yml), not on the host — uses the
# VM's attached service account from the container via metadata.

umask 077
cat >/etc/ekko-craft.env <<'ENV'
EKKO_GCP_PROJECT=${project_id}
EKKO_DB_SECRET_ID=${db_secret_id}
EKKO_DB_USER=${db_user}
EKKO_DB_NAME=${db_name}
EKKO_ASSETS_BUCKET=${assets_bucket}
EKKO_CLOUDSQL_CONNECTION=${cloud_sql_connection_name}
ENV
chmod 600 /etc/ekko-craft.env
umask 022

mkdir -p /srv/ekko
cat >/srv/ekko/README.txt <<'READMEOF'
Ekko Craft VM — next steps

Project: ${project_id}
MySQL user: ${db_user}
MySQL database: ${db_name}
Assets bucket: ${assets_bucket}
Config: /etc/ekko-craft.env (no secrets — IDs only)

1) From your laptop (repo root), with TF_STATE_BUCKET + GCP_PROJECT_ID set:
     ./scripts/vm-bootstrap.sh --primary-url http://THIS_VM_IP:8080/

2) Or manually: sync repo to /srv/ekko/app, then:
     sudo bash /srv/ekko/app/scripts/vm/write-cms-env.sh --primary-url http://…/
     cd /srv/ekko/app && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp run --rm php composer install
     sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml --env-file .env.gcp up -d --build

3) Uploads: gcloud storage rsync -r ./public_html/uploads/ gs://${assets_bucket}/uploads/
READMEOF

%{ if craft_git_repo_url != "" ~}
if [[ ! -d /srv/ekko/app/.git ]]; then
  rm -rf /srv/ekko/app
  git clone --depth 1 "${craft_git_repo_url}" /srv/ekko/app || true
fi
%{ endif ~}

echo "Startup finished."
