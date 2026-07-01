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

// distinct craftIds across locales for a section
function exportCount(section) {
  const ids = new Set()
  for (const loc of ['nb', 'en']) {
    if (!exists(`${section}.${loc}.json`)) continue
    for (const r of read(`${section}.${loc}.json`)) ids.add(r.id)
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

  // media actually serves?
  console.log('\n-- media serving --')
  const sample = (await api('/media?limit=10&depth=0')).docs || []
  let ok = 0
  for (const m of sample) {
    try { if ((await fetch(m.url)).ok) ok++ } catch {}
  }
  console.log(`  ${ok}/${sample.length} sampled media files serve HTTP 200${ok < sample.length ? '  ✗ CHECK staticDir/volume' : '  ✓'}`)
  if (ok < sample.length) warn++

  // spot-check festival program/relations
  console.log('\n-- festival spot-check --')
  const fests = (await api('/events?where%5BentryType%5D%5Bequals%5D=festival&limit=20&depth=0&locale=nb')).docs || []
  const withProgram = fests.filter((e) => (e.program || []).length).length
  console.log(`  ${withProgram}/${fests.length} sampled festivals have program days`)
  if (fests.length && withProgram === 0) { console.log('  ✗ program import may have failed'); warn++ }

  // events with a resolved featured image
  const ev = (await api('/events?limit=20&depth=1&locale=nb')).docs || []
  const withImg = ev.filter((e) => e.eventFeaturedPhoto && typeof e.eventFeaturedPhoto === 'object' && e.eventFeaturedPhoto.url).length
  console.log(`  ${withImg}/${ev.length} sampled events have a featured image`)

  console.log(warn ? `\n⚠ ${warn} check(s) flagged — review above.` : '\n✔ verification passed')
  process.exit(warn ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
