# Local Payload test environment

A throwaway, self-contained environment to evaluate the Craft → Payload migration:
**Payload 3 + Postgres in Docker**, with the **React Router frontend** repointed at
Payload's GraphQL via an adapter layer (components unchanged).

This is the **"empty Payload, model only"** setup: the content model (collections,
globals, blocks, navigation) is fully defined, but there is no content until you add
it through the Payload admin UI.

## Repos & branches

| Repo | Branch | What changed |
|---|---|---|
| `ostre-ekko-web-backend` | `feat/payload-test-env` | New `migration/payload-app` (Payload 3) + `migration/docker/docker-compose.payload.yml` |
| `ostre-ekko-web-frontend` | `feat/payload-graphql` | `app/service/data/*` rewritten to Payload GraphQL; new `app/service/payload.ts` adapter |

## 1. Start Payload + Postgres

```bash
cd ostre-ekko-web-backend/migration/docker
cp ../payload-app/.env.example ../payload-app/.env     # first time only
docker compose -f docker-compose.payload.yml up --build
```

First boot installs deps and runs Payload's schema push against Postgres (a minute or
two). Then:

- **Admin:** http://localhost:3000/admin — create the first admin user on first load.
- **GraphQL:** http://localhost:3000/api/graphql
- **GraphQL Playground:** http://localhost:3000/api/graphql-playground
- **Generated GraphQL schema:** `migration/payload-app/generated-schema.graphql`
  (regenerated on boot — use it to verify exact type names, see "Caveats").

Stop with `Ctrl-C`; `docker compose ... down -v` wipes the DB volume for a clean slate.

## 2. Add some content

In the admin UI, create at least:
- a couple of **Events** (set `entryType` = event or festival),
- a few **Performance** and **Artists** docs (link them to events),
- one or two **Categories** (group = locations / organizers),
- **News** entries,
- the **Globals** (Homepage, Østre, About, …) and **GlobalInfo** (social links),
- some **NavigationNodes** (the menu).

`craftId` fields are optional here (only used by the full data migration).

## 3. Point the frontend at Payload

```bash
cd ostre-ekko-web-frontend
cp .dev.vars.payload.example .dev.vars
yarn dev      # React Router dev server (http://localhost:5173)
```

`.dev.vars.payload.example` sets `GRAPHQL_API_URL=http://localhost:3000/api/graphql`.
Payload's CORS is configured (in `payload.config.ts` / compose env) to allow
`localhost:5173`.

## How the frontend rewrite works (adapter pattern)

To avoid touching React components, **every component-facing TypeScript interface and
prop shape is unchanged**. The rewrite is confined to `app/service/`:

- `app/service/payload.ts` — shared Payload GraphQL fragments (`MediaFields`,
  `LocationFields`, complexContent block selection) + **reshapers** that convert a
  Payload response back into the Craft-shaped object the components expect
  (`asImageArray`, `reshapeBlocks`, `reshapeLocation`, `firstDoc`).
- `app/service/data/*.ts` — each `fetch*` now sends a Payload query and runs the
  result through the reshapers.

Mapping summary:

| Craft | Payload |
|---|---|
| `entry(section:"events", slug:[$s])` | `Events(where:{slug:{equals:$s}}, limit:1) { docs }` |
| `entries(section:"news", orderBy:"postDate DESC")` | `News(sort:"-postDate") { docs }` |
| `... on event_Entry` inline fragments | flat fields on the collection doc |
| `... on text2_Entry { blockType: typeHandle }` | `... on Text2Block { blockType }` |
| `url(transform:"optimised")` | `sizes { optimised { url } }` |
| `... on locationsCategory_Category {venue room}` | `categories` relationship doc |
| singles `entry(slug:"about")` | Payload **globals** (`About`, `Oestre`, …) |
| Verbb `navigationNodes(level:1)` | `NavigationNodes` collection (nav/order/parent) |
| `entries(search:$q)` full-text | `Events(where:{OR:[{title:{contains}},…]})` (approx.) |

## Verified against a live boot (Payload 3.85.1 / Next 16.2.9)

All 12 frontend queries were run against the running schema and return without
GraphQL errors; a created Event round-trips through the frontend query. The exact
naming Payload generated (already applied in `app/service/`):

- **List vs single query:** the *plural* root field returns `{ docs }` lists; the
  *singular* one fetches by id. Most are `Events`, `Artists`, `Performances`,
  `Categories`, `Tags`, `Arenas` — but News's list is **`allNews`** and Media's is
  **`allMedia`** (Payload prefixes `all` when the singular and plural would collide).
- **Block types** are the PascalCased block slug with **no suffix**: `Text2`, `Video`,
  `Embed`, `ImageBlock` (not `…Block`).
- **Polymorphic relationship fragments** (navigation `reference.value`) use the
  **singular** type names: `... on Event`, `... on Artist`.
- **Search:** richText fields (`intro`/`description`) take JSON filter operators, so
  only the plain-text `title` is `contains`-searchable via GraphQL — search is
  title-only (see search.ts header for the upgrade path).

## Other caveats

1. **Re-verify type names if you change the model.** If you rename collections/blocks,
   re-check `generated-schema.graphql` (written on boot) — the names above are derived
   from collection/block slugs.
2. **Search fidelity.** The Payload search is a `contains` OR over event title/intro/
   description — it does NOT reproduce Craft's relational full-text index (it won't
   find an event by an artist's name). Upgrade to `@payloadcms/plugin-search` or an
   external index if needed. See `PLAN.md`.
3. **Navigation URLs.** `global.ts` derives node URLs from the referenced doc's
   collection + slug (`/program/:slug`, `/news/:slug`, …). Adjust the path prefixes in
   `refToUrl()` to match the real routes.
4. **Rich text.** Payload returns lexical richText as a JSON object via GraphQL, not an
   HTML string. Components that do `dangerouslySetInnerHTML` will need an HTML
   serializer (or query the field's serialized HTML). This is the main known gap for a
   pixel-complete render and is expected for a model-only test env.
5. **Localization.** Both `en` and `nb` locales exist; queries default to `en`. Pass a
   `locale` arg to Payload queries when wiring locale switching.

## File map

```
ostre-ekko-web-backend/migration/
  payload-app/                     # Payload 3 app
    src/collections/               # Events, News, Arena, Artists, Performance,
                                   #   Categories, Tags, Media, NavigationNodes, Users
    src/globals/index.ts           # Homepage, Oestre, EkkoFestivalInfo, About, Legal,
                                   #   Archive, GlobalInfo
    src/blocks/complexContent.ts   # text2 / video / embed / imageBlock blocks
    src/payload.config.ts          # localization, db (postgres), graphql, cors
    src/app/(payload)/             # Next app-router glue (admin + /api/graphql)
  docker/
    docker-compose.payload.yml     # payload + postgres
ostre-ekko-web-frontend/
  app/service/payload.ts           # adapter: fragments + reshapers
  app/service/data/*.ts            # 12 documents, Payload shape
  .dev.vars.payload.example        # GRAPHQL_API_URL -> local Payload
```
