#!/usr/bin/env bash
# One-time bootstrap: wire GitHub Actions → GCP via Workload Identity Federation,
# so anyone with Actions access on this repo can run .github/workflows/deploy-craft.yml
# (and cloud-sql-import.yml / terraform-gcp.yml).
#
# What it does (idempotent — safe to re-run):
#   1. Enables required GCP APIs.
#   2. Creates Workload Identity Pool `github-actions` + GitHub OIDC provider pinned
#      to THIS repo (attribute-condition: assertion.repository == …).
#   3. Creates deploy service account `github-deploy@PROJECT.iam.gserviceaccount.com`.
#   4. Grants the SA roles/owner on the project (so it can `terraform apply` the full
#      stack and SSH the VM via IAP). Tighten with a GitHub Environment if you want
#      reviewer-gated prod deploys.
#   5. Lets that single repo impersonate the SA via WIF
#      (roles/iam.workloadIdentityUser on the SA, scoped to this repo).
#   6. Uploads the four identifiers to GitHub:
#        vars:    GCP_PROJECT_ID
#        secrets: GCP_WIF_PROVIDER, GCP_WIF_SERVICE_ACCOUNT, TF_STATE_BUCKET
#
# Prerequisites (run once by a project owner — admin@ekko.no):
#   gcloud auth login admin@ekko.no
#   gh auth login
#
# Usage:
#   TF_STATE_BUCKET=ostre-ekko-web-backend-tfstate ./scripts/bootstrap-github-deploy.sh
#
# Optional env:
#   GCP_PROJECT_ID  (default: ostre-ekko-web-backend)
#   POOL_ID         (default: github-actions)
#   PROVIDER_ID     (default: github)
#   SA_ID           (default: github-deploy)
#   GH_REPO         (default: auto-detected via `gh repo view`)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/gcp.sh
source "${SCRIPT_DIR}/lib/gcp.sh"

gcp_unset_shell_account_override

GCP_PROJECT_ID="${GCP_PROJECT_ID:-ostre-ekko-web-backend}"
POOL_ID="${POOL_ID:-github-actions}"
PROVIDER_ID="${PROVIDER_ID:-github}"
SA_ID="${SA_ID:-github-deploy}"
SA_EMAIL="${SA_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

if [[ -z "${TF_STATE_BUCKET:-}" ]]; then
  echo "Set TF_STATE_BUCKET (e.g. TF_STATE_BUCKET=${GCP_PROJECT_ID}-tfstate)." >&2
  exit 1
fi

if [[ -z "${GH_REPO:-}" ]]; then
  GH_REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi
echo ">> Binding WIF to GitHub repo: ${GH_REPO}"

GCLOUD=(gcloud --project="${GCP_PROJECT_ID}" --account="${GCLOUD_TF_ACCOUNT}" --quiet)

echo ">> Enabling required APIs"
"${GCLOUD[@]}" services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  iap.googleapis.com

echo ">> Ensuring Workload Identity Pool '${POOL_ID}'"
if ! "${GCLOUD[@]}" iam workload-identity-pools describe "${POOL_ID}" --location=global >/dev/null 2>&1; then
  "${GCLOUD[@]}" iam workload-identity-pools create "${POOL_ID}" \
    --location=global \
    --display-name="GitHub Actions"
fi

POOL_NAME="$("${GCLOUD[@]}" iam workload-identity-pools describe "${POOL_ID}" --location=global --format='value(name)')"

echo ">> Ensuring OIDC provider '${PROVIDER_ID}' (pinned to ${GH_REPO})"
PROVIDER_ARGS=(
  --location=global
  --workload-identity-pool="${POOL_ID}"
  --display-name="github-oidc"
  --issuer-uri="https://token.actions.githubusercontent.com"
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref"
  --attribute-condition="assertion.repository == '${GH_REPO}'"
)
if "${GCLOUD[@]}" iam workload-identity-pools providers describe "${PROVIDER_ID}" \
    --location=global --workload-identity-pool="${POOL_ID}" >/dev/null 2>&1; then
  "${GCLOUD[@]}" iam workload-identity-pools providers update-oidc "${PROVIDER_ID}" "${PROVIDER_ARGS[@]}"
else
  "${GCLOUD[@]}" iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" "${PROVIDER_ARGS[@]}"
fi

PROVIDER_NAME="$("${GCLOUD[@]}" iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --location=global --workload-identity-pool="${POOL_ID}" --format='value(name)')"

echo ">> Ensuring service account ${SA_EMAIL}"
if ! "${GCLOUD[@]}" iam service-accounts describe "${SA_EMAIL}" >/dev/null 2>&1; then
  "${GCLOUD[@]}" iam service-accounts create "${SA_ID}" \
    --display-name="GitHub Actions deploy (${GH_REPO})"
fi

echo ">> Granting roles/owner on ${GCP_PROJECT_ID} to ${SA_EMAIL}"
# Broad because the deploy runs `terraform apply` over the whole stack (Cloud SQL, VPC,
# IAM, Secret Manager, GCE). Narrow later by replacing with the specific roles the
# workflow needs, or gate the workflow behind a GitHub Environment with reviewers.
"${GCLOUD[@]}" projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/owner" \
  --condition=None >/dev/null

echo ">> Binding GitHub repo ${GH_REPO} → ${SA_EMAIL} (roles/iam.workloadIdentityUser)"
PRINCIPAL_SET="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${GH_REPO}"
"${GCLOUD[@]}" iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="${PRINCIPAL_SET}" >/dev/null

echo ">> Uploading identifiers to GitHub repo ${GH_REPO}"
gh variable set GCP_PROJECT_ID      --repo "${GH_REPO}" --body "${GCP_PROJECT_ID}"
gh secret   set GCP_WIF_PROVIDER    --repo "${GH_REPO}" --body "${PROVIDER_NAME}"
gh secret   set GCP_WIF_SERVICE_ACCOUNT --repo "${GH_REPO}" --body "${SA_EMAIL}"
gh secret   set TF_STATE_BUCKET     --repo "${GH_REPO}" --body "${TF_STATE_BUCKET}"

cat <<EOF

Done. GitHub → GCP bridge is live:

  Provider : ${PROVIDER_NAME}
  Service account : ${SA_EMAIL}
  Project  : ${GCP_PROJECT_ID}
  TF state : gs://${TF_STATE_BUCKET}

Anyone with "Actions: write" on ${GH_REPO} can now:
  Actions → deploy-craft → Run workflow

To restrict that, add a GitHub Environment (e.g. 'production') with required
reviewers and reference it from the workflow job (\`environment: production\`).
EOF
