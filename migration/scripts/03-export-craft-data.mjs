// Phase 3: export all Craft 3 content over GraphQL, per locale, to data/*.json.
//
// Strategy: for each section we run a generic query that pulls the interface-level
// fields every entry has (id, uid, title, slug, dates, status, level/parent for
// structures) PLUS a JSON-serialized blob of all custom fields via Craft's
// `... on <type>` is avoided in favor of querying the EntryInterface plus a second
// pass using each concrete type. To stay schema-agnostic we request the common
// scalar fields and let `05-import` reconcile custom fields using the introspection
// schema. Assets and relations are captured as their target ids/urls.
//
// Sections come from cms/config/project (the same 11 in Craft 3 and Craft 5).
import { gql, writeJSON, readJSON, LOCALES, log, warn } from "./lib.mjs";

const PER_PAGE = 100;

// Sections to export. Singles are exported too (limit 1 -> becomes a Payload global).
const SECTIONS = [
  { handle: "about", kind: "single" },
  { handle: "archive", kind: "single" },
  { handle: "homepage", kind: "single" },
  { handle: "legal", kind: "single" },
  { handle: "oestre", kind: "single" },
  { handle: "ekko_festival_info", kind: "single" },
  { handle: "arena", kind: "channel" },
  { handle: "events", kind: "channel" },
  { handle: "news", kind: "channel" },
  { handle: "artists", kind: "structure" },
  { handle: "performance", kind: "structure" },
];

// Interface-level fields available on every EntryInterface in Craft 3 GraphQL.
const COMMON = `
  id
  uid
  title
  slug
  uri
  enabled
  postDate
  dateCreated
  dateUpdated
  typeHandle
  sectionHandle
  level
  parent { id }
`;

// Build a per-type fragment set from the introspection summary so we capture
// every custom field. We request each concrete *_Entry type's own fields.
function buildTypeFragments(schema, typeNames) {
  const byName = new Map(schema.__schema.types.map((t) => [t.name, t]));
  const scalarKinds = new Set(["SCALAR", "ENUM"]);

  const unwrap = (t) => {
    while (t && t.ofType) t = t.ofType;
    return t;
  };

  const frags = [];
  for (const name of typeNames) {
    const t = byName.get(name);
    if (!t?.fields) continue;
    const sel = [];
    for (const f of t.fields) {
      if (COMMON.includes(`\n  ${f.name}\n`)) continue; // already in COMMON
      const base = unwrap(f.type);
      if (!base) continue;
      if (scalarKinds.has(base.kind)) {
        sel.push(f.name);
      } else if (/_Entry$|_Category$|_Tag$/.test(base.name || "")) {
        // relation -> capture target ids
        sel.push(`${f.name} { ... on EntryInterface { id } ... on CategoryInterface { id } ... on TagInterface { id } }`);
      } else if (/_Asset$/.test(base.name || "") || base.name === "AssetInterface") {
        sel.push(`${f.name} { ... on AssetInterface { id url filename } }`);
      } else if (base.name === "EntryInterface" || base.name === "ElementInterface") {
        // Matrix blocks live here — capture block type + its scalar fields generically
        sel.push(`${f.name} { __typename ... on EntryInterface { id typeHandle } ${matrixBlockSelections(schema, f, byName, unwrap, scalarKinds)} }`);
      }
    }
    if (sel.length) {
      frags.push(`  ... on ${name} {\n    ${sel.join("\n    ")}\n  }`);
    }
  }
  return frags.join("\n");
}

// For a Matrix field, emit `... on <block>_Entry { scalarFields, assets, relations }`
// for each possible block type.
function matrixBlockSelections(schema, field, byName, unwrap, scalarKinds) {
  // Find possibleTypes for the field's base type (a union/interface of block entries).
  const base = unwrap(field.type);
  const iface = byName.get(base?.name);
  const blocks = (iface?.possibleTypes || []).map((p) => p.name).filter(Boolean);
  const out = [];
  for (const b of blocks) {
    const bt = byName.get(b);
    if (!bt?.fields) continue;
    const sel = [];
    for (const f of bt.fields) {
      const fb = unwrap(f.type);
      if (!fb) continue;
      if (scalarKinds.has(fb.kind)) sel.push(f.name);
      else if (/_Asset$/.test(fb.name || "")) sel.push(`${f.name} { ... on AssetInterface { id url filename } }`);
      else if (/_Entry$|_Category$/.test(fb.name || "")) sel.push(`${f.name} { ... on EntryInterface { id } ... on CategoryInterface { id } }`);
    }
    if (sel.length) out.push(`... on ${b} { id typeHandle\n      ${sel.join("\n      ")} }`);
  }
  return out.join("\n    ");
}

async function exportSection(section, locale, typeFrags) {
  const all = [];
  let offset = 0;
  for (;;) {
    const query = `
      query($section:[String], $limit:Int, $offset:Int) {
        entries(section:$section, limit:$limit, offset:$offset, orderBy:"lft, postDate") {
          ${COMMON}
          ${typeFrags}
        }
      }`;
    const data = await gql(query, { section: [section.handle], limit: PER_PAGE, offset }, { locale });
    const batch = data.entries || [];
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
    offset += PER_PAGE;
  }
  return all;
}

async function exportAssets(locale, schema) {
  const all = [];
  let offset = 0;
  for (;;) {
    const query = `
      query($limit:Int,$offset:Int){
        assets(limit:$limit, offset:$offset){
          id uid title filename kind size url
          mimeType width height dateCreated dateUpdated
          volumeHandle: volume { handle }
        }
      }`;
    let data;
    try {
      data = await gql(query, { limit: PER_PAGE, offset }, { locale });
    } catch (e) {
      // `volume { handle }` shape differs across versions; retry without it.
      const q2 = query.replace(/volumeHandle:[^\n]+\n/, "");
      data = await gql(q2, { limit: PER_PAGE, offset }, { locale });
    }
    const batch = data.assets || [];
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
    offset += PER_PAGE;
  }
  return all;
}

async function main() {
  let schema;
  try {
    schema = readJSON("craft-schema.json");
  } catch {
    throw new Error("Run 01-introspect-craft.mjs first (data/craft-schema.json missing).");
  }
  const summary = readJSON("craft-schema.summary.json");
  const typeFrags = buildTypeFragments(schema, summary.entryTypes);

  let totalEntries = 0;
  for (const locale of LOCALES) {
    log(`\n=== locale: ${locale} ===`);
    for (const section of SECTIONS) {
      try {
        const rows = await exportSection(section, locale, typeFrags);
        const p = writeJSON(`${section.handle}.${locale}.json`, rows);
        totalEntries += rows.length;
        log(`  ${section.handle.padEnd(20)} ${String(rows.length).padStart(4)} entries -> ${p.split("/").pop()}`);
      } catch (e) {
        warn(`  ${section.handle} (${locale}) failed: ${e.message.split("\n")[0]}`);
      }
    }
    const assets = await exportAssets(locale, schema);
    writeJSON(`assets.${locale}.json`, assets);
    log(`  ${"assets".padEnd(20)} ${String(assets.length).padStart(4)} assets`);
  }
  log(`\n✔ export complete — ${totalEntries} entries across ${LOCALES.length} locale(s)`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
