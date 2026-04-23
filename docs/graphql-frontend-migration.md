# GraphQL — frontend migration notes

This document lists **contract changes** frontends must respect when talking to this Craft CMS instance after the **Craft 5 / headless** upgrade and related Project Config updates. It is aimed at the **ostre-ekko-web-frontend** (or any other API consumer), not at Craft CP users.

Official reference: [GraphQL API (Craft 5)](https://craftcms.com/docs/5.x/development/graphql.html).

---

## 1. HTTP endpoint

| Item | Detail |
|------|--------|
| **Path** | `POST /api` (site URL rule in `cms/config/routes.php` → `graphql/api`) |
| **Full URL** | `{SITE_URL}api` with **no** extra path segment — e.g. `https://cms.example.com/api` or `http://localhost:8080/api` |
| **Method** | `POST` |
| **Headers** | `Content-Type: application/json` |
| **Body** | JSON object with at least `query` (string). Optional: `variables` (object), `operationName` (string). |

Example:

```http
POST /api HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Authorization: Bearer <your-token>

{"query":"{ ping }"}
```

---

## 2. Authentication

| Item | Detail |
|------|--------|
| **Project setting** | Public GraphQL token is **disabled** (`cms/config/project/graphql/graphql.yaml`: `publicToken.enabled: false`). |
| **Requirement** | Clients must send a **private GraphQL token** issued in the Control Panel. |
| **Header** | `Authorization: Bearer <token>` |

Create or rotate tokens under **Settings → GraphQL → Tokens** (or **GraphQL → Tokens** depending on CP layout). Assign each token to the correct **schema** so only allowed sections and fields are exposed.

**Infrastructure note:** On nginx + PHP-FPM, the `Authorization` header must reach PHP (this repo’s `docker/nginx/default.conf` sets `fastcgi_param HTTP_AUTHORIZATION $http_authorization;`). If production returns “Missing Authorization header” while the header is set, check the same for your host’s nginx/Apache config.

**Control Panel GraphiQL** (`/admin/graphiql`) uses session auth and `X-Craft-Gql-Schema`; it is **not** the same code path as `/api` for anonymous clients.

---

## 3. Field rename: `sectionId` → `sectionAnchorId` (breaking)

### What went wrong

Craft’s GraphQL **`EntryInterface`** already exposes **`sectionId: Int!`** (Craft’s internal section primary key). A **custom Plain Text** field was also named **`sectionId`**, which GraphQL would expose as **`String`**. That violates the interface contract and breaks **schema introspection** (including GraphiQL).

### What we did

The custom field (same field UID, new handle) was renamed to **`sectionAnchorId`**. It still holds the **human / anchor** value used for in-page links (e.g. `#…` in festival sub-navigation), not Craft’s numeric section id.

### What the frontend must do

| Old (invalid in schema) | New |
|-------------------------|-----|
| Querying the **custom** anchor as `sectionId` (string) on affected entry types | Use **`sectionAnchorId`** (string). |
| Needing Craft’s **numeric** section id | Keep using built-in **`sectionId`** (`Int`) on `Entry` / `EntryInterface`. |

**Search the frontend** for GraphQL operations that request `sectionId` on **nested “entry” blocks** (e.g. complex page / festival layouts). Replace only the **custom anchor** usages with `sectionAnchorId`. Do **not** rename the built-in `sectionId` when you mean the real section id.

Example pattern (illustrative — adjust to your real types and aliases):

```graphql
# Built-in (unchanged): numeric Craft section
entry(section: "homepage") {
  sectionId
}

# Custom anchor (renamed): string for #hash navigation
... on entry_Entry {
  sectionAnchorId
}
```

Re-run **codegen** (if you use GraphQL Code Generator) or refresh your schema artifact after deploy.

---

## 4. Video URL fields (Plain Text)

The **`mikestecker/craft-videoembedder`** plugin was removed (no Craft 4+ compatible release). **`videoUrl`** (and matrix sub-fields that held embed data) are now **`PlainText`** fields storing a **URL string** (or empty).

**Frontend impact:**

- Do **not** expect a structured “video embed” GraphQL type from Craft for those fields.
- **Parsing, embed HTML, and thumbnails** are the frontend’s responsibility (YouTube, Vimeo, etc.), or a small BFF if you prefer server-side rendering outside Craft.

---

## 5. General Craft 5 GraphQL reminders

- **Schema and tokens** control which entry types, fields, and sites appear in the API. If something disappears after a deploy, compare **GraphQL schemas** in the CP with the token’s assigned schema.
- **Multi-site:** pass the appropriate [site argument](https://craftcms.com/docs/5.x/development/graphql.html#querying-elements) when querying localized content (`site: "nb"`, `site: "en"`, etc.) — handles match Project Config (`nb`, `en`).
- **Introspection:** after any schema change, confirm queries in **GraphiQL** (admin) or your client’s introspection-driven tooling.
- **Verbb Navigation:** the **`navigationNodes`** / **`navigationNode`** root fields are only registered if the token’s schema includes **Navigation** permissions (`navigationNavs` in Project Config). Otherwise GraphQL returns `Cannot query field "navigationNodes" on type "Query"` — assign the token to a schema that matches **Ekko site** / **Public Schema** navigation scopes, or queries will have no nav field at all.
- **Entry type names in GraphQL:** Craft 5 exposes entry types as **`{entryTypeHandle}_Entry`** (e.g. `legal_Entry`, `event_Entry`, `festival_Entry`), not the old `section_section_Entry`-style doubled handles.
- **Matrix inline fragments:** Matrix fields resolve to nested entries; use **`{fieldHandle}_{entryTypeHandle}_Entry`** (e.g. `sections_entry_Entry`, `complexContent_text_Entry`), not `*_BlockType`.

---

## 6. Reserved field handles (avoid GraphQL schema breaks)

Custom field **handles** must not reuse names already defined on **`EntryInterface`** / **`ElementInterface`** (different GraphQL types for the same name break introspection — the same class of bug as the old `sectionId` text field vs native `sectionId: Int`).

**Do not use** these as custom field handles on entries (non-exhaustive; see Craft’s `EntryInterface` and parent interfaces in `vendor/craftcms/cms/src/gql/interfaces/`):

`id`, `uid`, `title`, `slug`, `uri`, `enabled`, `archived`, `siteId`, `siteHandle`, `siteSettingsId`, `language`, `status`, `url`, `dateCreated`, `dateUpdated`, `sectionId`, `sectionHandle`, `typeId`, `typeHandle`, `postDate`, `expiryDate`, `authorId`, `author`, `ownerId`, `fieldId`, `fieldHandle`, `sortOrder`, `enabledForSite`, `canonicalId`, `canonicalUid`, `lft`, `rgt`, `level`, `root`, `structureId`, …

When adding fields in the CP, prefer descriptive handles (`sectionAnchorId`, `heroImage`, …) that cannot collide with core properties.

---

## 7. Checklist for frontend maintainers

- [ ] `GRAPHQL_API_URL` (or equivalent) ends with `/api` and matches the deployed `SITE_URL` origin.
- [ ] `Authorization: Bearer …` is set for all server and client calls to `/api`.
- [ ] All former **custom** `sectionId` string selections updated to **`sectionAnchorId`** where applicable; built-in **`sectionId` Int** usage unchanged.
- [ ] Video fields treated as **plain URL strings**; embed logic lives in the frontend (or BFF).
- [ ] CI / Cloudflare secrets updated if GraphQL tokens were rotated.

---

## Related files in this repo

| File | Relevance |
|------|-----------|
| `cms/config/routes.php` | Maps `api` → GraphQL action |
| `cms/config/project/graphql/graphql.yaml` | Public token on/off |
| `cms/config/project/fields/sectionAnchorId--e2bb1603-0d05-4682-9124-496596dec40e.yaml` | Anchor field definition |
| `docker/nginx/default.conf` | Passes `Authorization` to PHP |
