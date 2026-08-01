import type { Endpoint, PayloadRequest } from 'payload'
import { qrPayloadFor } from './qr'

// Fysiske medlemskort i kredittkortstørrelse (CR80: 85,6 × 54 mm) — HTML som
// skrives ut fra nettleseren i admin (kortprinter eller papir):
//   GET /api/commerce/members/:id/card          – ett kort
//   GET /api/commerce/members/cards?scope=…     – batch: pending (uhentede
//       aktive, default) | active (alle aktive)
// Kun admin-brukere. QR-en er signert `MEM:<memberId>` (samme HMAC som
// billettene) — dør-skanneren viser medlemsstatus uten å konsumere noe.

type CardMember = {
  id: number
  memberId?: string
  name?: string
  membershipType?: string
  validUntil?: string
}

async function qrDataUri(payload: string): Promise<string> {
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(payload, { width: 260, margin: 0 })
}

async function cardHtml(members: CardMember[]): Promise<string> {
  const cards = await Promise.all(members.map(async (m) => {
    const qr = await qrDataUri(qrPayloadFor(`MEM:${m.memberId}`))
    const type = m.membershipType === 'student' ? 'STUDENT' : 'MEDLEM'
    const until = m.validUntil ? new Date(m.validUntil).toLocaleDateString('nb-NO') : ''
    return `
    <div class="card">
      <div class="left">
        <div class="brand">EKKO / ØSTRE</div>
        <div class="type">${type}</div>
        <div class="name">${escapeHtml(m.name || '')}</div>
        <div class="meta">${escapeHtml(m.memberId || '')}<br>Gyldig til ${until}</div>
      </div>
      <img class="qr" src="${qr}" alt="QR">
    </div>`
  }))
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8">
<title>Medlemskort</title>
<style>
  @page { size: 85.6mm 54mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; }
  .card {
    width: 85.6mm; height: 54mm;
    background: #000; color: rgb(230,230,230);
    display: flex; justify-content: space-between; align-items: center;
    padding: 5mm; page-break-after: always; overflow: hidden;
  }
  .brand { font-size: 3.4mm; letter-spacing: 0.6mm; }
  .type { font-size: 6mm; font-weight: 700; margin-top: 2mm; }
  .name { font-size: 4.2mm; margin-top: 3mm; max-width: 48mm; }
  .meta { font-size: 2.8mm; margin-top: 2mm; opacity: 0.8; line-height: 1.5; }
  .qr { width: 22mm; height: 22mm; background: #fff; padding: 1.2mm; }
  .toolbar { position: fixed; top: 8px; right: 8px; }
  @media print { .toolbar { display: none; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Skriv ut (${members.length})</button></div>
${cards.join('\n')}
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

const requireAdmin = (req: PayloadRequest) => Boolean(req.user && req.user.collection === 'users')

const singleCard: Endpoint = {
  path: '/commerce/members/:id/card',
  method: 'get',
  handler: async (req) => {
    if (!requireAdmin(req)) return new Response('krever admin-innlogging', { status: 403 })
    const m = await req.payload.findByID({ collection: 'members', id: String(req.routeParams?.id), depth: 0 }).catch(() => null)
    if (!m) return new Response('ukjent medlem', { status: 404 })
    return new Response(await cardHtml([m as CardMember]), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  },
}

const batchCards: Endpoint = {
  path: '/commerce/members/cards',
  method: 'get',
  handler: async (req) => {
    if (!requireAdmin(req)) return new Response('krever admin-innlogging', { status: 403 })
    const scope = new URL(req.url || '', 'http://x').searchParams.get('scope') || 'pending'
    const where: any[] = [{ validUntil: { greater_than_equal: new Date().toISOString() } }]
    if (scope === 'pending') where.push({ cardPickedUp: { not_equals: true } })
    const { docs } = await req.payload.find({ collection: 'members', where: { and: where }, limit: 500, depth: 0, sort: 'memberId' })
    if (!docs.length) return new Response('Ingen medlemmer i utvalget.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    return new Response(await cardHtml(docs as CardMember[]), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  },
}

export const cardEndpoints: Endpoint[] = [singleCard, batchCards]
