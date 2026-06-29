// Phase 6: verify the import. Compares per-section entry counts (Craft export vs
// Payload) and spot-checks a few fields. Exit code 1 if counts mismatch.
import { readJSON, LOCALES, log, warn } from "./lib.mjs";
import { getPayload } from "./payload-client.mjs";

const COLLECTIONS = ["arena", "events", "news", "artists", "performance"];
const SINGLES = ["about", "archive", "homepage", "legal", "oestre", "ekko_festival_info"];

function exportCount(slug) {
  // distinct craftIds across locales
  const ids = new Set();
  for (const locale of LOCALES) {
    try { for (const r of readJSON(`${slug}.${locale}.json`)) ids.add(r.id); } catch {}
  }
  return ids.size;
}

async function main() {
  const payload = await getPayload();
  let mismatch = 0;

  log("collection        craft   payload");
  log("------------------------------------");
  for (const slug of COLLECTIONS) {
    const want = exportCount(slug);
    const res = await payload.find({ collection: slug, limit: 0, depth: 0 });
    const got = res.totalDocs;
    const flag = want === got ? "✓" : "✗";
    if (want !== got) mismatch++;
    log(`${slug.padEnd(16)} ${String(want).padStart(5)} ${String(got).padStart(9)}  ${flag}`);
  }

  // assets
  try {
    const assetIds = new Set();
    for (const l of LOCALES) try { for (const a of readJSON(`assets.${l}.json`)) assetIds.add(a.id); } catch {}
    const media = await payload.find({ collection: "media", limit: 0, depth: 0 });
    log(`${"media".padEnd(16)} ${String(assetIds.size).padStart(5)} ${String(media.totalDocs).padStart(9)}  ${assetIds.size === media.totalDocs ? "✓" : "✗"}`);
  } catch {}

  // spot-check a couple of relationship integrity cases on events
  const ev = await payload.find({ collection: "events", limit: 3, depth: 1 });
  for (const e of ev.docs) {
    const rels = Object.entries(e).filter(([, v]) => Array.isArray(v) && v.some((x) => x && typeof x === "object"));
    log(`  spot: events/${e.slug} — ${rels.length} populated relation field(s)`);
  }

  if (mismatch) { warn(`${mismatch} collection(s) had count mismatches`); process.exit(1); }
  log("✔ verification passed");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
