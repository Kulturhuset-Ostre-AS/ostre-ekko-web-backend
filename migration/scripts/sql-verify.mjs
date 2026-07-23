// Verify the SQL migration: compares Payload counts to the export, checks that media
// files actually serve, and spot-checks a festival's relations/program.
// Run: node scripts/sql-verify.mjs
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

let TOKEN = ''
async function login() {
  await fetch(`${BASE}/users/first-register`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Verify' }) }).catch(() => {})
  const r = await fetch(`${BASE}/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((x) => x.json())
  TOKEN = r.token; if (!TOKEN) throw new Error('login failed')
}
const api = (p) => fetch(`${BASE}${p}`, { headers: { Authorization: `JWT ${TOKEN}` } }).then((r) => r.json())

// distinct craftIds across locales for a section. Standalone saved drafts
// (draftOf=null, non-provisional) become their own Payload docs, so they count.
const bool = (v) => v === '1' || v === 1 || v === true
function exportCount(section) {
  const ids = new Set()
  for (const loc of ['nb', 'en']) {
    if (exists(`${section}.${loc}.json`)) {
      for (const r of read(`${section}.${loc}.json`)) ids.add(r.id)
    }
    if (exists(`${section}.drafts.${loc}.json`)) {
      for (const r of read(`${section}.drafts.${loc}.json`)) {
        if (r.draftOf == null && !bool(r.provisional)) ids.add(r.id)
      }
    }
  }
  return ids.size
}

async function main() {
  await login()
  let warn = 0
  console.log('collection      export  payload')
  console.log('--------------------------------')
  for (const [section, collection] of Object.entries({
    events: 'events', news: 'news', arena: 'arena', artists: 'artists', performance: 'performance',
  })) {
    const want = exportCount(section)
    const got = (await api(`/${collection}?limit=0&depth=0`)).totalDocs
    const flag = Math.abs(want - got) <= want * 0.05 ? '✓' : '✗ CHECK'
    if (flag !== '✓') warn++
    console.log(`${collection.padEnd(14)} ${String(want).padStart(6)} ${String(got).padStart(8)}  ${flag}`)
  }

  // categories + media
  const catWant = exists('categories.nb.json') ? read('categories.nb.json').length : 0
  const catGot = (await api('/categories?limit=0&depth=0')).totalDocs
  console.log(`${'categories'.padEnd(14)} ${String(catWant).padStart(6)} ${String(catGot).padStart(8)}`)
  const assetWant = exists('assets.json') ? read('assets.json').length : 0
  const mediaGot = (await api('/media?limit=0&depth=0')).totalDocs
  console.log(`${'media'.padEnd(14)} ${String(assetWant).padStart(6)} ${String(mediaGot).padStart(8)}`)

  // drafts / status: public (unauthenticated) reads must only see published docs.
  console.log('\n-- drafts & access control --')
  for (const col of ['events', 'news', 'arena', 'artists', 'performance']) {
    const total = (await api(`/${col}?limit=0&depth=0`)).totalDocs
    const published = (await api(`/${col}?limit=0&depth=0&where%5B_status%5D%5Bequals%5D=published`)).totalDocs
    const publicCount = (await fetch(`${BASE}/${col}?limit=0&depth=0`).then((r) => r.json())).totalDocs
    const flag = publicCount === published ? '✓' : '✗ DRAFT LEAK'
    if (flag !== '✓') warn++
    console.log(`  ${col.padEnd(12)} total ${String(total).padStart(4)}  published ${String(published).padStart(4)}  drafts ${String(total - published).padStart(3)}  public sees ${String(publicCount).padStart(4)}  ${flag}`)
  }

  // media actually serves?
  console.log('\n-- media serving --')
  const sample = (await api('/media?limit=10&depth=0')).docs || []
  let ok = 0
  for (const m of sample) {
    try { if ((await fetch(m.url)).ok) ok++ } catch {}
  }
  console.log(`  ${ok}/${sample.length} sampled media files serve HTTP 200${ok < sample.length ? '  ✗ CHECK staticDir/volume' : '  ✓'}`)
  if (ok < sample.length) warn++

  // spot-check festival program/relations (published only — the newest-created
  // docs are imported drafts, which would dominate an unfiltered sample)
  console.log('\n-- festival spot-check --')
  const pub = 'where%5B_status%5D%5Bequals%5D=published'
  const fests = (await api(`/events?where%5BentryType%5D%5Bequals%5D=festival&${pub}&limit=20&depth=0&locale=nb`)).docs || []
  const withProgram = fests.filter((e) => (e.program || []).length).length
  console.log(`  ${withProgram}/${fests.length} sampled festivals have program days`)
  if (fests.length && withProgram === 0) { console.log('  ✗ program import may have failed'); warn++ }

  // events with a resolved featured image
  const ev = (await api(`/events?${pub}&limit=20&depth=1&locale=nb`)).docs || []
  const withImg = ev.filter((e) => e.eventFeaturedPhoto && typeof e.eventFeaturedPhoto === 'object' && e.eventFeaturedPhoto.url).length
  console.log(`  ${withImg}/${ev.length} sampled events have a featured image`)

  // Duplicate slugs — the failure mode from importing Craft revisions. Public pages
  // use where:{slug}, limit:1, so duplicate slugs silently render the wrong doc.
  // Only PUBLISHED duplicates are errors: the public site never sees drafts, and a
  // Craft draft may legitimately share its slug with a published entry (info only).
  console.log('\n-- unique slugs (regression guard for revision import) --')
  for (const col of ['events', 'news', 'artists']) {
    const docs = (await api(`/${col}?limit=2000&depth=0&locale=nb`)).docs || []
    const pubCounts = new Map()
    const allCounts = new Map()
    for (const d of docs) {
      if (!d.slug) continue
      allCounts.set(d.slug, (allCounts.get(d.slug) || 0) + 1)
      if (d._status !== 'draft') pubCounts.set(d.slug, (pubCounts.get(d.slug) || 0) + 1)
    }
    const dupes = [...pubCounts.entries()].filter(([, c]) => c > 1)
    const draftDupes = [...allCounts.entries()].filter(([s, c]) => c > 1 && (pubCounts.get(s) || 0) <= 1)
    if (dupes.length) {
      warn++
      console.log(`  ${col}: ✗ ${dupes.length} DUPLICATE published slug(s) — did revisions get imported? e.g. ${dupes.slice(0, 3).map(([s, c]) => `${s}(×${c})`).join(', ')}`)
    } else {
      console.log(`  ${col}: ✓ ${pubCounts.size} unique published slugs, no duplicates`)
    }
    if (draftDupes.length) {
      console.log(`  ${col}: ℹ ${draftDupes.length} draft(s) share a slug with a published doc (hidden publicly): ${draftDupes.slice(0, 3).map(([s]) => s).join(', ')}`)
    }
  }

  console.log(warn ? `\n⚠ ${warn} check(s) flagged — review above.` : '\n✔ verification passed')
  process.exit(warn ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
