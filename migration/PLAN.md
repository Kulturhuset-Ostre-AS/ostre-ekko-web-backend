> ⚠️ **DEPRECATED / HISTORICAL.** This describes the GraphQL export path that was
> **abandoned** (Craft 3 GraphQL would not register entry types on a restored DB).
> The migration was done via **direct SQL** — see **MIGRATION.md** for the real,
> reproducible runbook. This file is kept only for design context.

# Craft 3 → Payload migration plan

Migrate the EKKO / Østre festival backend from the **original Craft 3.7.20** install
to **Payload 3** (MIT, self-hosted), preserving the content model and all content,
keeping the existing React frontend working with minimal query rewrites.

**Source decision:** migrate directly from the **original Craft 3 installation**
(`~/Downloads/api.ekko.no`), not the already-migrated Craft 5 install. We export via
**Craft 3's GraphQL API** by temporarily standing the old app back up in Docker and
restoring its DB dump. This avoids re-doing the 3→4→5 migrations and uses the
canonical original data.

## Source assets (already on disk)

- App + code: `~/Downloads/api.ekko.no/cms` (Craft `3.7.20`, PHP `7.4`)
- **Full DB dump:** `~/Downloads/api.ekko.no/cms/ekko-20260422.sql.gz` (14 MB, 2026-04-22)
- Plugins: `craftcms/redactor 2.8.8`, `verbb/navigation 1.4.21`,
  `verbb/field-manager 2.2.4`, `besteadfast/craft-preparse-field 1.2.5`
- GraphQL: route `api => graphql/api` is enabled; a **Public Schema** with broad
  `:read` scopes already exists in the dump (so export needs no token; we widen it
  to *all* sections after restore to be safe).
- Sites: `en`, `nb`. Sections (11): singles `about archive homepage legal oestre
  ekko_festival_info`; channels `arena events news`; structures `artists performance`.

## Why GraphQL-from-Craft-3 (not the raw SQL)

Craft stores content EAV-style (`content.field_<handle>`, `matrixblocks` +
`matrixcontent_*`, `relations`). GraphQL resolves all of that — relations, assets,
Matrix blocks, localization — into the same shape the frontend already consumes.
We pay a one-time cost to run the legacy app in a container; in return the export
code stays simple and faithful.

## Phases

0. **Stand up Craft 3 in Docker** — `00-craft3-up.sh` builds a PHP 7.4 + Craft 3
   container, restores `ekko-20260422.sql.gz` into a MariaDB 10.x container, and
   serves GraphQL at `http://localhost:8390/api`. (See `docker/` in migration dir.)
1. **Introspect** — `01-introspect-craft.mjs` dumps the Craft 3 GraphQL schema →
   `data/craft-schema.json` (+ SDL). Drives schema generation and validates the
   public schema exposes every section/field.
2. **Generate Payload schema** — `02-generate-collections.mjs` maps Craft types →
   Payload collections/globals/fields/blocks into
   `payload-app/src/collections/_generated/`. **Hand-review** after.
3. **Export data** — `03-export-craft-data.mjs` paginates every section for `en`+`nb`
   → `data/<section>.<locale>.json`, and lists assets → `data/assets.json`.
4. **Scaffold + wire Payload** — `create-payload-app`, GCS storage adapter, wire the
   reviewed generated collections, `payload migrate`.
5. **Transfer assets** — `04-transfer-assets.mjs` copies asset files (from the GCS
   buckets, or the Craft 3 `storage`/volume source) into Payload's media collection.
6. **Import data** — `05-import-to-payload.mjs`, 2-pass: (1) create docs keyed by
   `craftId`; (2) resolve relationship/upload refs by `craftId`. Assets are pass 0.
7. **Verify** — `06-verify.mjs`: per-section counts + field spot checks.
8. **Frontend cutover** — point frontend at Payload GraphQL; adjust differing
   relation/asset field names.

## Type mapping (Craft → Payload)

| Craft field | Payload |
|---|---|
| PlainText | `text` / `textarea` |
| Redactor | `richText` (lexical; HTML imported via converter) |
| Lightswitch | `checkbox` |
| Date | `date` |
| Dropdown | `select` |
| Color | `text` (hex) |
| Assets | `upload` → media collection |
| Entries | `relationship` |
| Categories | `relationship` → categories |
| Tags | `relationship` → tags |
| Link | `group { label, url }` |
| Matrix | `blocks` (one Payload block per Craft Matrix entry type) |
| Preparse | dropped (derived) |

Sites→locales (`en`,`nb`); singles→globals; channels/structures→collections
(structures keep `_parent`/`_order`).

## Run order

```
migration/docker/00-craft3-up.sh                 # restore dump + serve GraphQL :8390
node scripts/01-introspect-craft.mjs             # -> data/craft-schema.json
node scripts/02-generate-collections.mjs         # -> payload-app/src/collections/_generated/
node scripts/03-export-craft-data.mjs            # -> data/*.json
# scaffold payload, review+wire generated collections, run `payload migrate`
node scripts/04-transfer-assets.mjs              # assets -> media (pass 0)
node scripts/05-import-to-payload.mjs            # pass 1 + pass 2
node scripts/06-verify.mjs                        # counts + spot checks
migration/docker/00-craft3-down.sh               # tear down legacy app
```

## migration/.env

```
CRAFT_GRAPHQL_URL=http://localhost:8390/api      # Craft 3 container
CRAFT_GRAPHQL_TOKEN=                              # blank: public schema
PAYLOAD_APP_DIR=./payload-app
GCS_BUCKET=                                       # asset source bucket(s), if used
LOCALES=en,nb
```

## Risks / manual follow-ups

- Legacy app boot: PHP 7.4 + old `vendor/` is pinned via the container image; no
  host PHP needed. `allowAdminChanges`/`devMode` are on in the dump's config — fine
  for a throwaway local instance.
- Redactor→lexical: imported as HTML then converted; embedded media may need fixes.
- Matrix order & structure trees: preserved via block order and `_parent`/`_order`.
- Asset binaries: the dump has asset *metadata* only. Files come from GCS (current)
  or the original volume storage — `04-transfer-assets.mjs` is configurable.
- Confirm the 2026-04-22 dump is current enough, or re-dump before cutover.
