import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'
import { getProvider } from './provider'
import { remainingFor } from './fulfil'
import { verifyQrPayload } from './qr'
import { sendTickets } from './email'

// Ticket shop endpoints (mounted under /api):
//   GET  /commerce/tickets/availability?event=<id|slug>  – public: types + remaining
//   POST /commerce/tickets/checkout                      – customer auth: create order + payment session
//   GET  /commerce/my/tickets                            – customer auth: own tickets w/ QR payloads
//   POST /commerce/my/tickets/email                      – customer auth: (re)send tickets by email
//   GET/POST /commerce/scan/:payload                     – admin auth: door scanning (GET check, POST mark used)
//   GET  /commerce/tickets/:code/pass                    – 501: Apple Wallet pass (needs Pass Type ID cert)

const json = (req: PayloadRequest, status: number, body: unknown) =>
  Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

const isCustomer = (req: PayloadRequest) => Boolean(req.user && req.user.collection === 'customers')
const isAdmin = (req: PayloadRequest) => Boolean(req.user && req.user.collection === 'users')

async function findEvent(req: PayloadRequest, ref: string) {
  const byId = Number(ref)
  if (Number.isFinite(byId) && String(byId) === ref) {
    return req.payload.findByID({ collection: 'events', id: byId, depth: 0 }).catch(() => null)
  }
  const r = await req.payload.find({ collection: 'events', where: { slug: { equals: ref } }, limit: 1, depth: 0 })
  return r.docs[0] || null
}

const availability: Endpoint = {
  path: '/commerce/tickets/availability',
  method: 'get',
  handler: async (req) => {
    const ref = new URL(req.url || '', 'http://x').searchParams.get('event')
    if (!ref) return json(req, 400, { error: 'event param required' })
    const event = await findEvent(req, ref)
    if (!event) return json(req, 404, { error: 'event not found' })
    const types = []
    for (const row of event.ticketTypes || []) {
      if (!row.onSale) continue
      const left = await remainingFor(req.payload, event.id, row)
      types.push({
        typeId: row.id,
        name: row.name,
        priceKr: row.priceKr,
        remaining: left === Infinity ? null : Math.max(0, left),
        soldOut: left !== Infinity && left <= 0,
      })
    }
    return json(req, 200, { event: { id: event.id, slug: event.slug, title: event.title, entryType: event.entryType }, types })
  },
}

const checkout: Endpoint = {
  path: '/commerce/tickets/checkout',
  method: 'post',
  handler: async (req) => {
    if (!isCustomer(req)) return json(req, 401, { error: 'Logg inn for å kjøpe billetter' })
    await addDataAndFileToRequest(req)
    const d = (req.data || {}) as { eventId?: number | string; items?: { typeId: string; quantity: number }[] }
    const items = Array.isArray(d.items) ? d.items.filter((i) => i && i.typeId && Number(i.quantity) > 0) : []
    if (!d.eventId || items.length === 0) return json(req, 400, { error: 'eventId og items kreves' })

    const event = await req.payload.findByID({ collection: 'events', id: d.eventId, depth: 0 }).catch(() => null)
    if (!event) return json(req, 404, { error: 'event not found' })

    // Server-side price + stock validation per row.
    const lines = []
    for (const item of items) {
      const row = (event.ticketTypes || []).find((r: any) => r.id === item.typeId)
      if (!row || !row.onSale) return json(req, 400, { error: 'Ugyldig billettype' })
      const qty = Math.min(Number(item.quantity), 10) // per-order sanity cap
      const left = await remainingFor(req.payload, event.id, row)
      if (left < qty) return json(req, 409, { error: `Utsolgt / for få igjen: ${row.name}` })
      lines.push({ typeId: row.id as string, name: row.name as string, unitPriceOre: Math.round(row.priceKr * 100), quantity: qty })
    }
    const amountOre = lines.reduce((s, l) => s + l.unitPriceOre * l.quantity, 0)

    const user = req.user as unknown as { id: number; email: string; name?: string }
    const provider = getProvider()
    const order = await req.payload.create({
      collection: 'orders',
      data: {
        type: 'ticket',
        status: 'pending',
        amountOre,
        currency: 'NOK',
        provider: provider.name,
        buyerName: user.name || user.email,
        buyerEmail: user.email,
        customer: user.id,
        event: event.id,
        items: lines,
      },
    })
    const session = await provider.createSession({
      orderId: order.id,
      amountOre,
      description: `Billetter – ${event.title}`,
      serverURL: req.payload.config.serverURL,
    })
    await req.payload.update({ collection: 'orders', id: order.id, data: { providerRef: session.providerRef } })
    return json(req, 200, { orderId: order.id, url: session.redirectUrl })
  },
}

