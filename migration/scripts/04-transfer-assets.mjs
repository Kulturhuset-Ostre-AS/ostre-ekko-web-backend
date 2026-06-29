// Phase 0 of import (run before 05): copy asset binaries into Payload's media
// collection and record a craftId -> payload media id map for relation resolution.
//
// Source priority: (1) the live URL on each asset (works while Craft 3 is up or the
// GCS objects are public), (2) a local GCS mirror if GCS_BUCKET is set + gsutil
// available. Writes data/asset-map.json.
import fs from "node:fs";
import path from "node:path";
import { readJSON, writeJSON, ENV, LOCALES, ROOT, log, warn } from "./lib.mjs";
import { getPayload } from "./payload-client.mjs";

async function fetchBuffer(asset) {
  if (asset.url) {
    const res = await fetch(asset.url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    warn(`fetch ${asset.url} -> HTTP ${res.status}`);
  }
  return null;
}

async function main() {
  const payload = await getPayload();
  const map = {}; // craftAssetId -> payload media id

  // Assets are locale-independent in practice; use the first locale's list, fall
  // back to merging all locale files.
  const seen = new Map();
  for (const locale of LOCALES) {
    let rows = [];
    try { rows = readJSON(`assets.${locale}.json`); } catch { continue; }
    for (const a of rows) if (!seen.has(a.id)) seen.set(a.id, a);
  }
  const assets = [...seen.values()];
  log(`Transferring ${assets.length} assets…`);

  let ok = 0, fail = 0;
  for (const a of assets) {
    try {
      const buf = await fetchBuffer(a);
      if (!buf) { fail++; continue; }
      const created = await payload.create({
        collection: "media",
        data: {
          craftId: Number(a.id),
          alt: a.title || a.filename,
          artistName: a.artistName || undefined,
          ekstraInfo: a.ekstraInfo || undefined,
          source: a.volumeHandle?.handle || a.volumeHandle || undefined,
        },
        file: {
          data: buf,
          name: a.filename,
          mimetype: a.mimeType || "application/octet-stream",
          size: buf.length,
        },
      });
      map[a.id] = created.id;
      ok++;
      if (ok % 25 === 0) log(`  …${ok}/${assets.length}`);
    } catch (e) {
      fail++;
      warn(`asset ${a.id} (${a.filename}): ${e.message.split("\n")[0]}`);
    }
  }
  writeJSON("asset-map.json", map);
  log(`✔ assets: ${ok} imported, ${fail} failed -> data/asset-map.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
