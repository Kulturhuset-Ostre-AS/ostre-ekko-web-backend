#!/usr/bin/env bash
# =============================================================================
# Convenience: roll a freshly built image onto the Payload Cloud Run service.
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │ PRIMARY DEPLOY PATH IS TERRAFORM.                                         │
# │ Normally you set the `payload_image` variable in terraform-payload/ and   │
# │ `terraform apply`. Terraform owns the service definition: env vars,       │
# │ secrets (PAYLOAD_SECRET, DATABASE_URI, ...), the Cloud SQL connection,    │
# │ the service account, and scaling. That is the source of truth.           │
# │                                                                           │
# │ This script is an ALTERNATIVE for image-only rollouts (e.g. a quick CI    │
# │ redeploy) when you are NOT threading the image through the Terraform var. │
# │ It only swaps the container image and leaves all other config as-is on    │
# │ the already-provisioned service.                                          │
# └─────────────────────────────────────────────────────────────────────────┘
#
# Usage:
#   PROJECT_ID=my-proj \
#   IMAGE=europe-north1-docker.pkg.dev/my-proj/ekko-payload/payload:abc1234 \
#   ./deploy/payload/deploy-cloud-run.sh
#
# Env vars / args:
#   PROJECT_ID  (required)  GCP project id
#   IMAGE       (required)  full Artifact Registry image ref, INCLUDING the tag
#   REGION      (optional)  defaults to europe-north1
#   SERVICE     (optional)  defaults to ekko-payload
#
# No secrets are hardcoded or passed here; secrets live in Secret Manager and are
# wired to the service by Terraform.
# =============================================================================
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
IMAGE="${IMAGE:?set IMAGE to the full Artifact Registry ref including :tag}"
REGION="${REGION:-europe-north1}"
SERVICE="${SERVICE:-ekko-payload}"

echo "Deploying image to Cloud Run:"
echo "  project : ${PROJECT_ID}"
echo "  region  : ${REGION}"
echo "  service : ${SERVICE}"
echo "  image   : ${IMAGE}"

# --image-only rollout. Everything else (env, secrets, Cloud SQL, SA, scaling)
# stays as configured by Terraform on the existing service revision.
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}"

echo "Done. New revision serving image: ${IMAGE}"
