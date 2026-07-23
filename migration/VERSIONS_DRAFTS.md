# Versions, drafts & preview — Craft parity and the Payload decision

Status: **decision pending** (documented 2026-07). Payload currently has **no
versions/drafts enabled** — every save in the admin publishes instantly to the
public site. This doc records what Craft had, what Payload has, and the
recommended path.

## What Craft 3 had (the system we migrated away from)

Craft 3's drafts/revisions/live-preview machinery applied to **entries only**:

| Element type                                   | Drafts | Revisions | Live preview |
|------------------------------------------------|:------:|:---------:|:------------:|
| Entries (events, news, artists, arena, perf.)  |   ✅   | ✅ auto on every save | ✅ |
| Categories (locations, organizers)             |   ❌   |    ❌     |      ❌      |
| Tags                                           |   ❌   |    ❌     |      ❌      |
| Navigation (Verbb plugin nodes)                |   ❌   |    ❌     |      ❌      |
| Globals (about, homepage, festival info, …)    |   ❌   |    ❌     |      ❌      |

Evidence from this install: `craft_entries` held **3,373 event rows for 329
real events** — ~3,000 auto-created revisions. (That machinery is also what
caused the duplicate-slug import bug; `sql-export.mjs` filters
`revisionId IS NULL AND draftId IS NULL`.) Only **canonical** content was
migrated — Craft's old revision history is intentionally not in Payload, so
version history starts fresh whenever it's enabled.

## What Payload has today

- **No versions, no drafts** on any collection: admin save = instantly live on
  the public site. This is a **workflow regression vs Craft** for the
  entry-like collections — editors cannot prepare content without publishing,
  and there is no history/restore.
- **Preview button** (`admin.preview`) and **Live Preview**
  (`admin.livePreview`, in-editor iframe) are wired for Events (events +
  festivals); the frontend integrates via:
  - `RefreshRouteOnSave` → on save, revalidates the route loader
    (authoritative, fully server-resolved render), and
  - a client-only `useLivePreview` bridge → keystroke-level draft updates
    inside the admin iframe (see `app/service/livePreview.tsx` in the
    frontend repo for why the bridge exists — SSR + Rules of Hooks + keeping
    the public site inert).

## Recommendation (Craft parity + close the save-is-live gap)

Enable `versions: { drafts: { autosave: true } }` on the **entry-like**
collections only — exactly the set that had it in Craft:

- **Events** (events + festivals), **News**, **Arena**, **Artists**,
  **Performance** → drafts + autosave + version history.
- **Categories, Tags, NavigationNodes, globals** → leave as-is (save = live).
  This matches Craft exactly; it is parity, not a compromise.

Optional beyond-Craft nicety: **versions _without_ drafts** on
Navigation/Categories (pure edit history/undo; no Publish button, no workflow
change). Craft could not do this. Cheap accident insurance; decide separately.

### Side benefit: simpler live preview

With drafts + autosave enabled, the admin autosaves while typing (~800 ms
interval) and each autosave fires the document event that
`RefreshRouteOnSave` already listens for. The preview then updates
near-keystroke through the pure save-based mechanism — the officially
documented pattern for SSR frontends — and the client-side keystroke bridge
becomes optional (could be removed to simplify).

## Implementation checklist (contained task, same branch)

