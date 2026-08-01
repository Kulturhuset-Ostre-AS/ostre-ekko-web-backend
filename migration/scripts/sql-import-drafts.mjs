// Pass 3: import Craft drafts as Payload drafts. Run AFTER sql-import.mjs and
// sql-import-relations.mjs so every save here lands as the doc's newest version.
//
// Two draft kinds (from <section>.drafts.<site>.json, exported by sql-export.mjs):
//   - standalone (draftOf = null): entry was never published -> create a new doc,
//     saved via draft=true so it exists only as a draft.
//   - draft-of-entry (draftOf = canonical craft id): saved edits on a published
//     entry -> PATCH the imported doc with draft=true, layering the draft version
//     on top of the published one. Only the newest draft per entry is imported
//     (Payload has one working draft; older ones are logged and skipped).
//
// Craft "provisional" drafts (per-user autosaved WIP, never explicitly saved as a
// draft) are skipped — they are edit buffers, not content.
//
// Run: node scripts/sql-import-drafts.mjs [collection]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scalarData, bool, makeBuilders } from './sql-shared.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL = path.resolve(__dirname, '..', 'data', 'sql')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'

const read = (f) => JSON.parse(fs.readFileSync(path.join(SQL, f), 'utf8'))
const exists = (f) => fs.existsSync(path.join(SQL, f))

const idMap = read('id-map.json') // collection -> craftId -> payloadId
const assetMap = exists('asset-map.json') ? read('asset-map.json') : {}
const relations = read('_relations.json') // sourceId -> field -> [targetId]
const matrix = read('_matrix.json') // field -> ownerId -> siteId -> [blocks]

const CONTENT_COLLECTIONS = ['events', 'news', 'arena', 'artists', 'performance', 'categories']
function findPayloadId(craftId) {
  for (const col of CONTENT_COLLECTIONS) {
    const id = idMap[col]?.[craftId]
    if (id) return { col, id }
  }
  return null
}
const mediaId = (craftAssetId) => assetMap[craftAssetId]
const { buildRelationData } = makeBuilders({ relations, matrix, findPayloadId, mediaId })

let TOKEN = ''
async function login() {
  await fetch(`${BASE}/users/first-register`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Import' }) }).catch(() => {})
  const r = await fetch(`${BASE}/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((x) => x.json())
  TOKEN = r.token; if (!TOKEN) throw new Error('login failed')
}
async function api(p, opts = {}) {
  // Timeout + retry: a hanging request (dead keep-alive socket) used to drain
  // the event loop and kill the process silently mid-pass — see the same fix in
  // sql-import-relations.mjs (root-caused 2026-08-01).
  let res
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(`${BASE}${p}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${TOKEN}`, ...(opts.headers || {}) },
        signal: AbortSignal.timeout(30_000),
      })
      break
    } catch (e) {
      if (attempt >= 3 || !['TimeoutError', 'AbortError'].includes(e.name)) throw e
    }
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p} -> ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
  return json
}

// Full draft payload for one row: scalars + relations/matrix keyed by the DRAFT
// element id (drafts own their own content, relation rows, and matrix blocks).
function draftData(col, row) {
  const data = { ...scalarData(col, row), ...buildRelationData(col, row.id), _status: 'draft' }
  // Layered drafts must keep the canonical entry's craftId — the draft element id
  // would break craftId-based lookups (relations, legacy URL mapping) when the
  // draft is published from the admin.
  if (row.draftOf != null) data.craftId = Number(row.draftOf)
  // Craft gives never-saved slugs a `__temp_<random>` placeholder; use the stable
  // craft-id fallback instead so editors see something sane.
  if (data.slug?.startsWith('__temp')) data.slug = `craft-${row.id}`
  return data
}

const SECTION_TO_COLLECTION = {
  events: 'events', news: 'news', arena: 'arena', artists: 'artists', performance: 'performance',
}

async function main() {
  await login()
  const only = process.argv[2]
  const totals = { standalone: 0, layered: 0, provisional: 0, olderSkipped: 0, missing: 0 }

  for (const [section, col] of Object.entries(SECTION_TO_COLLECTION)) {
    if (only && only !== col) continue
    const nbRows = exists(`${section}.drafts.nb.json`) ? read(`${section}.drafts.nb.json`) : []
    const enRows = exists(`${section}.drafts.en.json`) ? read(`${section}.drafts.en.json`) : []
    const enById = Object.fromEntries(enRows.map((r) => [r.id, r]))
    // Primary locale is nb; en-only drafts (no nb content row) fall back to the en row.
    const primary = [...nbRows]
    const nbIds = new Set(nbRows.map((r) => r.id))
    for (const r of enRows) if (!nbIds.has(r.id)) primary.push(r)

    const provisional = primary.filter((r) => bool(r.provisional))
    totals.provisional += provisional.length
    const saved = primary.filter((r) => !bool(r.provisional))

    // Newest saved draft per canonical entry wins (lexicographic works for
    // 'YYYY-MM-DD HH:MM:SS' timestamps).
    const newestOf = {}
    for (const r of saved) {
      if (r.draftOf == null) continue
      const cur = newestOf[r.draftOf]
      if (!cur || String(r.dateUpdated) > String(cur.dateUpdated)) newestOf[r.draftOf] = r
    }

    let n = 0
    for (const row of saved) {
      const enRow = nbIds.has(row.id) ? enById[row.id] : null
      try {
        if (row.draftOf == null) {
          // standalone: new doc, draft only
          idMap[col] ||= {}
          if (!idMap[col][row.id]) {
            const r = await api(`/${col}?locale=nb&draft=true`, { method: 'POST', body: JSON.stringify(draftData(col, row)) })
            idMap[col][row.id] = r.doc.id
          }
          if (enRow) await api(`/${col}/${idMap[col][row.id]}?locale=en&draft=true`, { method: 'PATCH', body: JSON.stringify(draftData(col, enRow)) })
          totals.standalone++
        } else {
          if (newestOf[row.draftOf] !== row) {
            totals.olderSkipped++
            console.log(`  ~ ${col} craft#${row.draftOf}: skipping older draft "${row.draftName}" (${row.dateUpdated})`)
            continue
          }
          const payloadId = idMap[col]?.[row.draftOf]
          if (!payloadId) {
            totals.missing++
            console.warn(`  ✗ ${col} craft#${row.draftOf}: published doc not found for draft "${row.draftName}"`)
            continue
          }
          await api(`/${col}/${payloadId}?locale=nb&draft=true`, { method: 'PATCH', body: JSON.stringify(draftData(col, row)) })
          if (enRow) await api(`/${col}/${payloadId}?locale=en&draft=true`, { method: 'PATCH', body: JSON.stringify(draftData(col, enRow)) })
          totals.layered++
        }
      } catch (e) {
        console.warn(`  ✗ ${col} draft#${row.id}: ${e.message.split('\n')[0].slice(0, 140)}`)
      }
      n++
    }
    if (provisional.length) console.log(`  ~ ${col}: skipped ${provisional.length} provisional (autosave WIP) drafts`)
    console.log(`✓ ${col}: ${n} drafts processed`)
  }

  fs.writeFileSync(path.join(SQL, 'id-map.json'), JSON.stringify(idMap))
  console.log(`\n✔ pass 3 complete — standalone: ${totals.standalone}, layered on published: ${totals.layered}, ` +
    `provisional skipped: ${totals.provisional}, older drafts skipped: ${totals.olderSkipped}, missing targets: ${totals.missing}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
