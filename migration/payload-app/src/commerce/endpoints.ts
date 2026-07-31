import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'
import { seasonOnSale } from './seasons'
import { getProvider } from './provider'
import { completePayment } from './fulfil'

// Commerce endpoints, mounted under /api by Payload:
//   POST /api/commerce/membership/checkout  – create pending order + payment session
//   GET  /api/commerce/mock-pay             – mock hosted payment page (until Vipps)
//   POST /api/commerce/mock-pay/complete    – mock provider "webhook" (approve/cancel)
//   GET  /api/commerce/orders/:id/status    – order status polling for the takk page
//   GET  /api/commerce/members/export.csv   – member register CSV (logged-in only)

const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

const json = (req: PayloadRequest, status: number, body: unknown) =>
  Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

const checkout: Endpoint = {
  path: '/commerce/membership/checkout',
  method: 'post',
  handler: async (req) => {
    await addDataAndFileToRequest(req)
    const d = (req.data || {}) as Record<string, unknown>

    const name = String(d.name || '').trim()
    const email = String(d.email || '').trim().toLowerCase()
    const membershipType = String(d.membershipType || '')
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return json(req, 400, { error: 'Navn og gyldig e-post er påkrevd' })
    if (!['ordinary', 'student'].includes(membershipType)) return json(req, 400, { error: 'Ugyldig medlemskapstype' })

    const config = await req.payload.findGlobal({ slug: 'membership-config' })
    if (!config?.salesOpen) return json(req, 403, { error: 'Medlemskapssalget er ikke åpent' })

    // Price is looked up server-side — never trusted from the client.
    const priceKr = membershipType === 'student' ? config.priceStudent : config.priceOrdinary
    if (typeof priceKr !== 'number' || priceKr <= 0) return json(req, 500, { error: 'Pris er ikke konfigurert' })

    const season = seasonOnSale(new Date())
    const provider = getProvider()

    const order = await req.payload.create({
      collection: 'orders',
      data: {
        type: 'membership',
        status: 'pending',
        amountOre: Math.round(priceKr * 100),
        currency: 'NOK',
        provider: provider.name,
        membershipType: membershipType as 'ordinary' | 'student',
        season: season.key,
        buyerName: name,
        buyerEmail: email,
        buyerAddress: String(d.address || ''),
        buyerPostalCode: String(d.postalCode || ''),
        buyerCity: String(d.city || ''),
        buyerBirthYear: Number(d.birthYear) || undefined,
        consentNewsletter: Boolean(d.consentNewsletter),
      },
    })

    const session = await provider.createSession({
      orderId: order.id,
      amountOre: Math.round(priceKr * 100),
      description: `Medlemskap ${season.label}`,
      serverURL: req.payload.config.serverURL,
    })
    await req.payload.update({ collection: 'orders', id: order.id, data: { providerRef: session.providerRef } })

    return json(req, 200, { orderId: order.id, url: session.redirectUrl })
  },
}

// Mock hosted payment page. Clearly labelled test-only; replaced by the real
// Vipps-hosted page once the merchant agreement exists.
const mockPay: Endpoint = {
  path: '/commerce/mock-pay',
  method: 'get',
  handler: async (req) => {
    const orderId = new URL(req.url || '', 'http://x').searchParams.get('order')
    const order = orderId ? await req.payload.findByID({ collection: 'orders', id: orderId, depth: 0 }).catch(() => null) : null
    if (!order) return new Response('Ukjent ordre', { status: 404 })
    const kr = (Number(order.amountOre) / 100).toFixed(0)
    return new Response(
      `<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Testbetaling</title>
      <body style="font-family: sans-serif; max-width: 420px; margin: 3rem auto; text-align: center;">
        <h1 style="background:#ffe08a; padding: .5rem;">TESTBETALING (mock)</h1>
        <p>Dette er en simulert betalingsside — ingen penger trekkes.<br>Erstattes av Vipps/kort når avtalen er på plass.</p>
        <p style="font-size:1.4rem"><strong>${kr} kr</strong> — medlemskap</p>
        <form method="post" action="${req.payload.config.serverURL}/api/commerce/mock-pay/complete">
          <input type="hidden" name="order" value="${order.id}">
          <button name="outcome" value="approve" style="font-size:1.1rem; padding:.7rem 2rem; margin:.3rem;">Betal (godkjenn)</button>
          <button name="outcome" value="cancel" style="font-size:1.1rem; padding:.7rem 2rem; margin:.3rem;">Avbryt</button>
        </form>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  },
}

const mockPayComplete: Endpoint = {
  path: '/commerce/mock-pay/complete',
  method: 'post',
  handler: async (req) => {
    if (process.env.PAYMENT_PROVIDER === 'vipps') return new Response('mock disabled', { status: 403 })
    const form = await (req as unknown as Request).formData()
    const orderId = String(form.get('order') || '')
    const outcome = String(form.get('outcome') || '')

    if (outcome === 'approve') {
      const result = await completePayment(req.payload, orderId, { source: 'mock-pay', outcome })
      if (!result.ok) return new Response(`Betaling feilet: ${result.error}`, { status: 400 })
    } else {
      const order = await req.payload.findByID({ collection: 'orders', id: orderId, depth: 0 }).catch(() => null)
      if (order && order.status === 'pending') {
        await req.payload.update({ collection: 'orders', id: orderId, data: { status: 'failed' } })
      }
    }
    const done = await req.payload.findByID({ collection: 'orders', id: orderId, depth: 0 }).catch(() => null)
    const takk = done?.type === 'ticket' ? 'billetter/takk' : 'medlemskap/takk'
    return Response.redirect(`${FRONTEND}/${takk}?ordre=${orderId}`, 302)
  },
}

const orderStatus: Endpoint = {
  path: '/commerce/orders/:id/status',
  method: 'get',
  handler: async (req) => {
    const order = await req.payload
      .findByID({ collection: 'orders', id: String(req.routeParams?.id), depth: 0 })
      .catch(() => null)
    if (!order) return json(req, 404, { error: 'not found' })
    // Status only — no personal data on an unauthenticated endpoint.
    return json(req, 200, { status: order.status })
  },
}

const membersCsv: Endpoint = {
  path: '/commerce/members/export.csv',
  method: 'get',
  handler: async (req) => {
    if (!req.user) return json(req, 403, { error: 'innlogging kreves' })
    const { docs } = await req.payload.find({ collection: 'members', limit: 10000, depth: 0, sort: 'memberId' })
    const cols = ['memberId', 'name', 'email', 'address', 'postalCode', 'city', 'birthYear', 'membershipType', 'validUntil', 'cardPickedUp', 'source', 'createdAt'] as const
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.join(';'), ...docs.map((m: any) => cols.map((c) => esc(m[c])).join(';'))].join('\n')
    return new Response(`﻿${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="medlemmer-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  },
}

export const commerceEndpoints: Endpoint[] = [checkout, mockPay, mockPayComplete, orderStatus, membersCsv]
