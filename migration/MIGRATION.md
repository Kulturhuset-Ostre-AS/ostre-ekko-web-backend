# Craft 3 → Payload migration runbook

The **authoritative, reproducible** procedure to migrate a fresh Craft 3 DB dump into
Payload. This is the **SQL-based path** that was actually used — it reads Craft's
tables directly and does NOT use Craft's GraphQL.

> ⚠️ The older `01-06` scripts + `PLAN.md` describe a **GraphQL export path that was
> abandoned** (Craft 3's GraphQL wouldn't register entry types on a restored DB).
> Do not use them. The scripts below (`sql-*.mjs`) are the real pipeline.

## What you get

The full dataset migrated with real slugs/titles: events, festivals (with program /
tickets / sections), news, artists, performances, categories, and ~2500 asset files —
relations resolved, rich text converted to Payload lexical (formatting preserved).

## Prerequisites

- **Docker** running.
- **Node 20+** with the migration deps: `cd migration && npm install`
  (installs `node-html-parser` for the rich-text converter).
- A Craft 3 project dir laid out like the original:
  ```
  <root>/cms/            # Craft app: config, vendor, .env, and the *.sql.gz dump
  <root>/public_html/    # web root (index.php) + uploads/photos/... asset files
  ```
  Point the scripts at it with `CRAFT3_SRC=<root>/cms` (default is the Downloads path).
- The Payload app deps installed & buildable (see `TEST_ENV.md`).

## Run order

All commands from `migration/`.

### 0. Bring up Payload (target) + Craft 3 (source)

```bash
# Payload + Postgres (the target)
docker compose -f docker/docker-compose.payload.yml up -d --build

# Craft 3 + MariaDB (the source) — restores the newest *.sql.gz, fixes storage perms,
# and prints entry/asset counts so a bad dump is caught immediately.
CRAFT3_SRC=/path/to/cms bash docker/00-craft3-up.sh
```

Wait until Payload answers (`curl -s -X POST localhost:3000/api/graphql -d '{"query":"{__typename}"}'`)
and 00-craft3-up prints non-zero entry/asset counts.

Create the first Payload admin user once (any email/pw; scripts default to
`test@ekko.no` / `test1234` — override with `SEED_EMAIL` / `SEED_PASSWORD`):
open http://localhost:3000/admin, or let the first script's login auto-register it.

### 1. Export everything from Craft (SQL → JSON)

```bash
node scripts/sql-export.mjs
```
Reads the Craft EAV schema directly and writes `data/sql/*.json`:
entries per section×locale, `_matrix.json` (complexContent/program/tickets/sections),
`_relations.json`, `categories.*.json`, `assets.json`. Install-specific field UID
suffixes are stripped automatically.

### 2. Transfer asset files (Craft → Payload media)

```bash
node scripts/sql-transfer-assets.mjs
```
Fetches each file from the running Craft 3 web server (`/uploads/...`) and uploads to
Payload. Records `data/sql/asset-map.json` (craftId → mediaId). Resumable. ~20 min.

### 3. Import content — pass 1 (create docs)

```bash
node scripts/sql-import.mjs
```
Creates every doc keyed by `craftId` (scalars + rich text via the faithful
HTML→lexical converter). Writes `data/sql/id-map.json`. Resumable.

### 4. Import content — pass 2 (relations + matrix)

```bash
node scripts/sql-import-relations.mjs
```
Patches relationships/uploads (by `craftId` / `asset-map`) and reconstructs the Matrix
fields: `complexContent`, and the festival `program` / `tickets` / `sections`.

### 5. Import content — pass 3 (drafts)

```bash
node scripts/sql-import-drafts.mjs
```
Imports Craft drafts as Payload drafts (must run LAST so the draft is each doc's
newest version): standalone drafts (never published) become draft-only docs;
saved drafts of published entries are layered on top via `draft=true` (newest per
entry). Craft *provisional* drafts (per-user autosave buffers) are skipped.
Throughout all passes, Craft's `enabled` flag maps to `_status`
(`published`/`draft`), so Craft-disabled entries import as drafts.

### 6. Verify

```bash
node scripts/sql-verify.mjs        # counts vs export + media-serve + UNIQUE-SLUG guard
```
Fails (non-zero exit) on count mismatch, media that won't serve, **duplicate
published slugs** (the revision-import regression), or a **draft leak** (an
unauthenticated read seeing more docs than there are published ones).
"verification passed" = safe.

### Re-running the import (only for a re-run, not a first import)

