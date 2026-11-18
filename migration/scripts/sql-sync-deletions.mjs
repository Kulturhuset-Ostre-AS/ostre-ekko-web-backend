// Entries deleted in Craft since the last import: docs in id-map.json whose
// craftId no longer appears in the export (canonical entries, standalone saved
// drafts, locations/organizers). A full import handles this by resetting; the
// incremental sync (reimport-cloud.sh --sync) runs this instead.
//
// Default: report only. With --prune the docs are deleted in Payload and dropped
// from id-map.json. Payload has no trash on these collections, so a prune can only
// be undone from the Cloud SQL backup reimport-cloud.sh takes first.
//
// Docs created directly in Payload have no id-map entry and are never touched.
//
// Run: node scripts/sql-sync-deletions.mjs [--prune]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bool } from './sql-shared.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL = path.resolve(__dirname, '..', 'data', 'sql')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'
const PRUNE = process.argv.includes('--prune')

const read = (f) => JSON.parse(fs.readFileSync(path.join(SQL, f), 'utf8'))
const exists = (f) => fs.existsSync(path.join(SQL, f))

let TOKEN = ''
const AUTH = () => (process.env.PAYLOAD_API_KEY ? `users API-Key ${process.env.PAYLOAD_API_KEY}` : `JWT ${TOKEN}`)
async function login() {
  if (process.env.PAYLOAD_API_KEY) return
  const r = await fetch(`${BASE}/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((x) => x.json())
  TOKEN = r.token; if (!TOKEN) throw new Error('login failed')
}

// craftIds present in the export, per Payload collection.
function presentIds() {
  const present = {}
  const add = (col, id) => (present[col] ||= new Set()).add(String(id))
  for (const col of ['events', 'news', 'arena', 'artists', 'performance']) {
    present[col] ||= new Set()
    for (const loc of ['nb', 'en']) {
      if (exists(`${col}.${loc}.json`)) for (const r of read(`${col}.${loc}.json`)) add(col, r.id)
      if (exists(`${col}.drafts.${loc}.json`)) {
        for (const r of read(`${col}.drafts.${loc}.json`)) if (r.draftOf == null && !bool(r.provisional)) add(col, r.id)
      }
    }
  }
  present.locations ||= new Set()
  present.organizers ||= new Set()
  for (const loc of ['nb', 'en']) {
    if (!exists(`categories.${loc}.json`)) continue
    for (const c of read(`categories.${loc}.json`)) add(c.group === 'organizersCategory' ? 'organizers' : 'locations', c.id)
  }
  return present
}

async function main() {
  const idMap = read('id-map.json')
  const present = presentIds()
  // Sanity guard: an empty or truncated export would make everything look deleted.
  for (const [col, ids] of Object.entries(present)) {
    const mapped = Object.keys(idMap[col] || {}).length
    if (mapped > 20 && ids.size < mapped * 0.8) {
      throw new Error(`${col}: export has ${ids.size} ids but id-map has ${mapped} — export looks incomplete, refusing`)
    }
  }
  if (PRUNE) await login()

  let total = 0, pruned = 0
  for (const [col, ids] of Object.entries(present)) {
    const gone = Object.entries(idMap[col] || {}).filter(([craftId]) => !ids.has(String(craftId)))
    if (!gone.length) continue
    total += gone.length
    console.log(`${col}: ${gone.length} deleted in Craft — craft# ${gone.map(([c]) => c).join(', ')}`)
    if (!PRUNE) continue
    for (const [craftId, payloadId] of gone) {
      const res = await fetch(`${BASE}/${col}/${payloadId}`, { method: 'DELETE', headers: { Authorization: AUTH() },
        signal: AbortSignal.timeout(30_000) })
      if (res.ok || res.status === 404) { delete idMap[col][craftId]; pruned++ }
      else console.warn(`  ✗ ${col} craft#${craftId} (payload ${payloadId}): ${res.status} ${(await res.text()).slice(0, 120)}`)
    }
  }
  if (PRUNE) fs.writeFileSync(path.join(SQL, 'id-map.json'), JSON.stringify(idMap))
  if (!total) console.log('✓ nothing deleted in Craft since the last import')
  else if (PRUNE) console.log(`✓ pruned ${pruned}/${total} docs from Payload`)
  else console.log(`⚠ ${total} doc(s) deleted in Craft still exist in Payload — re-run with --prune to delete them`)
}

main().catch((e) => { console.error(e); process.exit(1) })
