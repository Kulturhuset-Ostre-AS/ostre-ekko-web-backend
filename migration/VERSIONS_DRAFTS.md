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

1. **Collection config** — add to Events, News, Arena, Artists, Performance:
   `versions: { drafts: { autosave: true }, maxPerDoc: 20 }` (tune count).
2. **Migration** — `payload migrate:create` + run against the cloud DB
   (creates `_<slug>_v` version tables and the `_status` column).
3. **Backfill** — set `_status = 'published'` on all existing docs (classic
   gotcha: pre-existing rows otherwise have no status and can vanish from
   published queries).
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

### Exception — in-flight drafts at final cutover

Revisions are history; **drafts are pending work**. At final migration:

1. Check Craft for active drafts:
   `SELECT ... FROM craft_entries WHERE draftId IS NOT NULL` (recent
   `dateUpdated` first).
2. Preferably: have editors publish or discard them before cutover.
3. Otherwise: import the few that remain as **Payload drafts** — supported
   properly via the API (`?draft=true` on create/update), unlike revisions.
