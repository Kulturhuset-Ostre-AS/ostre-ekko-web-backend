// Phase 2: generate draft Payload collection/global/block configs from the Craft 3
// GraphQL introspection schema. Output -> payload-app/src/collections/_generated/.
//
// This gets ~80% of the way: correct collection per section, field per Craft field,
// blocks per Matrix type, relationships/uploads wired by name. Hand-review the
// output (required flags, validation, naming) before wiring into payload.config.ts.
import fs from "node:fs";
import path from "node:path";
import { readJSON, ENV, ROOT, LOCALES, log, warn, camel } from "./lib.mjs";

const OUT = path.resolve(ROOT, ENV.PAYLOAD_APP_DIR || "./payload-app", "src/collections/_generated");

// Section handle -> Payload kind. Mirrors cms/config/project/sections.
const SECTION_KIND = {
  about: "global", archive: "global", homepage: "global", legal: "global",
  oestre: "global", ekko_festival_info: "global",
  arena: "collection", events: "collection", news: "collection",
  artists: "collection", performance: "collection",
};

const unwrap = (t) => { while (t && t.ofType) t = t.ofType; return t; };

// Map a Craft GraphQL field (from introspection) to a Payload field literal.
function mapField(f, byName) {
  const base = unwrap(f.type);
  const name = f.name;
  const bn = base?.name || "";

  if (["DateTime", "Date"].includes(bn)) return field(name, "date");
  if (bn === "Boolean") return field(name, "checkbox");
  if (bn === "Number" || bn === "Int" || bn === "Float") return field(name, "number");
  if (/_Asset$/.test(bn) || bn === "AssetInterface")
    return field(name, "upload", { relationTo: "media", hasMany: true });
  if (/_Category$/.test(bn) || bn === "CategoryInterface")
    return field(name, "relationship", { relationTo: "categories", hasMany: true });
  if (/_Tag$/.test(bn) || bn === "TagInterface")
    return field(name, "relationship", { relationTo: "tags", hasMany: true });
  if (/_Entry$/.test(bn) || bn === "EntryInterface" || bn === "ElementInterface") {
    // Matrix (union/interface w/ possibleTypes) -> blocks; plain relation otherwise.
    const iface = byName.get(bn);
    if (iface?.possibleTypes?.length) return blocksField(name, iface, byName);
    return field(name, "relationship", { relationTo: "entries", hasMany: true });
  }
  // String-ish: longer text fields heuristically become textarea/richText.
  if (bn === "String") {
    if (/body|description|content|intro|text/i.test(name)) return field(name, "richText");
    return field(name, "text", LOCALES.length > 1 ? { localized: true } : {});
  }
  return field(name, "text"); // fallback
}

function field(name, type, extra = {}) {
  return { name: camel(name), type, ...extra };
}

function blocksField(name, iface, byName) {
  const blocks = (iface.possibleTypes || [])
    .map((p) => byName.get(p.name))
    .filter(Boolean)
    .map((bt) => ({
      slug: camel(bt.name.replace(/_Entry$/, "")),
      fields: (bt.fields || [])
        .filter((bf) => !["id", "uid", "typeHandle"].includes(bf.name))
        .map((bf) => mapField(bf, byName)),
    }));
  return { name: camel(name), type: "blocks", blocks };
}

const COMMON_FIELD_NAMES = new Set([
  "id", "uid", "uri", "enabled", "postDate", "dateCreated", "dateUpdated",
  "typeHandle", "sectionHandle", "level", "parent", "children", "ancestors",
  "descendants", "next", "prev", "status", "searchScore", "url",
]);