A first import goes into an empty DB. To re-import (e.g. after fixing the export), reset
the content first — this truncates the content collections and clears the content half
of the id-map, but **keeps already-transferred media** so you skip step 2:

```bash
node scripts/sql-reset.mjs          # wipe content, keep media + asset-map
node scripts/sql-import.mjs         # pass 1
node scripts/sql-import-relations.mjs   # pass 2
node scripts/sql-import-drafts.mjs  # pass 3 (drafts — always last)
node scripts/sql-verify.mjs
# (add --with-media to sql-reset + re-run sql-transfer-assets.mjs to also redo media)
```

### 7. Point the frontend at Payload & tear down the source

```bash
cd ../../ostre-ekko-web-frontend && cp .dev.vars.payload.example .dev.vars && yarn dev
# when done with the source:
bash migration/docker/00-craft3-down.sh
```

## Gotchas (learned the hard way — don't re-discover)

1. **Media `staticDir` MUST match the mounted volume.** In `payload-app/src/collections/Media.ts`
   it is `staticDir: 'media-uploads'` → resolves to `/app/media-uploads`, the persistent
   volume. A leading `../` writes to `/media-uploads` (ephemeral) and **files vanish on
   container recreate**. If images 500 with "missing on disk", this is why.

2. **Never `TRUNCATE media CASCADE` in Postgres.** It cascades into events/artists/news
   (they have upload relations) and wipes them. To clear media, delete via the API or
   `TRUNCATE media RESTART IDENTITY` **without** `CASCADE`, and be prepared to re-import.

3. **Recreating the Payload container loses uploaded files unless the volume is correct**
   (see #1). After any `up --force-recreate payload`, re-run step 2 if media 500s.

4. **Field UID suffixes are install-specific.** Craft appends `_<8-char-uid>` to field
   columns reused in field layouts (e.g. `field_venue_elprwjet`). `sql-export.mjs`
   strips these automatically (`cleanFieldName`) so the import is UID-agnostic — a fresh
   dump with different UIDs still works. Don't hardcode UIDs.

5. **Rich text is HTML in Craft, lexical JSON in Payload.** `scripts/html-to-lexical.mjs`
   converts it (bold/italic/links/headings/lists/embeds). It also unescapes literal
   `\r\n` that the JSON export introduces. It only maps tags present in EKKO content;
   exotic markup degrades to plain text.

6. **`craft_entries` includes REVISIONS and DRAFTS — filter them out.** Every saved
   version of an entry is a row in `craft_entries` (with `revisionId`/`draftId` set).
   `sql-export.mjs` filters to canonical entries (`revisionId IS NULL AND draftId IS
   NULL AND dateDeleted IS NULL`); without this you import the whole edit history as
   separate live docs → massively inflated counts (events 3373 vs ~429 real) and
   duplicate slugs, so `/slug` pages render an arbitrary version and edits "don't show."
   Canonical counts: events ~257, artists ~1250, arena ~5 (per nb site).

7. **3 source assets are unrecoverable** (2 DB records point to renamed/missing files,
   1 corrupt TIFF). Expect ~2563/2566.

## One-shot

`bash scripts/run-all.sh` runs steps 1→5 in order (assumes step 0 already done and the
Payload admin user exists). Long-running; watch the logs it writes to `data/sql/*.log`.

## Files

| Script | Role |
|---|---|
| `docker/00-craft3-up.sh` / `-down.sh` | source Craft 3 up/down + restore + perms |
| `docker/docker-compose.craft3.yml` | Craft 3 + MariaDB |
| `docker/docker-compose.payload.yml` | Payload + Postgres (target) |
| `scripts/sql-export.mjs` | Craft DB → JSON |
| `scripts/sql-transfer-assets.mjs` | asset files → Payload media |
| `scripts/sql-import.mjs` | pass 1: create docs |
| `scripts/sql-import-relations.mjs` | pass 2: relations + matrix |
| `scripts/sql-import-drafts.mjs` | pass 3: Craft drafts → Payload drafts (standalone + layered) |
| `scripts/sql-shared.mjs` | shared scalar/relation mappers for the import passes |
| `scripts/sql-verify.mjs` | verification (counts + media-serve + unique-slug guard) |
| `scripts/sql-reset.mjs` | wipe content for a clean re-import (keeps media) |
| `scripts/html-to-lexical.mjs` | shared HTML→lexical converter |
| `scripts/run-all.sh` | orchestrator for steps 1–5 |
| ~~`scripts/01-06*.mjs`, `PLAN.md`~~ | **deprecated** GraphQL path — do not use |
