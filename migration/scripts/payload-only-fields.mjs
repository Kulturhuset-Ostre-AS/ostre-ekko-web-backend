// Keep Payload-only fields across a reset + re-import.
//
// Some fields exist only in Payload (no Craft source): the ticket shop, door
// times, age limit, fanzine, ticket categories, venue capacity. sql-reset wipes
// them together with the content, and the import passes can't bring them back.
//
//   snapshot: read them from Payload (latest version incl. drafts, all locales),
//             keyed by craftId. Relations are stored as craftIds, because
//             performance/locations get NEW ids on re-import. Media ids are
//             stored as-is (sql-reset keeps media).
//   restore:  write them back onto the re-imported docs, matched by craftId.
//
// Run: node scripts/payload-only-fields.mjs snapshot [out.json]
//      node scripts/payload-only-fields.mjs restore  [in.json]
// Default file: data/sql/payload-only-snapshot.json (snapshot also writes a
// timestamped copy next to it).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL = path.resolve(__dirname, '..', 'data', 'sql')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'
const LOCALES = ['nb', 'en']

// ---- what is Payload-only -------------------------------------------------------
// Top-level event fields. `localized`: value is per locale. `rel`: relation fields
// inside array rows that must be remapped via craftId. `localizedSub`: localized
// subfields inside array rows.
const EVENT_FIELDS = {
  doorsOpenTime: {},
  ageLimit: { localized: true },
  practicalInfo: { localized: true },
  spilleplan: { localized: true },
  doorsOpenByVenue: { rel: { location: 'locations' } },
  ticketTypes: { localizedSub: ['name'] },
  fanzine: {},
}
// Payload-only subfields on Craft-owned array rows: merged into the re-imported rows.
const EVENT_ROW_FIELDS = {
  tickets: {
    fields: ['category', 'validFor', 'ticketAgeLimit', 'guardianInfo', 'accessibilityInfo', 'practicalInfo'],
    rel: { relatedPerformances: 'performance' },
    // Craft-owned row fields: a row is the "same" row if these are identical.
    // If Craft edited the row since, fall back to the same position as long as
    // the row count is unchanged.
    matchOn: ['description', 'subdescription', 'price', 'ticketLink', 'textContent'],
  },
}
const LOCATION_FIELDS = ['capacity']

