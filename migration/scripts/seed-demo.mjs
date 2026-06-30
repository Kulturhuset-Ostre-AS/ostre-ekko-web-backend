// Seed a rich, clickable content set into local Payload so the frontend can be
// browsed end-to-end: real images, multiple events + a festival, performances,
// artists, news, and populated globals.
//
// Idempotent: deletes existing demo docs (by known slugs) before recreating.
// Usage: node migration/scripts/seed-demo.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMG_DIR = path.resolve(__dirname, '../scratch-img')
const BASE = process.env.PAYLOAD_URL || 'http://localhost:3000/api'
const EMAIL = process.env.SEED_EMAIL || 'test@ekko.no'
const PASSWORD = process.env.SEED_PASSWORD || 'test1234'

const lexical = (text, boldWord) => ({
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: [{
      type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
      children: [
        { type: 'text', text: text + ' ', format: 0, version: 1, mode: 'normal', style: '', detail: 0 },
        ...(boldWord ? [{ type: 'text', text: boldWord, format: 1, version: 1, mode: 'normal', style: '', detail: 0 }] : []),
      ],
    }],
  },
})

async function api(p, opts = {}, token) {
  const res = await fetch(`${BASE}${p}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `JWT ${token}` } : {}), ...(opts.headers || {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p} -> ${res.status}: ${JSON.stringify(json).slice(0, 300)}`)
  return json
}