const myTickets: Endpoint = {
  path: '/commerce/my/tickets',
  method: 'get',
  handler: async (req) => {
    if (!isCustomer(req)) return json(req, 401, { error: 'ikke innlogget' })
    const r = await req.payload.find({
      collection: 'tickets',
      where: { customer: { equals: req.user!.id } },
      depth: 1,
      limit: 200,
      sort: '-createdAt',
    })
    return json(req, 200, {
      tickets: r.docs.map((t: any) => ({
        id: t.id,
        code: t.ticketCode,
        qrPayload: t.qrPayload,
        status: t.status,
        typeName: t.typeName,
        event: t.event && typeof t.event === 'object'
          ? { title: t.event.title, slug: t.event.slug, date: t.event.date, entryType: t.event.entryType }
          : null,
      })),
    })
  },
}

const emailMyTickets: Endpoint = {
  path: '/commerce/my/tickets/email',
  method: 'post',
  handler: async (req) => {
    if (!isCustomer(req)) return json(req, 401, { error: 'ikke innlogget' })
    const r = await req.payload.find({
      collection: 'tickets',
      where: { and: [{ customer: { equals: req.user!.id } }, { status: { equals: 'valid' } }] },
      depth: 1,
      limit: 200,
    })
    if (!r.docs.length) return json(req, 404, { error: 'ingen gyldige billetter' })
    const byEvent = new Map<string, { title: string; tickets: { code: string; typeName: string }[] }>()
    for (const t of r.docs as any[]) {
      const title = typeof t.event === 'object' ? t.event.title : 'arrangement'
      const g: { title: string; tickets: { code: string; typeName: string }[] } =
        byEvent.get(title) || { title, tickets: [] }
      g.tickets.push({ code: t.ticketCode, typeName: t.typeName })
      byEvent.set(title, g)
    }
    const user = req.user as unknown as { email: string; name?: string }
    for (const g of byEvent.values()) {
      await sendTickets(req.payload, { to: user.email, name: user.name || '', eventTitle: g.title, tickets: g.tickets })
    }
    return json(req, 200, { sent: true })
  },
}

// Door scanning MVP: staff (admin users) validate a scanned QR payload.
// GET = check without consuming; POST = mark used (idempotent + informative).
const scanHandler = (consume: boolean): Endpoint['handler'] => async (req) => {
  if (!isAdmin(req)) return json(req, 403, { error: 'krever admin-innlogging' })
  const payloadStr = decodeURIComponent(String(req.routeParams?.payload || ''))
  const code = verifyQrPayload(payloadStr)
  if (!code) return json(req, 400, { valid: false, error: 'ugyldig/forfalsket QR' })
  const r = await req.payload.find({ collection: 'tickets', where: { ticketCode: { equals: code } }, depth: 1, limit: 1 })
  const t = r.docs[0] as any
  if (!t) return json(req, 404, { valid: false, error: 'ukjent billett' })
  const info = {
    code: t.ticketCode,
    typeName: t.typeName,
    status: t.status,
    usedAt: t.usedAt || null,
    event: typeof t.event === 'object' ? { title: t.event.title, date: t.event.date } : null,
  }
  if (t.status === 'used') return json(req, 200, { valid: false, alreadyUsed: true, ...info })
  if (t.status !== 'valid') return json(req, 200, { valid: false, ...info })
  if (consume) {
    await req.payload.update({ collection: 'tickets', id: t.id, data: { status: 'used', usedAt: new Date().toISOString() } })
    return json(req, 200, { valid: true, consumed: true, ...info, status: 'used' })
  }
  return json(req, 200, { valid: true, consumed: false, ...info })
}

const scanCheck: Endpoint = { path: '/commerce/scan/:payload', method: 'get', handler: scanHandler(false) }
const scanConsume: Endpoint = { path: '/commerce/scan/:payload', method: 'post', handler: scanHandler(true) }

// Apple Wallet: prepared, not implemented — .pkpass generation requires an Apple
// Developer Pass Type ID certificate. The QR payload above is what the pass
// barcode will carry, so tickets need no re-issuing when this lands.
const walletPass: Endpoint = {
  path: '/commerce/tickets/:code/pass',
  method: 'get',
  handler: async (req) =>
    json(req, 501, { error: 'Apple Wallet-pass er forberedt, men krever Apple Developer-sertifikat (Pass Type ID) før det kan aktiveres' }),
}

export const ticketEndpoints: Endpoint[] = [availability, checkout, myTickets, emailMyTickets, scanCheck, scanConsume, walletPass]
