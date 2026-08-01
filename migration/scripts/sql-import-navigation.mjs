// Import Verbb Navigation (Craft) -> Payload `navigationNodes`.
//
// This pass was missing from the original migration (the collection existed but
// was never populated). Reads the restored Craft dump via the craft3 docker db
// (same pattern as sql-export.mjs) and creates nodes via Payload REST (same
// auth pattern as sql-import.mjs).
//
// Scope: the four live menus — festival(5), ostre(6), about(7, empty), toggle(8).
// The legacy mainMenu/mainMenu_old/newNavigation navs are old-site leftovers and
// are deliberately skipped. Nodes are flat (no parents in the data) and have no
// element references (all anchor/URL links), so this is a single pass.
//
// The Craft toggle node pointed at a HARDCODED festival edition
// (`/festival/ekko-xxii`) — the yearly-stale-link problem from frontend issue
// #18 (nav.tsx derives its festival target from this very node, so importing
// it as-is resurrects the bug). Normalized here: toggle links under /festival/
// become the evergreen `/festival` (the index route redirects to the current
// edition via ekko_festival_info) and the title drops the edition suffix.
//
// Idempotent: a node is skipped when one with the same nav+order already exists.
//
// Run: node migration/scripts/sql-import-navigation.mjs
//   PAYLOAD_URL / SEED_EMAIL / SEED_PASSWORD as for the other passes.
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const COMPOSE = path.join(ROOT, 'docker', 'docker-compose.craft3.yml')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'

// Craft navId -> Payload nav handle (frontend filters on these).
const NAVS = { 5: 'festival', 6: 'ostre', 7: 'about', 8: 'toggle' }

function sql(query) {
  const out = execFileSync('docker', [
    'compose', '-f', COMPOSE, 'exec', '-T', 'db',
    'sh', '-c', `mariadb -uroot -proot ekko -N -e "${query.replace(/"/g, '\\"')}"`,
  ])
  return out.toString('utf8').trim()
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  TOKEN = (await res.json()).token
}

// One row per node per site with a title: id, navId, url, newWindow, lft, siteId, title.
const rows = sql(
  `SELECT n.id, n.navId, IFNULL(n.url,''), IFNULL(n.newWindow,0), IFNULL(se.lft,0), c.siteId, c.title
   FROM craft_navigation_nodes n
   LEFT JOIN craft_structureelements se ON se.elementId = n.id
   JOIN craft_content c ON c.elementId = n.id
   WHERE n.navId IN (${Object.keys(NAVS).join(',')}) AND c.title IS NOT NULL
   ORDER BY n.navId, se.lft`,
)
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [id, navId, url, newWindow, lft, siteId, ...title] = l.split('\t')
    return { id, navId, url, newWindow: newWindow === '1', lft: Number(lft), siteId, title: title.join('\t') }
  })

const byNode = new Map()
for (const r of rows) {
  const n = byNode.get(r.id) || { ...r, titles: {} }
  n.titles[r.siteId === '2' ? 'en' : 'nb'] = r.title
  byNode.set(r.id, n)
}

await login()
const existing = await api('/navigationNodes?limit=200&depth=0')
const seen = new Set(existing.docs.map((d) => `${d.nav}:${d.order}`))

let created = 0
for (const node of byNode.values()) {
  const nav = NAVS[node.navId]
  if (!nav || !node.titles.nb) continue
  if (seen.has(`${nav}:${node.lft}`)) continue
  if (nav === 'toggle' && node.url?.startsWith('/festival/')) {
    node.url = '/festival' // evergreen — see header note (issue #18)
    for (const loc of Object.keys(node.titles)) node.titles[loc] = node.titles[loc].replace(/\s+X+[IVX]*$/i, '')
  }
  const doc = await api('/navigationNodes?locale=nb', {
    method: 'POST',
    body: JSON.stringify({
      title: node.titles.nb,
      nav,
      order: node.lft,
      url: node.url || undefined,
      newWindow: node.newWindow,
      nodeType: nav === 'toggle' ? 'toggle' : 'default',
    }),
  })
  if (node.titles.en) {
    await api(`/navigationNodes/${doc.doc.id}?locale=en`, {
      method: 'PATCH',
      body: JSON.stringify({ title: node.titles.en }),
    })
  }
  created++
  console.log(`+ [${nav}] ${node.lft} ${node.titles.nb}${node.titles.en ? ` / en: ${node.titles.en}` : ''}`)
}
console.log(`done: ${created} created, ${byNode.size - created} skipped`)
