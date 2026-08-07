# Committed, NON-SECRET configuration for the Payload stack. Terraform loads
# this automatically (auto.tfvars) both locally and in CI, so `terraform plan`
# gives the same result everywhere. The only secret (resend_api_key) lives in
# the gitignored terraform.tfvars locally and in the RESEND_API_KEY GitHub
# secret for the payload-terraform workflow.
#
# NOTE: the Payload stack lives in its OWN project `ekko-payload`, not in
# the Craft project.

project_id = "ekko-payload"
region     = "europe-north1"

# Built 2026-08-02 from commit caa5749 (medlemskort + konto-kobling).
# CI can override per-run via the workflow's payload_image input (-var wins).
payload_image = "europe-north1-docker.pkg.dev/ekko-payload/ekko-payload/payload:qrurl-538f308"

# Custom domains: admin.ekko.no = permanent admin/API domain,
# payload-api.ekko.no = customer-facing API (same service, separate host so
# the customer auth cookie cannot clash with the admin cookie).
admin_domain        = "admin.ekko.no"
customer_api_domain = "payload-api.ekko.no"

payload_public_server_url = "https://admin.ekko.no"
frontend_url              = "https://framtid.ekko.no"
payload_cors              = "https://ekko-payload-2zgt2gy4iq-lz.a.run.app,https://admin.ekko.no,https://feat-payload-cloud-deploy.ekko-payload-frontend.pages.dev,https://framtid.ekko.no,http://localhost:5173"

email_from = "medlem@send.ekko.no"

# Skalering (2026-08-07): min 1 varm instans — med min=0 ga kaldstarter
# «Rate exceeded» (429 fra Google Frontend) og 502 via framtid-gaten så snart
# en sidelasting sendte 30–50 samtidige kall. max 4 tar unna bursts.
cloud_run_min_instances = 1
cloud_run_max_instances = 4
