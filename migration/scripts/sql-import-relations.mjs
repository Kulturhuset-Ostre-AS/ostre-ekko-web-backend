// Pass 2: resolve relationships, uploads, and matrix blocks for already-created docs.
// Uses data/sql/id-map.json (craftId->payloadId per collection) + asset-map.json.
//
// Run AFTER sql-import.mjs (pass 1) and sql-transfer-assets.mjs.
//   node scripts/sql-import-relations.mjs [collection]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

// craftId -> { title, slug } per section (PATCH revalidates required title; carry it).
// Load BOTH locales so en-only entries (no nb row) still have a title to satisfy the
// required localized field when we patch in the nb locale.
const titleBySection = {}
for (const section of ['events', 'news', 'arena', 'artists', 'performance']) {
  const t = {}
  for (const loc of ['en', 'nb']) { // nb last so it wins when present
    const f = `${section}.${loc}.json`
    if (!exists(f)) continue
    for (const row of read(f)) t[row.id] = { title: row.title || '(untitled)', slug: row.slug || `craft-${row.id}` }
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

// Craft relation field -> Payload field name on the doc (per collection). Assets vs
// entries vs categories handled by what the target resolves to.
const FIELD_MAP = {
  // events
  eventFeaturedPhoto: 'eventFeaturedPhoto', gallery: 'gallery', organizer: 'organizer',
  location: 'location', performances: 'performances', linkedEvents: 'linkedEvents',
  linkedFestival: 'linkedFestival', linkednews: 'linkednews',
  festivalSectionGraphicElements: 'festivalSectionGraphicElements',
  // artists / performance
  artistFeaturedPhoto: 'artistFeaturedPhoto', artist: 'artist', performance: 'performance',
  images: 'images',
  // news
  newsPhoto: 'newsPhoto', pagePhoto: 'pagePhoto',
}
// Fields that are single (not hasMany) on the Payload side.
const SINGLE = new Set(['eventFeaturedPhoto', 'artistFeaturedPhoto', 'newsPhoto', 'pagePhoto', 'organizer'])
// Fields that point to media (assets) rather than entries.
const ASSET_FIELDS = new Set(['eventFeaturedPhoto', 'artistFeaturedPhoto', 'newsPhoto', 'pagePhoto', 'gallery', 'images', 'festivalSectionGraphicElements'])

// ---- lexical conversion (same as pass 1) ----
function htmlToLexical(html) {
  if (!html || typeof html !== 'string') return undefined
  const blocks = html.replace(/<\s*br\s*\/?>/gi, '\n').split(/<\/(?:p|div|h[1-6]|li)>/i)
    .map((s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()).filter(Boolean)
  if (!blocks.length) return undefined
  return { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: blocks.map((text) => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
      children: [{ type: 'text', text, format: 0, version: 1, mode: 'normal', style: '', detail: 0 }] })) } }
}

// Build Payload complexContent blocks from Craft matrix blocks for one owner+site.
function buildComplexContent(ownerCraftId, siteId) {
  const blocks = matrix.complexcontent?.[ownerCraftId]?.[siteId] || []
  const out = []
  for (const b of blocks) {
    switch (b.blockType) {
      case 'text': out.push({ blockType: 'text2', text: htmlToLexical(b.text_text || b.text) }); break
      case 'video': out.push({ blockType: 'video', videoUrl: b.video_videoUrl || b.videoUrl }); break
      case 'embed': out.push({ blockType: 'embed', code: b.embed_code || b.code }); break
      case 'imageBlock': {
        // imageBlock image is a relation on the block element; resolved via relations map
        const imgRels = relations[b.id]?.image || relations[b.id]?.imageBlock || []
        const mid = imgRels.map(mediaId).filter(Boolean)[0]
        out.push({ blockType: 'imageBlock', image: mid })
        break
      }
    }
  }
  return out.filter((b) => b.text || b.videoUrl || b.code || b.image)
}

let TOKEN = ''
async function login() {
  await fetch(`${BASE}/users/first-register`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Import' }) }).catch(() => {})
  const r = await fetch(`${BASE}/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((x) => x.json())
  TOKEN = r.token; if (!TOKEN) throw new Error('login failed')
}
async function patch(col, id, data, locale) {
  const res = await fetch(`${BASE}/${col}/${id}?locale=${locale}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `JWT ${TOKEN}` },
    body: JSON.stringify(data) })
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 150)}`)
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
      // relationships / uploads
      const rels = relations[craftId] || {}
      for (const [craftField, targets] of Object.entries(rels)) {
        const pField = FIELD_MAP[craftField]
        if (!pField) continue
        let ids
        if (ASSET_FIELDS.has(craftField)) {
          ids = targets.map(mediaId).filter(Boolean)
        } else {
          ids = targets.map((t) => findPayloadId(t)?.id).filter(Boolean)
        }
        if (!ids.length) continue
        data[pField] = SINGLE.has(craftField) ? ids[0] : ids
      }
      // matrix complexContent (events/news/artists/arena)
      if (['events', 'news', 'artists', 'arena'].includes(col)) {
        const cc = buildComplexContent(craftId, 1) // nb site blocks
        if (cc.length) data.complexContent = cc
      }
      // Only patch if there's real relation/matrix data (title/slug alone = skip).
      const hasPayload = Object.keys(data).some((k) => k !== 'title' && k !== 'slug')
      if (hasPayload) {
        try { await patch(col, payloadId, data, 'nb') }
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
