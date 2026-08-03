# Ekko — Craft CMS (backend)

This repository contains the **Craft CMS** installation that powers content and APIs for the public **Ekko** website: the music festival, the **Østre** venue, and the wider association. It runs **headless** (no Twig templates) and serves content to the frontend over **GraphQL**. The tree keeps the **legacy hosting layout** (`cms/` application root + `public_html/` web root) so paths match the original production install.

**Current stack:** Craft CMS **5.9** · PHP **8.2** · MySQL (Cloud SQL) · assets on **Google Cloud Storage** · deployed as Docker on a **GCP VM** behind a **Cloudflare Tunnel**. See [Status & roadmap](#status--roadmap) for what has been done and what remains.

On GitHub it lives alongside the public site:

| Repository | Role |
| ---------- | ---- |
| [Kulturhuset-Ostre-AS/ostre-ekko-web-backend](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-backend) | This repo — Craft CMS |
| [Kulturhuset-Ostre-AS/ostre-ekko-web-frontend](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend) | React Router frontend (SSR on Cloudflare Pages) |

For local work, cloning both repos into the same parent folder is convenient (for example `../ostre-ekko-web-frontend`). The frontend consumes this CMS (for example via Craft’s **GraphQL** API) and does not duplicate editorial content.

## Table of contents

- [GitHub](#github)
- [Status & roadmap](#status--roadmap)
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

## Status & roadmap

### Snapshot (2026-08-03)

The Craft→Payload replacement (branch `feat/payload-cloud-deploy`, both repos)
is feature-complete and running on test domains; Craft still serves production
until cutover:

- **Payload CMS live** at https://admin.ekko.no (Cloud Run, permanent domain);
  test frontend at https://framtid.ekko.no (Cloudflare Pages, password-gated,
  noindex). Full content re-import verified incl. drafts/versions, Live
  Preview, and code-owned translated menus.
- **Commerce implemented** (mock payments until a Vipps MobilePay agreement
  exists): season-based memberships (frontend #7 + client doc) and a ticket
  shop — ticket types on events/festivals with venue-capacity defaults,
  customer accounts (shared member/ticket account, member↔customer link),
  signed QR tickets, door scanner at `/skann`, printable CR80 member cards,
  sales reports at `/admin/rapporter`, Apple/Google Wallet prepared
  (env-gated, awaiting credentials). See
  [docs/medlemskapssalg-plan.md](docs/medlemskapssalg-plan.md).
- **Transactional email live** via Resend (domain `send.ekko.no`, EU region):
  membership receipts and admin password resets verified delivered.
- **Localization done**: nb/en locales with localized rich text, plus an
  editor-triggered machine-translation button («Oversett fra norsk (utkast)»,
  Google Cloud Translation) that saves EN as a draft only (frontend #17).
- **Client design wishes (Olav's Miro board) implemented 2026-08-03** — see
  [docs/design/miro-ekkonettside/README.md](docs/design/miro-ekkonettside/README.md):
  structured event info (doors open / start / end / age limit / practical
  info), free-text set-times field («spilleplan»), per-venue doors-open rows
  in festival schedules, the festival ticket page grouped into three
  dropdowns (festival pass / day pass / single tickets) with structured
  fields, and the archive with year sorting + fanzine image view. Editors
  fill the new fields in admin; demo values live on framtid.
- **Remaining before cutover:** Vipps agreement (KYC lead time), editor
  accounts/roles + comms, final re-dump/re-import (with the fixed base64
  export), DNS switch, `categories` → locations/organizers split (see the
  cleanup section of the membership plan), Workers Paid plan for the heavy
  SSR pages (Cloudflare error 1102).

Snapshot of where the backend stands. Items map to git history in this repo and to issues in the sibling **frontend** repo (this repo currently has no issues of its own — backend tasks are tracked there with the **`backend`** label).

### Done

- **Craft upgrade to 5.9.** Migrated from the legacy Craft 3.7 install (`3.7.20 → 3.7.68 → 3.9.15 → 5.9`) on **PHP 8.2**, with a compatible plugin stack. See [docs/craft-post-upgrade-audit.md](docs/craft-post-upgrade-audit.md).
- **Headless mode.** Server-rendered Twig removed; the frontend consumes content over GraphQL only (`cms/templates/` is empty, legacy URL routes dropped).
- **GraphQL API contract stabilised.** Endpoint `POST /api`, private-token auth, `sectionId` → `sectionAnchorId` field rename, Craft 5 entry-type / matrix naming. Documented in [docs/graphql-frontend-migration.md](docs/graphql-frontend-migration.md).
- **Assets on Google Cloud Storage.** Public asset volumes moved from local FS to GCS via the `craftcms/google-cloud` plugin. See [docs/gcs-craft-plugin.md](docs/gcs-craft-plugin.md).
- **Database on Cloud SQL (MySQL).** Local dump import path documented in [docs/cloud-sql-import.md](docs/cloud-sql-import.md).
- **GCP infrastructure as code.** Terraform baseline (Cloud SQL, GCS buckets, IAM, Secret Manager, VPC peering) under `terraform/`.
- **Containerised production deploy.** Prebuilt PHP/nginx images via Cloud Build, deployed as Docker on a GCE VM (cloud-init + systemd) behind a **Cloudflare Tunnel**, with CP requests trusting Cloudflare forwarded headers. See [docs/gcp-vm-docker-deploy.md](docs/gcp-vm-docker-deploy.md) and [docs/gcp-bring-up.md](docs/gcp-bring-up.md).
- **Bilingual site structure.** Two sites in the **EKKO** site group — `nb` (`nb-NO`, primary, root URL) and `en` (`en`, `/en/`) — with per-field translation settings already configured.

### In progress / planned

Backend-relevant work tracked as frontend-repo issues:

- **Editor control over the colour profile** — let editors change site colours from the CP for both the Østre and Ekko sites. ([frontend #6](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend/issues/6), label `backend`)
- **Editable Østre front-page image** — backend support for changing the Østre homepage cover image. ([frontend #5](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend/issues/5), label `backend`)
- **English version of the site (editorial workflow)** — the bilingual *structure* exists; remaining work is making it easy for editors to author/maintain EN content, ideally with a way to copy the NO entry as a starting point or **suggested machine translations** that can be confirmed/edited. No translation plugin is installed yet. ([frontend #17](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend/issues/17))
- **Membership system for Ekko / Østre** — sales, registration and admin of memberships (payment, confirmation e-mail, member register, CSV export, GDPR consent). The issue lists explicit **backend** requirements (edit price/description, export list, add/edit members, active/expired status). ([frontend #7](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend/issues/7), label `medlemskapssystem`)

### Watch list (maintenance, not blocking)

From the [post-upgrade audit](docs/craft-post-upgrade-audit.md):

- **`composer audit`** advisory on `google/protobuf` (`CVE-2026-6409`, pulled in via Google client libs) — track upstream bumps.
- **Abandoned Composer packages**: `aelvan/mailchimp-subscribe`, `craftcms/redactor` (Craft suggests **CKEditor**), `google/crc32` — plan replacements on your own timeline.
- **`cms/config/project__backup/`** — pre-upgrade Project Config copy, not loaded by Craft; safe to delete or gitignore.
- **`modules/ekkomodule`** — headers still say “Craft 3.x”; only matters if that helper code is touched. Irrelevant to headless GraphQL.

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

Installed **Craft 5.9** (see `cms/composer.json` / `cms/composer.lock`). Reference: [Craft CMS 5.x docs](https://craftcms.com/docs/5.x/). The repo was migrated from the original Craft 3.7 install — see the git history (`3.7.20 → 3.9.15 → 5.9`) and [docs/craft-post-upgrade-audit.md](docs/craft-post-upgrade-audit.md).

## Prerequisites

- **PHP** compatible with your target Craft version (see Craft’s requirements for the major version you install)
- **Composer** for PHP dependencies
- A **database** supported by Craft (commonly MariaDB or MySQL; PostgreSQL is supported in recent Craft versions)
- Optional but common for teams: **DDEV**, Laravel Valet, Herd, or another local stack that provides PHP, the database, and a virtual host pointing at **`public_html/`** (not the repo root).

## Local development

1. **PHP 8.2** (matches `composer.json` `platform.php` and the Docker images) is required for **Craft 5**.
2. Install dependencies from the **`cms/`** directory:

   ```bash
   cd cms && composer install
   ```

3. Copy **`cms/.env.example`** to **`cms/.env`** and set `DB_*`, `SECURITY_KEY`, `SITE_URL`, and any other variables your environment needs.
4. Point the web server document root at **`public_html/`** (same as legacy production).
5. Import a database dump and sync **`public_html/uploads/`** (and optionally **`public_html/imager/`**) if you need assets locally — see [`docs/database-export.md`](docs/database-export.md) and [`docs/local-media-sync.md`](docs/local-media-sync.md).
6. Open the control panel (this project uses trigger **`admin`**, not `/cp` — see `cms/config/general.php`).

**Docker on a VM:** see [`docker/README.md`](docker/README.md) and root [`docker-compose.yml`](docker-compose.yml) (nginx + PHP 8.2 FPM; optional MariaDB profile for local DB). Production deploy is documented in [docs/gcp-vm-docker-deploy.md](docs/gcp-vm-docker-deploy.md).

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