function emit(name, kind, fieldLiterals, opts = {}) {
  const isGlobal = kind === "global";
  const slug = camel(name);
  const body = `import type { ${isGlobal ? "GlobalConfig" : "CollectionConfig"} } from 'payload'

// AUTO-GENERATED from Craft 3 GraphQL schema. Review before use.
export const ${slug}: ${isGlobal ? "GlobalConfig" : "CollectionConfig"} = {
  slug: '${slug}',${isGlobal ? "" : `\n  admin: { useAsTitle: 'title' },`}
  fields: [
    // craftId lets the importer resolve relationships across collections.
    { name: 'craftId', type: 'number', index: true, unique: ${!isGlobal}, admin: { readOnly: true } },
    { name: 'title', type: 'text', localized: ${LOCALES.length > 1} },
    { name: 'slug', type: 'text', index: true },
${opts.structure ? `    { name: 'order', type: 'number', admin: { readOnly: true } },\n    { name: 'parentCraftId', type: 'number', admin: { readOnly: true } },\n` : ""}${fieldLiterals.map((f) => "    " + JSON.stringify(f) + ",").join("\n")}
  ],
}
`;
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${slug}.ts`);
  fs.writeFileSync(file, body);
  return file;
}

function main() {
  const schema = readJSON("craft-schema.json");
  const summary = readJSON("craft-schema.summary.json");
  const byName = new Map(schema.__schema.types.map((t) => [t.name, t]));

  // Group concrete entry types by their section (typeHandle prefix heuristics are
  // unreliable; instead emit one collection/global per section and union its fields).
  fs.mkdirSync(OUT, { recursive: true });
  const written = [];

  for (const [section, kind] of Object.entries(SECTION_KIND)) {
    // Collect all *_Entry types that belong to this section. Craft GraphQL type
    // names don't carry the section, so we match by the entry types the export
    // produced; fall back to all entry types and let review trim.
    const sectionTypes = summary.entryTypes.filter((t) =>
      t.toLowerCase().startsWith(camel(section).toLowerCase()) ||
      t.toLowerCase().includes(section.replace(/_/g, "").toLowerCase())
    );
    const types = sectionTypes.length ? sectionTypes : summary.entryTypes;

    const seen = new Set();
    const fieldLiterals = [];
    for (const tn of types) {
      const t = byName.get(tn);
      for (const f of t?.fields || []) {
        if (COMMON_FIELD_NAMES.has(f.name) || seen.has(f.name)) continue;
        seen.add(f.name);
        fieldLiterals.push(mapField(f, byName));
      }
    }
    const isStructure = section === "artists" || section === "performance";
    written.push(emit(section, kind, fieldLiterals, { structure: isStructure }));
  }

  // media + categories + tags support collections.
  written.push(emitMedia());
  written.push(emitSimple("categories"));
  written.push(emitSimple("tags"));
  writeIndex(written);

  log(`✔ generated ${written.length} configs into ${path.relative(ROOT, OUT)}`);
  warn("Review generated configs: required flags, localization, block naming, relationTo targets.");
}

function emitMedia() {
  const body = `import type { CollectionConfig } from 'payload'
export const media: CollectionConfig = {
  slug: 'media',
  upload: { staticDir: '../media' },
  fields: [
    { name: 'craftId', type: 'number', index: true, unique: true, admin: { readOnly: true } },
    { name: 'alt', type: 'text' },
    { name: 'artistName', type: 'text' },
    { name: 'ekstraInfo', type: 'text' },
    { name: 'source', type: 'text', admin: { description: 'Craft volume handle' } },
  ],
}
`;
  const file = path.join(OUT, "media.ts");
  fs.writeFileSync(file, body);
  return file;
}

function emitSimple(slug) {
  const body = `import type { CollectionConfig } from 'payload'
export const ${slug}: CollectionConfig = {
  slug: '${slug}',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'craftId', type: 'number', index: true, unique: true, admin: { readOnly: true } },
    { name: 'title', type: 'text', localized: ${LOCALES.length > 1} },
    { name: 'slug', type: 'text' },
${slug === "categories" ? "    { name: 'group', type: 'text' },\n    { name: 'venue', type: 'text' },\n    { name: 'room', type: 'text' },\n" : ""}  ],
}
`;
  const file = path.join(OUT, `${slug}.ts`);
  fs.writeFileSync(file, body);
  return file;
}

function writeIndex(files) {
  const names = files.map((f) => path.basename(f, ".ts"));
  const body =
    names.map((n) => `export { ${n} } from './${n}'`).join("\n") + "\n";
  fs.writeFileSync(path.join(OUT, "index.ts"), body);
}

main();
