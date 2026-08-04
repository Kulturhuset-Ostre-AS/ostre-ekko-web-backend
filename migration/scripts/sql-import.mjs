// Import the SQL-exported Craft data (data/sql/*.json) into Payload via REST.
//
// Two passes, keyed by craftId so relations resolve regardless of order:
//   pass 1: create every doc (scalars + lexical-converted rich text), record craftId->payloadId
//   pass 2: patch relationship/upload fields (and structure parent) using the id map
// Assets are imported by 04-transfer-assets first; their map is read here.
//
// Resumable: writes data/sql/id-map.json after pass 1 so a re-run skips created docs.
//
// Run: node migration/scripts/sql-import.mjs [collection]   (optional: one collection)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scalarData, statusOf } from './sql-shared.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SQL = path.join(ROOT, 'data', 'sql')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'

const LOCALES = [{ site: 'nb', locale: 'nb' }, { site: 'en', locale: 'en' }]
const read = (f) => JSON.parse(fs.readFileSync(path.join(SQL, f), 'utf8'))
const exists = (f) => fs.existsSync(path.join(SQL, f))

// Rich-text/scalar mapping lives in sql-shared.mjs (shared with the drafts pass).

// ---- API helpers -----------------------------------------------------------------
let TOKEN = ''
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
async function login() {
  await fetch(`${BASE}/users/first-register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Import' }),
  }).catch(() => {})
  const r = await fetch(`${BASE}/users/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((x) => x.json())
  TOKEN = r.token
  if (!TOKEN) throw new Error('login failed')
}

const SECTION_TO_COLLECTION = {
  events: 'events', news: 'news', arena: 'arena', artists: 'artists', performance: 'performance',
}
const GLOBAL_SECTIONS = { about: 'about', archive: 'archive', homepage: 'homepage', legal: 'legal', oestre: 'oestre', ekko_festival_info: 'ekko_festival_info' }

async function main() {
  await login()
  const only = process.argv[2]
  const idMap = exists('id-map.json') ? read('id-map.json') : {} // collection -> { craftId -> payloadId }
  const assetMap = exists('asset-map.json') ? read('asset-map.json') : {} // craftAssetId -> payloadMediaId
  if (!Object.keys(assetMap).length) console.warn('⚠ asset-map.json empty — run 04-transfer-assets first (upload fields will be empty).')

  // ---------- locations + organizers (splittet fra Craft-kategoriene) ----------
  // Craft-gruppene locationsCategory/organizersCategory går i hver sin
  // collection (splitten 2026-08-04) — `categories` finnes ikke lenger.
  if (!only || only === 'categories' || only === 'locations' || only === 'organizers') {
    idMap.locations ||= {}
    idMap.organizers ||= {}
    for (const { site, locale } of LOCALES) {
      if (!exists(`categories.${site}.json`)) continue
      for (const cat of read(`categories.${site}.json`)) {
        const isOrganizer = cat.group === 'organizersCategory'
        if (only === 'locations' && isOrganizer) continue
        if (only === 'organizers' && !isOrganizer) continue
        const data = isOrganizer
          ? { craftId: Number(cat.id), title: cat.title || '(untitled)', slug: cat.slug || `cat-${cat.id}` }
          : {
              craftId: Number(cat.id), title: cat.title || '(untitled)', slug: cat.slug || `cat-${cat.id}`,
              fullTitle: cat.fullTitle || undefined, venue: cat.venue || undefined, room: cat.room || undefined,
            }
        await upsert(isOrganizer ? 'organizers' : 'locations', cat.id, data, locale, idMap)
      }
    }
    save(idMap)
    console.log(`✓ locations: ${Object.keys(idMap.locations).length}, organizers: ${Object.keys(idMap.organizers).length}`)
  }

  // ---------- content collections (pass 1: scalars) ----------
  for (const [section, collection] of Object.entries(SECTION_TO_COLLECTION)) {
    if (only && only !== collection) continue
    idMap[collection] ||= {}
    let n = 0
    for (const { site, locale } of LOCALES) {
      if (!exists(`${section}.${site}.json`)) continue
      for (const row of read(`${section}.${site}.json`)) {
        // Craft `enabled` -> Payload `_status`. Disabled entries were hidden on the
        // Craft site; they become drafts (saved via draft=true so nothing publishes).
        const data = { ...scalarData(collection, row), _status: statusOf(row) }
        await upsert(collection, row.id, data, locale, idMap, { draft: data._status === 'draft' })
        n++
        if (n % 250 === 0) { save(idMap); console.log(`  ${collection}… ${n}`) }
      }
    }
    save(idMap)
    console.log(`✓ ${collection}: ${Object.keys(idMap[collection]).length} docs`)
  }

  console.log('\nPass 1 complete. Run sql-import-relations.mjs for relations + matrix.')
}

// create on first locale, update on subsequent locales (same craftId doc).
// `draft: true` saves via Payload's draft mechanism so the doc never publishes.
async function upsert(collection, craftId, data, locale, idMap, { draft = false } = {}) {
  const existing = idMap[collection]?.[craftId]
  const q = `locale=${locale}${draft ? '&draft=true' : ''}`
  try {
    if (existing) {
      await api(`/${collection}/${existing}?${q}`, { method: 'PATCH', body: JSON.stringify(data) })
    } else {
      const r = await api(`/${collection}?${q}`, { method: 'POST', body: JSON.stringify(data) })
      ;(idMap[collection] ||= {})[craftId] = r.doc.id
    }
  } catch (e) {
    console.warn(`  ✗ ${collection} craft#${craftId}: ${e.message.split('\n')[0].slice(0, 120)}`)
  }
}

let _saveT = 0
function save(idMap) {
  fs.writeFileSync(path.join(SQL, 'id-map.json'), JSON.stringify(idMap))
}

main().catch((e) => { console.error(e); process.exit(1) })
