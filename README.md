# Ekko — Craft CMS (backend)

This repository will contain the **Craft CMS** installation that powers content and APIs for the public **Ekko** website: the music festival, the **Østre** venue, and the wider association. **Craft is installed into this directory** (for example with Composer’s official project template); treat this repo as the canonical home for `composer.json`, `config/`, `web/`, and the rest of the Craft tree.

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

After a standard Craft install (for example via Composer’s `craftcms/cms` project), the tree typically matches the ignores already defined in this repo:

| Path | Role |
| ---- | ---- |
| `vendor/` | PHP dependencies (Composer); not committed |
| `web/` | Web root (`index.php`, CP, uploaded assets under `web/assets/`) |
| `storage/` | Runtime files, caches, logs; not fully committed |
| `config/` | Craft configuration (`general.php`, `project/` for Project Config, etc.) |
| `templates/` | Twig templates (if you serve any HTML from Craft) |
| `modules/` | Custom PHP modules |

Until Craft is installed, only shared files (for example `.gitignore` and this README) may be present. When you add Craft, follow [Craft’s installation guide](https://craftcms.com/docs/5.x/install.html) so the application root matches this repository (either run `composer create-project` into this folder from an empty state, or install into a temp directory and move the generated files here, then commit the result).

## Prerequisites

- **PHP** compatible with your target Craft version (see Craft’s requirements for the major version you install)
- **Composer** for PHP dependencies
- A **database** supported by Craft (commonly MariaDB or MySQL; PostgreSQL is supported in recent Craft versions)
- Optional but common for teams: **DDEV**, Laravel Valet, Herd, or another local stack that provides PHP, the database, and a virtual host pointing at `web/`

## Local development

High-level steps (exact commands depend on your stack and Craft version):

1. Install dependencies: `composer install` (after the project is created or cloned with `composer.json` present).
2. Copy `.env.example` to `.env` and set `DB_*`, `PRIMARY_SITE_URL`, and other variables your environment needs.
3. Point the web server document root at **`web/`**, not the repository root.
4. Run Craft’s setup or apply existing Project Config so the database schema and settings match the team’s baseline.
5. Open the control panel URL you configured (often `/admin`) and sign in with an admin account.

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

For Craft-specific behavior, field design, and GraphQL schema design, refer to the [Craft CMS documentation](https://craftcms.com/docs/) for your installed major version.