// ---- API helpers (timeout + retry, see sql-import-relations.mjs 2026-08-01) -------
let TOKEN = ''
async function api(p, opts = {}) {
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
  const r = await fetch(`${BASE}/users/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((x) => x.json())
  TOKEN = r.token
  if (!TOKEN) throw new Error('login failed')
}

// All docs of a collection (latest version incl. drafts), only the selected fields.
async function findAll(collection, fields, { locale = 'all' } = {}) {
  const select = ['craftId', '_status', ...fields].map((f) => `select[${f}]=true`).join('&')
  const docs = []
  for (let page = 1; ; page++) {
    const r = await api(`/${collection}?limit=100&page=${page}&depth=0&draft=true&locale=${locale}&${select}`)
    docs.push(...r.docs)
    if (!r.hasNextPage) return docs
  }
}
async function idMaps(collection) {
  const docs = await findAll(collection, [], { locale: 'nb' })
  const toCraft = {}, fromCraft = {}
  for (const d of docs) if (d.craftId != null) { toCraft[d.id] = d.craftId; fromCraft[d.craftId] = d.id }
  return { toCraft, fromCraft }
}

// Empty = null/''/[] or a locale map (locale=all) whose values are all empty.
const isLocaleMap = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => LOCALES.includes(k))
const isEmpty = (v) =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0) ||
  (isLocaleMap(v) && Object.values(v).every(isEmpty))
const pickLocale = (v, locale) => (isLocaleMap(v) ? v[locale] ?? v[LOCALES[0]] : v)
const rowKey = (row, spec) => (row ? JSON.stringify(spec.matchOn.map((f) => row[f] ?? null)) : null)
const relId = (v) => (v && typeof v === 'object' ? v.id : v)
const mapRel = (v, map) => (Array.isArray(v) ? v.map((x) => map[relId(x)]).filter((x) => x != null) : map[relId(v)] ?? null)

// ---- snapshot -----------------------------------------------------------------
async function snapshot(file) {
  const perf = await idMaps('performance')
  const locs = await idMaps('locations')
  const relMaps = { performance: perf.toCraft, locations: locs.toCraft }

  const events = {}
  let orphans = 0
  const docs = await findAll('events', [...Object.keys(EVENT_FIELDS), ...Object.keys(EVENT_ROW_FIELDS)])
  for (const d of docs) {
    const entry = snapshotEntry(d, relMaps)
    if (!entry) continue
    if (d.craftId == null) { orphans++; console.warn(`  ! event ${d.id} has Payload-only data but no craftId — NOT restorable`); continue }
    events[d.craftId] = entry
  }

  const locations = {}
  for (const d of await findAll('locations', LOCATION_FIELDS, { locale: 'nb' })) {
    const fields = Object.fromEntries(LOCATION_FIELDS.filter((f) => !isEmpty(d[f])).map((f) => [f, d[f]]))
    if (Object.keys(fields).length && d.craftId != null) locations[d.craftId] = fields
  }

  const out = { takenAt: new Date().toISOString(), base: BASE, events, locations }
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  const stamped = file.replace(/\.json$/, `-${out.takenAt.replace(/[:.]/g, '-')}.json`)
  fs.copyFileSync(file, stamped)
  console.log(`✓ snapshot: ${Object.keys(events).length} events, ${Object.keys(locations).length} locations -> ${path.relative(process.cwd(), file)}`)
  for (const [craftId, e] of Object.entries(events)) {
    const parts = [...Object.keys(e.fields), ...Object.entries(e.rows).map(([k, r]) => `${k}[${r.length}]`)]
    console.log(`    craftId ${craftId} (${e.status}): ${parts.join(', ')}`)
  }
  if (orphans) console.warn(`⚠ ${orphans} event(s) without craftId skipped`)
}

// One event doc (locale=all, depth=0) -> its Payload-only data, or null if it has none.
function snapshotEntry(d, relMaps) {
  const entry = { status: d._status, fields: {}, rows: {} }
  for (const [name, spec] of Object.entries(EVENT_FIELDS)) {
    const v = d[name]
    if (isEmpty(v)) continue
    entry.fields[name] = spec.rel
      ? v.map((row) => {
          const out = { ...row }
          for (const [k, coll] of Object.entries(spec.rel)) out[k] = mapRel(row[k], relMaps[coll])
          return out
        })
      : v
  }
  for (const [name, spec] of Object.entries(EVENT_ROW_FIELDS)) {
    const all = d[name] || []
    const rows = all.map((row, index) => {
      const fields = {}
      for (const f of spec.fields) if (!isEmpty(row[f])) fields[f] = row[f]
      for (const [k, coll] of Object.entries(spec.rel)) if (!isEmpty(row[k])) fields[k] = mapRel(row[k], relMaps[coll])
      return { index, count: all.length, key: rowKey(row, spec), fields }
    }).filter((r) => Object.keys(r.fields).length)
    if (rows.length) entry.rows[name] = rows
  }
  return Object.keys(entry.fields).length || Object.keys(entry.rows).length ? entry : null
}

// ---- restore ------------------------------------------------------------------
function localePatch(snap, locale, relMaps) {
  const data = {}
  for (const [name, spec] of Object.entries(EVENT_FIELDS)) {
    const v = snap.fields[name]
    if (v === undefined) continue
    if (spec.localized) {
      const lv = isLocaleMap(v) ? v[locale] : locale === LOCALES[0] ? v : undefined
      if (!isEmpty(lv)) data[name] = lv
      continue
    }
    if (spec.localizedSub) {
      // Rows with localized subfields go out in every locale; row ids are kept so
      // the second locale writes into the same rows.
      data[name] = v.map((row) => {
        const out = { ...row }
        for (const sub of spec.localizedSub) out[sub] = pickLocale(row[sub], locale)
        return out
      })
      continue
    }
    if (locale !== LOCALES[0]) continue // non-localized: written once
    data[name] = spec.rel
      ? v.map((row) => {
          const out = { ...row }
          for (const [k, coll] of Object.entries(spec.rel)) out[k] = mapRel(row[k], relMaps[coll])
          return out
        })
      : v
  }
  return data
}

function mergeRows(current, snapRows, spec, relMaps, warn) {
  const rows = (current || []).map((r) => ({ ...r }))
  const used = new Set()
  for (const s of snapRows) {
    let i = rowKey(rows[s.index], spec) === s.key && !used.has(s.index) ? s.index : -1
    if (i < 0) i = rows.findIndex((r, j) => !used.has(j) && rowKey(r, spec) === s.key)
    if (i < 0 && rows.length === s.count && !used.has(s.index)) i = s.index
    if (i < 0) { warn(`row ${s.index} (${s.key.slice(0, 60)}) not found in re-imported data — skipped`); continue }
    used.add(i)
    for (const [k, v] of Object.entries(s.fields)) {
      const coll = spec.rel[k]
      rows[i][k] = coll ? mapRel(v, relMaps[coll]) : v
    }
  }
  return rows
}

async function restore(file) {
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'))
  console.log(`Restoring snapshot from ${snap.takenAt} (${Object.keys(snap.events).length} events, ${Object.keys(snap.locations).length} locations)`)
  const events = await idMaps('events')
  const perf = await idMaps('performance')
  const locs = await idMaps('locations')
  // snapshot relations hold craftIds -> map to the NEW payload ids
  const relMaps = { performance: perf.fromCraft, locations: locs.fromCraft }

  let ok = 0, failed = 0, warnings = 0
  for (const [craftId, e] of Object.entries(snap.events)) {
    const id = events.fromCraft[craftId]
    const warn = (m) => { warnings++; console.warn(`  ! event craftId ${craftId}: ${m}`) }
    if (!id) { warn('not found after re-import — skipped'); failed++; continue }
    try {
      const current = await api(`/events/${id}?depth=0&draft=true&locale=${LOCALES[0]}`)
      // A doc whose newest version is a draft gets the fields on that draft;
      // otherwise the PATCH republishes it with the fields.
      const draft = current._status === 'draft' ? '&draft=true' : ''
      for (const locale of LOCALES) {
        const data = localePatch(e, locale, relMaps)
        if (locale === LOCALES[0]) {
          for (const [name, rows] of Object.entries(e.rows)) {
            data[name] = mergeRows(current[name], rows, EVENT_ROW_FIELDS[name], relMaps, warn)
          }
        }
        if (Object.keys(data).length) {
          await api(`/events/${id}?locale=${locale}&depth=0${draft}`, { method: 'PATCH', body: JSON.stringify(data) })
        }
      }
      ok++
    } catch (err) {
      failed++
      console.error(`  ✗ event craftId ${craftId} (id ${id}): ${err.message}`)
    }
  }
  for (const [craftId, fields] of Object.entries(snap.locations)) {
    const id = locs.fromCraft[craftId]
    if (!id) { warnings++; console.warn(`  ! location craftId ${craftId} not found — skipped`); continue }
    await api(`/locations/${id}?depth=0`, { method: 'PATCH', body: JSON.stringify(fields) })
  }
  console.log(`✓ restore: ${ok} events restored, ${failed} failed, ${warnings} warning(s)`)
  if (failed) process.exit(1)
}

export { EVENT_FIELDS, EVENT_ROW_FIELDS, isEmpty, rowKey, snapshotEntry, localePatch, mergeRows }

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, fileArg] = process.argv.slice(2)
  const file = path.resolve(fileArg || path.join(SQL, 'payload-only-snapshot.json'))
  await login()
  if (cmd === 'snapshot') await snapshot(file)
  else if (cmd === 'restore') await restore(file)
  else { console.error('usage: payload-only-fields.mjs snapshot|restore [file]'); process.exit(2) }
}
