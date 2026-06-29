// Phase 1: introspect the Craft 3 GraphQL schema.
// Output: data/craft-schema.json (full introspection) — drives schema generation
// and lets us see exactly which sections/types/fields GraphQL exposes.
import { gql, writeJSON, log, warn } from "./lib.mjs";

const INTROSPECTION = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    types {
      kind name description
      fields(includeDeprecated: true) {
        name description
        args { name type { ...TypeRef } }
        type { ...TypeRef }
      }
      inputFields { name type { ...TypeRef } }
      interfaces { ...TypeRef }
      enumValues(includeDeprecated: true) { name }
      possibleTypes { ...TypeRef }
    }
  }
}
fragment TypeRef on __Type {
  kind name
  ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
}
`;

async function main() {
  log("Introspecting Craft 3 GraphQL schema…");
  const data = await gql(INTROSPECTION);
  const types = data.__schema.types.filter((t) => !t.name.startsWith("__"));

  // Craft names entry/asset/category types like `event_Entry`, `eventPhoto_Asset`,
  // `locationsCategory_Category`. Surface them so the generator + a human can review.
  const entryTypes = types.filter((t) => /_Entry$/.test(t.name)).map((t) => t.name);
  const assetTypes = types.filter((t) => /_Asset$/.test(t.name)).map((t) => t.name);
  const catTypes = types.filter((t) => /_Category$/.test(t.name)).map((t) => t.name);
  const tagTypes = types.filter((t) => /_Tag$/.test(t.name)).map((t) => t.name);

  const p = writeJSON("craft-schema.json", data);
  writeJSON("craft-schema.summary.json", {
    entryTypes,
    assetTypes,
    categoryTypes: catTypes,
    tagTypes,
    counts: {
      entryTypes: entryTypes.length,
      assetTypes: assetTypes.length,
      categoryTypes: catTypes.length,
      tagTypes: tagTypes.length,
    },
  });

  log(`✔ wrote ${p}`);
  log(`  entry types : ${entryTypes.length}  (${entryTypes.slice(0, 8).join(", ")}…)`);
  log(`  asset types : ${assetTypes.length}  (${assetTypes.join(", ")})`);
  log(`  category    : ${catTypes.length}  (${catTypes.join(", ")})`);
  if (!entryTypes.length) warn("No *_Entry types found — is the public schema scoped to read sections?");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
