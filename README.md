# Ekko — Craft CMS (backend)

This repository contains the **Craft CMS** installation that powers content and APIs for the public **Ekko** website: the music festival, the **Østre** venue, and the wider association. The tree follows the **legacy hosting layout** (`cms/` application root + `public_html/` web root) migrated from classic PHP hosting so paths match production while you patch and plan upgrades.

On GitHub it lives alongside the public site:

| Repository | Role |
| ---------- | ---- |
| [Kulturhuset-Ostre-AS/ostre-ekko-web-backend](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-backend) | This repo — Craft CMS |
| [Kulturhuset-Ostre-AS/ostre-ekko-web-frontend](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend) | React Router frontend (SSR on Cloudflare Pages) |

For local work, cloning both repos into the same parent folder is convenient (for example `../ostre-ekko-web-frontend`). The frontend consumes this CMS (for example via Craft’s **GraphQL** API) and does not duplicate editorial content.

## Table of contents

- [GitHub](#github)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
- [Environment](#environment)
- [Security and secrets](#security-and-secrets)
- [Editorial and API usage](#editorial-and-api-usage)
- [GraphQL frontend migration](docs/graphql-frontend-migration.md)
- [Craft post-upgrade audit](docs/craft-post-upgrade-audit.md)
- [Local media sync (uploads / Imager)](docs/local-media-sync.md)
- [GCP VM: Docker same as local](docs/gcp-vm-docker-deploy.md)
- [Google Cloud Storage + Craft (`google-cloud` plugin)](docs/gcs-craft-plugin.md)
- [Import local MySQL dump into Cloud SQL](docs/cloud-sql-import.md)
- [GCP bring-up checklist (Terraform + GCS + SQL + Craft)](docs/gcp-bring-up.md)

## GitHub

- **This project**: [github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-backend](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-backend)
- **Sibling frontend**: [github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend)

Create the backend repository in the **Kulturhuset-Ostre-AS** organization if it does not exist yet, then push this working copy as `origin`. Keep deploy keys, Actions secrets, and environment-specific values out of git (see [Environment](#environment)).

## Architecture

```
Editors  ──▶  Craft CMS (this repo)  ──▶  GraphQL / HTTP APIs
                              │
                              ▼
                    ostre-ekko-web-frontend
                    (SSR site, Cloudflare Pages)
```

Craft is the **system of record** for structured content, assets, and global settings. The frontend remains a separate deployable that only talks to Craft over the network.

## Repository layout

| Path | Role |
| ---- | ---- |
| `cms/composer.json` / `cms/vendor/` | PHP dependencies (Composer); `vendor/` is not committed |
| `cms/config/` | Craft configuration (`general.php`, `project/` Project Config, etc.) |
| `cms/storage/` | Runtime (logs, cache, etc.); only empty dirs + `.gitignore` patterns are committed |
| `cms/templates/` | Twig templates |
| `cms/modules/` | Custom PHP modules (for example `ekkomodule`) |
| `public_html/` | Web root (`index.php`, static assets, **volumes map under `public_html/uploads/`** on production) |
| `terraform/` | GCP baseline (Cloud SQL, GCS, IAM); see `terraform/README.md` |

Large or generated paths (`public_html/uploads/`, `public_html/imager/`, `public_html/cpresources/`) are **gitignored**; sync them from your backup or GCS when running locally.

Installed **Craft 3.7.20** (see `cms/composer.json`). Upgrade documentation starts at [Craft CMS 3.x](https://craftcms.com/docs/3.x/).

## Prerequisites

- **PHP** compatible with your target Craft version (see Craft’s requirements for the major version you install)
- **Composer** for PHP dependencies
- A **database** supported by Craft (commonly MariaDB or MySQL; PostgreSQL is supported in recent Craft versions)
- Optional but common for teams: **DDEV**, Laravel Valet, Herd, or another local stack that provides PHP, the database, and a virtual host pointing at **`public_html/`** (not the repo root).

## Local development

1. **PHP 7.4** (or the lowest version you deploy) is appropriate for **Craft 3.7**; newer PHP may not be supported until you upgrade Craft.
2. Install dependencies from the **`cms/`** directory:

   ```bash
   cd cms && composer install
   ```

3. Copy **`cms/.env.example`** to **`cms/.env`** and set `DB_*`, `SECURITY_KEY`, `SITE_URL`, and any other variables your environment needs.
4. Point the web server document root at **`public_html/`** (same as legacy production).
5. Import a database dump and sync **`public_html/uploads/`** (and optionally **`public_html/imager/`**) if you need assets locally — see [`docs/database-export.md`](docs/database-export.md) and [`docs/local-media-sync.md`](docs/local-media-sync.md).
6. Open the control panel (this project uses trigger **`admin`**, not `/cp` — see `cms/config/general.php`).

**Docker on a VM:** see [`docker/README.md`](docker/README.md) and root [`docker-compose.yml`](docker-compose.yml) (nginx + PHP 7.4 FPM; optional MariaDB profile for local DB).

For day-to-day work, use Craft’s documented workflows for migrations, Project Config, and backups rather than editing production data directly.

## Environment

- **`.env`** holds environment-specific values and must not be committed (see `.gitignore`).
- **`.env.example`** should list every variable the app expects, with safe placeholder values, so new developers can bootstrap quickly.

Typical categories of settings:

- Database connection (`DB_DSN` or discrete `DB_*` fields, depending on your `.env` style)
- `SECURITY_KEY` (see below)
- Base URL / site handle settings used by Craft for CP links and absolute URLs

Regenerate or rotate secrets when credentials leak; coordinate with whoever operates the frontend so `GRAPHQL_TOKEN` (or equivalent) stays in sync if you use token-based API access.

## Security and secrets

- Generate a strong **`SECURITY_KEY`** for each environment (Craft’s CLI can output one, or use a long random string from your secrets manager).
- Restrict **GraphQL** (and other APIs) with appropriate schemas, tokens, and query complexity limits; the public site should use least-privilege tokens scoped to read-only operations where possible.
- Never commit **`.env`**, database dumps with personal data, or full `storage/` trees.

## Editorial and API usage

- **Control panel**: content editors manage entries, assets, navigation, and globals according to your field layouts and sections.
- **GraphQL**: the frontend repo documents how it queries Craft (`GRAPHQL_API_URL`, `GRAPHQL_TOKEN`). Any schema or token changes on this side should be reflected in frontend configuration and CI secrets.
- **Frontend migration (Craft 5 / headless):** see [docs/graphql-frontend-migration.md](docs/graphql-frontend-migration.md) for endpoint, auth, **`sectionId` → `sectionAnchorId`**, and video URL field changes.
- **Backend audit trail:** see [docs/craft-post-upgrade-audit.md](docs/craft-post-upgrade-audit.md) for routes, Composer advisories, and leftover folders.

For Craft-specific behavior, field design, and GraphQL schema design, refer to the [Craft CMS documentation](https://craftcms.com/docs/) for your installed major version.
