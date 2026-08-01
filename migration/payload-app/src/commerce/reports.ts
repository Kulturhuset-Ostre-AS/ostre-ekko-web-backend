import type { Endpoint, PayloadRequest } from 'payload'
import { headersWithCors } from 'payload'

// Sales reports (admin users only). One aggregation endpoint drives both the
// per-event view and the time-range view (presets are just from/to values the
// admin UI computes: this month, year-to-date, calendar year).
//
//   GET /api/commerce/reports/sales?from=ISO&to=ISO[&event=<id>][&format=csv]
//
// Aggregates PAID orders: ticket lines per event/type + membership sales.
// Volumes are small (thousands), so plain JS aggregation over payload.find.

const json = (req: PayloadRequest, status: number, body: unknown) =>
  Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

type EventAgg = {
  eventId: number | null
  eventTitle: string
  perType: Record<string, { quantity: number; revenueOre: number }>
  tickets: number
  revenueOre: number
}

const salesReport: Endpoint = {
  path: '/commerce/reports/sales',
  method: 'get',
  handler: async (req) => {
    if (!req.user || req.user.collection !== 'users') return json(req, 403, { error: 'krever admin-innlogging' })
    const url = new URL(req.url || '', 'http://x')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const eventFilter = url.searchParams.get('event')
    const format = url.searchParams.get('format')

    const where: any[] = [{ status: { equals: 'paid' } }]
    if (from) where.push({ createdAt: { greater_than_equal: from } })
    if (to) where.push({ createdAt: { less_than_equal: to } })
    if (eventFilter) where.push({ event: { equals: Number(eventFilter) } })

    const { docs } = await req.payload.find({
      collection: 'orders',
      where: { and: where },
      depth: 1,
      limit: 10000,
      sort: 'createdAt',
    })

    const events = new Map<string, EventAgg>()
    const membership = { count: 0, revenueOre: 0, perType: {} as Record<string, { quantity: number; revenueOre: number }> }
    let totalOre = 0

    for (const o of docs as any[]) {
      totalOre += o.amountOre || 0
      if (o.type === 'membership') {
        membership.count++
        membership.revenueOre += o.amountOre || 0
        const t: string = o.membershipType || 'ukjent'
        const slot = (membership.perType[t] ??= { quantity: 0, revenueOre: 0 })
        slot.quantity++
        slot.revenueOre += o.amountOre || 0
        continue
      }
      const ev = typeof o.event === 'object' && o.event ? o.event : null
      const key = String(ev?.id ?? 'ukjent')
      const agg: EventAgg = events.get(key) || {
        eventId: ev?.id ?? null,
        eventTitle: ev?.title || '(ukjent arrangement)',
        perType: {},
        tickets: 0,
        revenueOre: 0,
      }
      for (const line of o.items || []) {
        const name: string = line.name || 'billett'
        const slot = (agg.perType[name] ??= { quantity: 0, revenueOre: 0 })
        slot.quantity += line.quantity || 0
        slot.revenueOre += (line.unitPriceOre || 0) * (line.quantity || 0)
        agg.tickets += line.quantity || 0
      }
      agg.revenueOre += o.amountOre || 0
      events.set(key, agg)
    }

    const result = {
      from: from || null,
      to: to || null,
      orders: docs.length,
      totalOre,
      events: [...events.values()].sort((a, b) => b.revenueOre - a.revenueOre),
      membership,
    }

    if (format === 'csv') {
      const kr = (o: number) => (o / 100).toFixed(2).replace('.', ',')
      const rows: string[] = ['type;arrangement;billettype;antall;omsetning_kr']
      for (const e of result.events)
        for (const [name, t] of Object.entries(e.perType))
          rows.push(`billett;"${e.eventTitle.replace(/"/g, '""')}";"${name.replace(/"/g, '""')}";${t.quantity};${kr(t.revenueOre)}`)
      for (const [name, t] of Object.entries(membership.perType))
        rows.push(`medlemskap;;"${name}";${t.quantity};${kr(t.revenueOre)}`)
      rows.push(`totalt;;;${result.events.reduce((s, e) => s + e.tickets, 0) + membership.count};${kr(totalOre)}`)
      return new Response(`﻿${rows.join('\n')}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="salgsrapport-${(from || 'start').slice(0, 10)}-${(to || 'nå').slice(0, 10)}.csv"`,
        },
      })
    }
    return json(req, 200, result)
  },
}

export const reportEndpoints: Endpoint[] = [salesReport]
