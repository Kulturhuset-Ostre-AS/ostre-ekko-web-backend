// Pass 2: resolve relationships, uploads, and matrix blocks for already-created docs.
// Uses data/sql/id-map.json (craftId->payloadId per collection) + asset-map.json.
//
// Run AFTER sql-import.mjs (pass 1) and sql-transfer-assets.mjs.
//   node scripts/sql-import-relations.mjs [collection]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBuilders, statusOf } from './sql-shared.mjs'

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

// craftId -> { title, slug, status } per section (PATCH revalidates required title;
// carry it. status decides whether the patch saves as draft or published).
// Load BOTH locales so en-only entries (no nb row) still have a title to satisfy the
// required localized field when we patch in the nb locale.
const titleBySection = {}
for (const section of ['events', 'news', 'arena', 'artists', 'performance']) {
  const t = {}
  for (const loc of ['en', 'nb']) { // nb last so it wins when present
    const f = `${section}.${loc}.json`
    if (!exists(f)) continue
    for (const row of read(f)) t[row.id] = { title: row.title || '(untitled)', slug: row.slug || `craft-${row.id}`, status: statusOf(row) }
    // Standalone drafts land in id-map when sql-import-drafts has run (re-runs of
    // this pass). They must keep draft status — patching them as published would
    // publish never-published content.
    const df = `${section}.drafts.${loc}.json`
    if (!exists(df)) continue
    for (const row of read(df)) {
      if (row.draftOf == null) t[row.id] = { title: row.title || '(untitled)', slug: row.slug || `craft-${row.id}`, status: 'draft' }
    }
  }
  titleBySection[section] = t
}

// Which Payload collection holds a given craftId (search content collections).
const CONTENT_COLLECTIONS = ['events', 'news', 'arena', 'artists', 'performance', 'categories']
function findPayloadId(craftId) {
  for (const col of CONTENT_COLLECTIONS) {
    const id = idMap[col]?.[craftId]
    if (id) return { col, id }
  }
  return null
}
const mediaId = (craftAssetId) => assetMap[craftAssetId]

// Relation/matrix -> Payload field builders live in sql-shared.mjs (shared with
// the drafts pass).
const { buildRelationData } = makeBuilders({ relations, matrix, findPayloadId, mediaId })

let TOKEN = ''
async function login() {
  await fetch(`${BASE}/users/first-register`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Import' }) }).catch(() => {})
  const r = await fetch(`${BASE}/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((x) => x.json())
  TOKEN = r.token; if (!TOKEN) throw new Error('login failed')
}
async function patch(col, id, data, locale, { draft = false } = {}) {
  // Timeout + retry: without a timeout an occasionally-hanging request (dead
  // keep-alive socket against Cloud Run) left main() awaiting forever — node's
  // event loop drained and the process exited 0 with NO output and the pass
  // silently un-run (the long-mysterious "pass 2 no-opped in the background"
  // bug, root-caused 2026-08-01 via an unsettled-top-level-await warning).
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${BASE}/${col}/${id}?locale=${locale}${draft ? '&draft=true' : ''}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `JWT ${TOKEN}` },
        body: JSON.stringify(data), signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 150)}`)
      return
    } catch (e) {
      if (attempt >= 3 || !['TimeoutError', 'AbortError'].includes(e.name)) throw e
    }
  }
}

async function main() {
  await login()
  const only = process.argv[2]
  for (const col of ['events', 'news', 'artists', 'performance', 'arena']) {
    if (only && only !== col) continue
    const map = idMap[col] || {}
    let n = 0
    const titles = titleBySection[col] || {}
    for (const [craftId, payloadId] of Object.entries(map)) {
      // Carry title/slug — PATCH revalidates the required localized title field.
      const t = titles[craftId] || {}
      const data = { ...(t.title ? { title: t.title } : {}), ...(t.slug ? { slug: t.slug } : {}) }
      // relationships / uploads / matrix-derived fields (nb site blocks)
      Object.assign(data, buildRelationData(col, craftId))
      // Keep the doc's status: a plain PATCH on a Craft-disabled (draft) doc would
      // publish it, so those save via draft=true with _status carried along.
      const isDraft = t.status === 'draft'
      data._status = isDraft ? 'draft' : 'published'
      // Only patch if there's real relation/matrix data (title/slug/status alone = skip).
      const hasPayload = Object.keys(data).some((k) => !['title', 'slug', '_status'].includes(k))
      if (hasPayload) {
        try { await patch(col, payloadId, data, 'nb', { draft: isDraft }) }
        catch (e) { if (n < 20) console.warn(`  ✗ ${col}#${craftId}: ${e.message.slice(0, 110)}`) }
      }
      n++
      if (n % 250 === 0) console.log(`  ${col}… ${n}/${Object.keys(map).length}`)
    }
    console.log(`✓ ${col}: ${n} relation-patched`)
  }
  console.log('\n✔ pass 2 complete')
}

main().catch((e) => { console.error(e); process.exit(1) })
