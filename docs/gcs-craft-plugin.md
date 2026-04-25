# Google Cloud Storage (`craftcms/google-cloud`)

Public asset volumes (**Artist Photos**, **Event Photo**, **Mixtapes**) use Pixel & Tonic’s **[Google Cloud Storage](https://plugins.craftcms.com/google-cloud)** plugin. **User Photos** stay on a **Local** filesystem under `cms/storage/userphotos/`.

## Requirements (from the plugin)

Read the **[plugin README](https://github.com/craftcms/google-cloud/blob/master/README.md)** for full detail. In short:

- The bucket must use **fine-grained (legacy) ACLs**, not **uniform bucket-level access only**.  
  Terraform sets **`assets_bucket_uniform_bucket_level_access = false`** by default on the assets bucket so Craft can manage object visibility.
- For **public** asset URLs, the README recommends granting **`Storage Object Viewer`** to **`allUsers`** on the bucket (or use a tighter model if you front the bucket with a CDN and private objects — then adjust **Base URL** and visibility accordingly).

If an existing bucket was created with **uniform** access enabled, you must either **disable uniform access** (GCP allows this within a limited window after enablement) or **create a new bucket** with legacy ACLs and sync objects into it, then point `GCS_ASSETS_BUCKET` at the new name.

## Environment variables

Set these in **`cms/.env`** (see **`cms/.env.example`**). They are mapped to aliases in **`cms/config/general.php`** (`@gcsProjectId`, `@gcsAssetsBucket`, `@gcsKeyFileJson`, `@gcsAssetBaseUrl`) for use in Project Config.

| Variable | Purpose |
| -------- | ------- |
| `GCP_PROJECT_ID` | GCP project id. |
| `GCS_ASSETS_BUCKET` | Bucket name (no `gs://`). |
| `GCS_KEY_FILE_JSON` | **Minified** JSON for a service account key with rights to read/write objects (e.g. **Storage Admin** on that bucket). Leave **empty** on **GCE** when the VM uses the Terraform **app** service account and [ADC](https://cloud.google.com/docs/authentication/application-default-credentials) applies. |
| `GCS_ASSET_BASE_URL` | Public base URL for objects, **no trailing slash**, e.g. `https://storage.googleapis.com/ekko-assets-xxxx`. Craft appends each filesystem **Subfolder** (`uploads/photos/artists`, etc.). |

Object layout under the bucket matches the old local layout: **`uploads/photos/artists`**, **`uploads/photos/events`**, **`uploads/mixtapes`** — compatible with an earlier **`gcloud storage rsync`** seed.

## Install / apply

```bash
cd cms
composer install
php craft plugin/install google-cloud   # if not already applied from Project Config
php craft up
```

After changing **`cms/config/project/project.yaml`**, deploy with **`php craft project-config/apply`** on each environment (or let your deploy pipeline run it).

## Local development

Docker Compose does not mount GCP credentials by default. Either:

- Put **`GCS_KEY_FILE_JSON`** (or **`GOOGLE_APPLICATION_CREDENTIALS`** pointing at a key file) in **`cms/.env`**, **or**  
- Run against a **dev** bucket with a dedicated key.

Without valid GCP settings, the CP **Assets** area for those volumes will not work.

## Terraform

The **assets** bucket resource uses **`assets_bucket_uniform_bucket_level_access`** (default **`false`**). See **`terraform/variables.tf`** and **`terraform/README.md`**.

## Related docs

- [GCP bring-up checklist](gcp-bring-up.md) (Terraform, `gcloud storage rsync`, SQL import)
- [Local media sync](local-media-sync.md) (disk + optional rsync — still relevant for **User Photos** and for **seeding** the bucket)
- [GCP VM + Docker](gcp-vm-docker-deploy.md)
