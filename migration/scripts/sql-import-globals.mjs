// Import Craft singles -> Payload globals (pass 5).
//
// The sql toolkit never had a globals pass (only the legacy 05-import script
// handled singles), AND the export used to drop rows containing double-encoded
// quotes — so the six content globals (about, legal, archive, homepage, oestre,
// ekko_festival_info) sat empty in the cloud. Both are fixed (b64 export +
// this pass).
//
// Imports per global × locale: title, pageContent/contact (HTML -> lexical),
// pagePhoto (simple globals), gallery + linkedFestival (rich globals), and
// `sections` matrix blocks -> the globals' `entry` block (heading/body/images).
// Deliberately skipped (logged, not silent): pastevents (archive),
// pagestructure (homepage), relatedlinks — nothing in the frontend reads them
// from globals today.
//
// Relations/uploads resolve via id-map.json + asset-map.json, which map to the
// TARGET instance's ids — run against the same instance the maps were built
// for (the cloud maps live in data/sql after the 2026-07-29 full import).
//
// Idempotent: globals are single documents; re-running overwrites with the
// same data. Run: node migration/scripts/sql-import-globals.mjs [globalSlug]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { htmlToLexical } from './html-to-lexical.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SQL = path.join(ROOT, 'data', 'sql')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'

const LOCALES = [{ site: 'nb', locale: 'nb', siteId: '1' }, { site: 'en', locale: 'en', siteId: '2' }]
const read = (f) => JSON.parse(fs.readFileSync(path.join(SQL, f), 'utf8'))

// slug -> shape. rich = pageContent/contact/gallery/linkedFestival/sections;
// simple = pageContent/pagePhoto.
const GLOBALS = {
  about: 'simple',
  legal: 'simple',
  archive: 'simple',
  homepage: 'rich',
  oestre: 'rich',
  ekko_festival_info: 'rich',
}

let TOKEN = ''
async function api(p, opts = {}) {
  const res = await fetch(`${BASE}${p}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${TOKEN}`, ...(opts.headers || {}) },
  })
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p}: ${res.status} ${await res.text()}`)
  return res.json()
}
async function login() {
  const res = await fetch(`${BASE}/users/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  TOKEN = (await res.json()).token
}

const only = process.argv[2]
const idMap = read('id-map.json')
const assetMap = read('asset-map.json')
const relations = read('_relations.json')
const matrix = read('_matrix.json')

const mediaId = (craftAssetId) => assetMap[craftAssetId] || assetMap[String(craftAssetId)]
const eventId = (craftId) => idMap.events?.[craftId] || idMap.events?.[String(craftId)]

function buildSectionBlocks(craftId, siteId) {
  return (matrix.sections?.[craftId]?.[siteId] || []).map((b) => {
    const imgs = (relations[b.id]?.images || relations[b.id]?.image || []).map(mediaId).filter(Boolean)
    return {
      blockType: 'entry',
      heading: b.entry_sectionTitle || undefined,
      body: htmlToLexical(b.entry_sectionBody),
      ...(imgs.length ? { images: imgs } : {}),
    }
  }).filter((s) => s.heading || s.body || s.images)
}

await login()
for (const [slug, shape] of Object.entries(GLOBALS)) {
  if (only && only !== slug) continue
  for (const { site, locale, siteId } of LOCALES) {
    const rows = read(`${slug}.${site}.json`)
    const row = rows[0]
    if (!row) { console.warn(`  ! ${slug}.${site}: no exported row`) ; continue }
    const rel = relations[String(row.id)] || {}

    const data = {
      craftId: Number(row.id),
      title: row.title || undefined,
      pageContent: htmlToLexical(row.pageContent),
    }
    if (shape === 'simple') {
      const photo = (rel.pagePhoto || []).map(mediaId).filter(Boolean)[0]
      if (photo) data.pagePhoto = photo
    } else {
      data.contact = htmlToLexical(row.contact)
      const gallery = (rel.gallery || []).map(mediaId).filter(Boolean)
      if (gallery.length) data.gallery = gallery
      const fests = (rel.linkedFestival || []).map(eventId).filter(Boolean)
      if (fests.length) data.linkedFestival = fests
      const sections = buildSectionBlocks(String(row.id), siteId)
      if (sections.length) data.sections = sections
    }
    // Drop undefined/null so we never blank out a field we cannot source.
    for (const k of Object.keys(data)) if (data[k] == null) delete data[k]

    await api(`/globals/${slug}?locale=${locale}`, { method: 'POST', body: JSON.stringify(data) })
    console.log(`✓ ${slug}.${site}: ${Object.keys(data).join(', ')}`)
  }
}
const skipped = ['pastevents(archive)', 'pagestructure(homepage)', 'relatedlinks(oestre)']
console.log(`done. skipped matrix fields (no frontend consumer via globals): ${skipped.join(', ')}`)