> **Status (2026-07-23): implemented.** Versions/drafts are enabled on the five
> content collections (`src/versioned.ts`), the schema migration exists
> (`20260723_120354_versions_drafts`), and the import pipeline now maps
> `enabled` → `_status` directly (superseding the backfill in step 3 — a re-import
> sets status on every doc, no post-hoc patching). NEW since this doc was written:
> Craft *drafts* are also imported (decision revised — see "Craft drafts ARE
> imported" below), and preview draft-fetching uses a shared `PREVIEW_SECRET`
> (Terraform secret + `PAYLOAD_PREVIEW_SECRET` on the frontend).

1. **Collection config** — add to Events, News, Arena, Artists, Performance:
   `versions: { drafts: { autosave: true }, maxPerDoc: 20 }` (tune count).
2. **Migration** — `payload migrate:create` + run against the cloud DB
   (creates `_<slug>_v` version tables and the `_status` column).
3. **Backfill** — set `_status` on all existing docs (classic gotcha:
   pre-existing rows otherwise have no status and can vanish from published
   queries). **Not a blanket `'published'`:** the export carried Craft's
   `enabled` flag but `sql-import.mjs` never read it, so ~42 entries that
   were *disabled* (hidden) in Craft were imported as publicly visible docs
   (news ~12, events ~6, artists 4 — plus `en` counterparts; count via
   `"enabled": 0` in `migration/data/sql/*.json`). Backfill
   `'published'` where Craft had `enabled = 1` and `'draft'` where
   `enabled = 0` — docs retain `craftId`, so join against the export JSON.
   This fixes the latent visibility bug and hands editors the hidden
   entries back as drafts. (No Craft *drafts* are in Payload at all —
   `sql-export.mjs` filters `draftId IS NULL` — so this is only about
   the enabled flag.)
4. **Access control** — public reads must exclude drafts, e.g.
   `read: ({ req }) => req.user ? true : { _status: { equals: 'published' } }`.
   Today `read: () => true` would leak drafts to the site.
5. **Frontend** — public queries unchanged (they see published only, via 4).
   Preview/live-preview loaders should request drafts (`draft=true` /
   GraphQL `draft: true`) so editors preview unsaved-published work.
6. **Editors** — communicate the change: **Save = draft, Publish = live**
   (autosave handles the rest). This is the Craft workflow they already know.
7. **Verify** — `sql-verify.mjs` counts still match; a draft edit is invisible
   on the public site until Publish; version restore works in the admin.

## Costs / trade-offs

- New DB tables per collection + version rows (trivial at this scale — Craft
  carried ~3k revisions fine).
- Access-control change is **mandatory** with drafts (step 4) — skipping it
  leaks drafts publicly.
- Editors must press Publish (workflow change, but it *restores* Craft
  behaviour rather than introducing something new).

## Re-import: do NOT import old Craft revisions (decision)

Even once Payload versions are enabled, Craft's ~3k historical revisions stay
out of any (re-)import:

- **API replay can't preserve metadata.** Payload creates versions as a side
  effect of saves; their author/timestamp cannot be set via the API. Every
  imported revision would read "Import user, migration day" — an audit trail
  that lies is worse than none. `maxPerDoc` would prune most of them anyway.
- **Direct inserts into `_<slug>_v` tables are off the table.** They are
  Drizzle-managed internal schema (full relational snapshot per version);
  hand-written rows are fragile and break on Payload upgrades.
- **The archive is the Craft DB itself.** Keep the final Craft SQL dump (and
  the `docker-compose.craft3.yml` recipe) archived — real authors, real
  timestamps, faithful history if archaeology is ever needed. Version history
  in Payload starts fresh at cutover; that is normal for CMS migrations.

### Craft drafts ARE imported (decision revised 2026-07-23)

Revisions are history; **drafts are pending work** — and they are now part of
the standard pipeline, not a cutover exception. `sql-export.mjs` exports them
(`<section>.drafts.<site>.json`, incl. draft-owned matrix blocks/relations) and
`sql-import-drafts.mjs` (pass 3, always last) imports them:

- **Standalone drafts** (`draftOf = null`, never published) → new draft-only
  docs (`?draft=true` create). 36 in the current dump.
- **Saved drafts of published entries** → layered on the imported doc as its
  newest version (`?draft=true` PATCH), keeping the canonical `craftId`; only
  the newest draft per entry (Payload has one working draft). 5 in the dump.
- **Provisional drafts are skipped** (43): Craft's per-user autosave buffers —
  unsaved typing, not deliberately saved content. Editors who need one can
  recover it from the archived Craft DB.

Preview of drafts on the frontend: admin Preview/Live-Preview URLs carry
`?preview=<PREVIEW_SECRET>`; the frontend loader echoes the secret as an
`x-preview-secret` header (unlocking draft reads in `versioned.ts`) and queries
GraphQL with `draft: true`.
