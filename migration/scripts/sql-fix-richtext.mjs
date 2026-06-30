// Re-patch rich-text fields for already-imported docs using the faithful
// html-to-lexical converter (preserves bold/italic/links/headings/lists/embeds).
//
// Run after the initial import. Idempotent. node scripts/sql-fix-richtext.mjs [collection]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { htmlToLexical } from './html-to-lexical.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL = path.resolve(__dirname, '..', 'data', 'sql')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'

const read = (f) => JSON.parse(fs.readFileSync(path.join(SQL, f), 'utf8'))
const exists = (f) => fs.existsSync(path.join(SQL, f))
const idMap = read('id-map.json')

// collection -> [ [payloadField, craftColumn], ... ] richText fields
const RICH = {
  events: [['intro', 'intro'], ['description', 'description'], ['ticketDescription', 'ticketDescription']],
  news: [['intro', 'newsIntro']],
  artists: [['bio', 'description']],
}
const SECTION = { events: 'events', news: 'news', artists: 'artists' }

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
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`)
}

async function main() {
  await login()
  const only = process.argv[2]
  for (const [collection, fields] of Object.entries(RICH)) {
    if (only && only !== collection) continue
    const section = SECTION[collection]
    let n = 0, patched = 0
    for (const locale of ['nb', 'en']) {
      const f = `${section}.${locale}.json`
      if (!exists(f)) continue
      for (const row of read(f)) {
        const pid = idMap[collection]?.[row.id]
        if (!pid) continue
        const data = { title: row.title || '(untitled)', slug: row.slug || `craft-${row.id}` }
        let any = false
        for (const [pField, craftCol] of fields) {
          const lex = htmlToLexical(row[craftCol])
          if (lex) { data[pField] = lex; any = true }
        }
        n++
        if (!any) continue
        try { await patch(collection, pid, data, locale); patched++ }
        catch (e) { if (patched < 15) console.warn(`  ✗ ${collection}#${row.id} (${locale}): ${e.message.slice(0, 100)}`) }
        if (n % 250 === 0) console.log(`  ${collection}… ${n} (${patched} patched)`)
      }
    }
    console.log(`✓ ${collection}: ${patched} rich-text fields converted`)
  }
  console.log('\n✔ rich-text reconversion complete')
}

main().catch((e) => { console.error(e); process.exit(1) })