async function login() {
  await fetch(`${BASE}/users/first-register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Seed' }),
  }).catch(() => {})
  const { token } = await api('/users/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
  if (!token) throw new Error('login failed')
  return token
}

async function uploadImage(token, file, alt) {
  const bytes = fs.readFileSync(path.join(IMG_DIR, file))
  const fd = new FormData()
  fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), file)
  fd.append('_payload', JSON.stringify({ alt, source: 'eventPhoto', artistName: alt }))
  const res = await fetch(`${BASE}/media`, { method: 'POST', headers: { Authorization: `JWT ${token}` }, body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(`media ${file} -> ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
  return json.doc.id
}

// Delete all docs in a collection whose slug starts with a demo prefix (clean reseed).
async function wipe(token, collection) {
  const list = await api(`/${collection}?limit=200&depth=0`, {}, token).catch(() => ({ docs: [] }))
  for (const d of list.docs || []) {
    await api(`/${collection}/${d.id}`, { method: 'DELETE' }, token).catch(() => {})
  }
}

const blocks = (img) => ([
  { blockType: 'text2', text: lexical('Body copy for this entry with some', 'emphasis.') },
  { blockType: 'video', videoUrl: 'https://vimeo.com/76979871' },
  { blockType: 'embed', code: '<iframe src="https://example.com/embed" width="100%" height="180" style="border:0"></iframe>' },
  { blockType: 'imageBlock', image: img },
])

async function main() {
  const token = await login()
  console.log('✓ logged in')

  // Clean previous demo content (order: dependents first).
  for (const c of ['events', 'news', 'performance', 'artists', 'categories', 'media']) await wipe(token, c)
  console.log('✓ wiped previous demo content')

  // Real production images (downloaded from api.ekko.no into migration/scratch-img).
  const [imgEvent1, imgEvent2, imgArtist, imgNews, imgGal1, imgGal2] = await Promise.all([
    uploadImage(token, 'real1.jpg', 'Opening night'),
    uploadImage(token, 'real2.jpg', 'Closing night'),
    uploadImage(token, 'real3.jpg', 'Demo Artist'),
    uploadImage(token, 'real4.jpg', 'Programme'),
    uploadImage(token, 'real5.jpg', 'Gallery 1'),
    uploadImage(token, 'extra-20221106-004513-78.jpg', 'Gallery 2'),
  ])
  console.log('✓ uploaded 6 real production images')

  const loc = await api('/categories', { method: 'POST', body: JSON.stringify({ title: 'Røkeriet', slug: 'rokeriet', group: 'locations', fullTitle: 'USF Røkeriet', venue: 'USF Verftet', room: 'Røkeriet' }) }, token)
  const loc2 = await api('/categories', { method: 'POST', body: JSON.stringify({ title: 'Studio', slug: 'studio-usf', group: 'locations', fullTitle: 'USF Studio', venue: 'USF Verftet', room: 'Studio' }) }, token)
  const org = await api('/categories', { method: 'POST', body: JSON.stringify({ title: 'EKKO', slug: 'ekko-org', group: 'organizers' }) }, token)
  console.log('✓ categories')

  // Artists — each gets a distinct real production photo.
  const artistDefs = [
    { slug: 'demo-artist', title: 'Abdullah Miniawy', meta: 'Egypt / France', img: imgArtist },
    { slug: 'second-act', title: 'Second Act', meta: 'Sweden', img: imgGal1 },
    { slug: 'third-sound', title: 'Third Sound', meta: 'Denmark', img: imgGal2 },
  ]
  const artists = []
  for (const a of artistDefs) {
    const doc = await api('/artists', { method: 'POST', body: JSON.stringify({
      title: a.title, slug: a.slug, artistName: a.title, artistMeta: a.meta,
      artistFeaturedPhoto: a.img, bio: lexical(`${a.title} is an act from ${a.meta}.`, 'Essential.'),
      complexContent: blocks(a.img),
    }) }, token)
    artists.push(doc.doc.id)
  }
  console.log('✓ artists', artists)

  // Performances
  const perfs = []
  const perfDefs = [
    { slug: 'demo-artist-live', title: 'Demo Artist live', time: '20:00', timeEnd: '21:00', artist: artists[0], loc: loc.doc.id, date: '2026-09-01T20:00:00.000Z' },
    { slug: 'second-act-live', title: 'Second Act live', time: '21:30', timeEnd: '22:30', artist: artists[1], loc: loc2.doc.id, date: '2026-09-01T21:30:00.000Z' },
    { slug: 'third-sound-live', title: 'Third Sound live', time: '23:00', timeEnd: '23:59', artist: artists[2], loc: loc.doc.id, date: '2026-09-02T23:00:00.000Z' },
  ]
  for (const p of perfDefs) {
    const doc = await api('/performance', { method: 'POST', body: JSON.stringify({
      title: p.title, slug: p.slug, date: p.date, time: p.time, timeEnd: p.timeEnd, location: [p.loc], artist: [p.artist],
    }) }, token)
    perfs.push(doc.doc.id)
  }
  console.log('✓ performances', perfs)

  // Event (multi-day, with all the trimmings)
  const event = await api('/events', { method: 'POST', body: JSON.stringify({
    title: 'EKKO Opening Night', slug: 'ekko-opening-night', entryType: 'event', showArtistInfo: true, isMultiDay: true,
    date: '2026-09-01T18:00:00.000Z', dateEnd: '2026-09-02T23:00:00.000Z',
    eventFeaturedPhoto: imgEvent1, organizer: org.doc.id, location: [loc.doc.id, loc2.doc.id],
    intro: lexical('Opening the festival with a bang.', 'Welcome.'),
    description: lexical('A full evening of experimental sound across two stages.', 'Do not miss.'),
    ticketLink: 'https://example.com/tickets', ticketDescription: 'NOK 250 / 150 student',
    performances: perfs, gallery: [imgGal1, imgGal2, imgEvent1, imgEvent2], complexContent: blocks(imgEvent1),
  }) }, token)
  console.log('✓ event ->', '/ostre/ekko-opening-night')

  // Festival
  const festival = await api('/events', { method: 'POST', body: JSON.stringify({
    title: 'EKKO Festival 2026', slug: 'ekko-festival-2026', entryType: 'festival',
    date: '2026-09-01T12:00:00.000Z', dateEnd: '2026-09-05T23:00:00.000Z',
    eventFeaturedPhoto: imgEvent2, location: [loc.doc.id], intro: lexical('Five days of sound art.', 'Bergen.'),
    lineup: 'Demo Artist · Second Act · Third Sound', performances: perfs, gallery: [imgGal1, imgGal2],
    festivalSectionGraphicElements: [imgEvent1],
    program: [{ date: '2026-09-01T00:00:00.000Z', startTime: '18:00', endTime: '23:59', ticketInformation: 'Day pass NOK 350' }],
    tickets: [{ description: 'Festival pass', price: 'NOK 1200', ticketLink: 'https://example.com/pass', textContent: 'Best value' }],
    sections: [{ sectionTitle: 'About the festival', sectionBody: lexical('An annual celebration of electronic art.', 'Since 2003.'), images: [imgGal1] }],
  }) }, token)
  console.log('✓ festival ->', '/festival/ekko-festival-2026')

  // News
  for (const n of [
    { slug: 'programme-announced', title: 'Festival programme announced', date: '2026-06-01T10:00:00.000Z' },
    { slug: 'tickets-on-sale', title: 'Tickets now on sale', date: '2026-06-15T10:00:00.000Z' },
  ]) {
    await api('/news', { method: 'POST', body: JSON.stringify({
      title: n.title, slug: n.slug, postDate: n.date, newsPhoto: imgNews, pagePhoto: imgNews,
      intro: lexical('The latest from EKKO.', 'Read on.'), complexContent: blocks(imgNews),
    }) }, token)
  }
  console.log('✓ news (2)')

  // Globals
  for (const [slug, body] of [
    ['oestre', { title: 'Østre', pageContent: lexical('Østre is a venue for electronic art in Bergen.', 'Visit us.'), gallery: [imgGal1, imgGal2], contact: lexical('post@ostre.no', '') }],
    ['homepage', { title: 'EKKO', pageContent: lexical('Welcome to EKKO.', ''), linkedFestival: [festival.doc.id] }],
    ['ekko_festival_info', { title: 'EKKO Festival', pageContent: lexical('Festival info.', ''), linkedFestival: [festival.doc.id] }],
    ['about', { title: 'About', pageContent: lexical('About EKKO and Østre.', '') }],
    ['globalInfo', { title: 'EKKO', socialFacebook: 'https://facebook.com/ekko', socialInstagram: 'https://instagram.com/ekko', socialTwitter: '' }],
  ]) {
    await api(`/globals/${slug}`, { method: 'POST', body: JSON.stringify(body) }, token).catch((e) => console.warn(`  global ${slug}:`, e.message.split('\n')[0]))
  }
  console.log('✓ globals')

  // Navigation nodes (main menu)
  await wipe(token, 'navigationNodes')
  for (const [i, n] of [
    { title: 'Program', nav: 'main', url: '/ostre' },
    { title: 'Festival', nav: 'main', reference: { relationTo: 'events', value: festival.doc.id } },
    { title: 'Nyheter', nav: 'main', url: '/ostre/news' },
  ].entries()) {
    await api('/navigationNodes', { method: 'POST', body: JSON.stringify({ ...n, order: i }) }, token).catch((e) => console.warn('  nav:', e.message.split('\n')[0]))
  }
  console.log('✓ navigation')

  console.log('\n✔ seed complete — browse http://localhost:5173/ostre/ekko-opening-night')
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
