// ⚠️ DEPRECATED — GraphQL export path (abandoned: Craft 3 GraphQL would not register
// entry types on the restored DB). Use the SQL path instead: see migration/MIGRATION.md
// (sql-export.mjs, sql-transfer-assets.mjs, sql-import*.mjs, sql-verify.mjs).

// Phase 5: import exported Craft data into Payload via the Local API.
// Two passes so cross-collection relationships resolve regardless of import order:
//   pass 1: create every doc with scalar fields + craftId (relations null)
//   pass 2: patch relationship / upload / parent fields by craftId lookup
// Assets must be imported first (04-transfer-assets.mjs -> data/asset-map.json).
import { readJSON, writeJSON, LOCALES, log, warn } from "./lib.mjs";
import { getPayload } from "./payload-client.mjs";

const SINGLES = ["about", "archive", "homepage", "legal", "oestre", "ekko_festival_info"];
const COLLECTIONS = ["arena", "events", "news", "artists", "performance"];
const STRUCTURES = new Set(["artists", "performance"]);

// Distinguish a relation/asset value (array of {id} / {filename}) from a scalar.
const isRelArray = (v) =>
  Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] && ("id" in v[0] || "filename" in v[0]);
const isAssetArray = (v) =>
  Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] && "filename" in v[0];

function splitFields(row) {
  const scalars = {};
  const relations = {};
  for (const [k, v] of Object.entries(row)) {
    if (["id", "uid", "parent", "level", "sectionHandle"].includes(k)) continue;
    if (isRelArray(v)) relations[k] = v;
    else scalars[k] = v;
  }
  return { scalars, relations };
}

async function importCollection(payload, slug, idIndex, assetMap) {
  const created = []; // { craftId, payloadId, relations, row }
  for (const locale of LOCALES) {
    let rows = [];
    try { rows = readJSON(`${slug}.${locale}.json`); } catch { continue; }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { scalars, relations } = splitFields(row);
      const data = {
        craftId: Number(row.id),
        title: row.title,
        slug: row.slug,
        ...stripCommon(scalars),
      };
      if (STRUCTURES.has(slug)) data.order = i;

      // First locale creates; subsequent locales update the same craftId doc.
      const existing = idIndex[slug]?.[row.id];
      let doc;
      if (existing) {
        doc = await payload.update({ collection: slug, id: existing, data, locale });
      } else {
        doc = await payload.create({ collection: slug, data, locale });
        (idIndex[slug] ||= {})[row.id] = doc.id;
        created.push({ craftId: row.id, payloadId: doc.id, relations, row });
      }
    }
  }
  return created;
}

async function importGlobal(payload, slug, idIndex) {
  for (const locale of LOCALES) {
    let rows = [];
    try { rows = readJSON(`${slug}.${locale}.json`); } catch { continue; }
    const row = rows[0];
    if (!row) continue;
    const { scalars } = splitFields(row);
    await payload.updateGlobal({
      slug, locale,
      data: { title: row.title, slug: row.slug, ...stripCommon(scalars) },
    });
  }
}

const COMMON = new Set(["title", "slug", "uri", "enabled", "postDate", "dateCreated", "dateUpdated", "typeHandle"]);
function stripCommon(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (!COMMON.has(k)) out[k] = v;
  return out;
}

// Pass 2: resolve relations + asset uploads + structure parents by craftId.
async function resolveRelations(payload, slug, created, idIndex, assetMap) {
  for (const c of created) {
    const patch = {};
    for (const [field, arr] of Object.entries(c.relations)) {
      const ids = [];
      for (const ref of arr) {
        if ("filename" in ref) {
          const mid = assetMap[ref.id];
          if (mid) ids.push(mid);
        } else if ("id" in ref) {
          // find which collection holds this craftId
          for (const col of COLLECTIONS) {
            const pid = idIndex[col]?.[ref.id];
            if (pid) { ids.push(pid); break; }
          }
        }
      }
      if (ids.length) patch[field] = ids;
    }
    // structure parent
    if (STRUCTURES.has(slug) && c.row.parent?.id) {
      const parentPid = idIndex[slug]?.[c.row.parent.id];
      if (parentPid) patch.parentCraftId = Number(c.row.parent.id);
    }
    if (Object.keys(patch).length) {
      await payload.update({ collection: slug, id: c.payloadId, data: patch });
    }
  }
}

async function main() {
  const payload = await getPayload();
  let assetMap = {};
  try { assetMap = readJSON("asset-map.json"); }
  catch { warn("data/asset-map.json missing — run 04-transfer-assets.mjs first (upload fields will be empty)."); }

  const idIndex = {}; // slug -> { craftId -> payloadId }
  const createdBySlug = {};

  log("Pass 1: creating documents…");
  for (const slug of COLLECTIONS) {
    const created = await importCollection(payload, slug, idIndex, assetMap);
    createdBySlug[slug] = created;
    log(`  ${slug.padEnd(14)} ${created.length} created`);
  }
  for (const slug of SINGLES) {
    await importGlobal(payload, slug, idIndex);
    log(`  global:${slug}`);
  }

  log("Pass 2: resolving relationships…");
  for (const slug of COLLECTIONS) {
    await resolveRelations(payload, slug, createdBySlug[slug], idIndex, assetMap);
    log(`  ${slug} relations resolved`);
  }

  writeJSON("id-index.json", idIndex);
  log("✔ import complete -> data/id-index.json");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });