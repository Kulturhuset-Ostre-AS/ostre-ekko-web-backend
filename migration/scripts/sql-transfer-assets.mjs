// Transfer Craft asset files into Payload media. Fetches each file from the running
// Craft 3 web server (which serves /uploads/...) and uploads to Payload, recording
// craftAssetId -> payloadMediaId in data/sql/asset-map.json.
//
// Resumable: skips assets already in the map. Run: node scripts/sql-transfer-assets.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL = path.resolve(__dirname, '..', 'data', 'sql')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const CRAFT = process.env.CRAFT_WEB || 'http://localhost:8390'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'

// volume handle -> URL path under the Craft web root
const VOLUME_PATH = {
  artistPhotos: 'uploads/photos/artists',
  eventPhoto: 'uploads/photos/events',
  mixtapes: 'uploads/mixtapes',
  userPhotos: 'userphotos', // @storage — may not be web-served; skipped if 404
}

let TOKEN = ''
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

const mimeOf = (f) => {
  const e = f.toLowerCase().split('.').pop()
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', pdf: 'application/pdf' }[e] || 'application/octet-stream'
}

function assetUrl(a) {
  const base = VOLUME_PATH[a.volume]
  if (!base) return null
  const folder = (a.folderPath || '').replace(/^\/|\/$/g, '')
  const parts = [base, folder, a.filename].filter(Boolean)
  return `${CRAFT}/${parts.join('/')}`
}

async function main() {
  await login()
  const assets = JSON.parse(fs.readFileSync(path.join(SQL, 'assets.json'), 'utf8'))
  const mapPath = path.join(SQL, 'asset-map.json')
  const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {}

  let ok = 0, fail = 0, skip = 0
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i]
    if (map[a.id]) { skip++; continue }
    const url = assetUrl(a)
    if (!url) { fail++; continue }
    try {
      const res = await fetch(url)
      if (!res.ok) { fail++; if (fail <= 10) console.warn(`  ${res.status} ${url}`); continue }
      const buf = Buffer.from(await res.arrayBuffer())
      const fd = new FormData()
      fd.append('file', new Blob([buf], { type: mimeOf(a.filename) }), a.filename)
      fd.append('_payload', JSON.stringify({
        craftId: Number(a.id), alt: a.title || a.filename, source: a.volume,
      }))
      const up = await fetch(`${BASE}/media`, { method: 'POST', headers: { Authorization: `JWT ${TOKEN}` }, body: fd })
      const j = await up.json()
      if (!up.ok) { fail++; if (fail <= 10) console.warn(`  upload ${a.filename}: ${JSON.stringify(j).slice(0,120)}`); continue }
      map[a.id] = j.doc.id
      ok++
      if (ok % 100 === 0) { fs.writeFileSync(mapPath, JSON.stringify(map)); console.log(`  …${ok} uploaded (${i + 1}/${assets.length})`) }
    } catch (e) {
      fail++; if (fail <= 10) console.warn(`  err ${a.filename}: ${e.message.slice(0, 100)}`)
    }
  }
  fs.writeFileSync(mapPath, JSON.stringify(map))
  console.log(`\n✔ assets: ${ok} uploaded, ${skip} skipped, ${fail} failed -> asset-map.json (${Object.keys(map).length} total)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
