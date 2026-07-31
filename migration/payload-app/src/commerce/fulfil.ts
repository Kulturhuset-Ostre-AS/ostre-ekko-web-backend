import type { Payload } from 'payload'
import { seasonFromKey } from './seasons'
import { sendReceipt, sendTickets } from './email'
import { newTicketCode } from './qr'

// Fulfilment: what happens when a payment completes. Shared by the mock
// provider today and the real Vipps webhook later — both call completePayment,
// which is idempotent on order status (double webhook delivery is a no-op).

/** Next sequential member ID for the year, e.g. EKKO-2026-0042. */
export async function nextMemberId(payload: Payload, year: number): Promise<string> {
  const prefix = `EKKO-${year}-`
  const { totalDocs } = await payload.count({
    collection: 'members',
    where: { memberId: { like: prefix } },
  })
  return `${prefix}${String(totalDocs + 1).padStart(4, '0')}`
}

export async function completePayment(
  payload: Payload,
  orderId: number | string,
  event: Record<string, unknown>,
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0 })
  if (!order) return { ok: false, error: 'order not found' }
  if (order.status === 'paid') return { ok: true, already: true } // idempotent
  if (order.status !== 'pending') return { ok: false, error: `order is ${order.status}` }

  if (order.type === 'ticket') return fulfilTickets(payload, order, event)

  const season = seasonFromKey(order.season || '')
  if (!season) return { ok: false, error: `bad season on order: ${order.season}` }

  // Upsert member on email (unique index = the renewal key). A renewal updates
  // type/contact info and moves validUntil to the purchased season's end.
  const email = String(order.buyerEmail).toLowerCase().trim()
  const existing = await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, depth: 0 })

  const memberData = {
    name: order.buyerName,
    email,
    address: order.buyerAddress,
    postalCode: order.buyerPostalCode,
    city: order.buyerCity,
    birthYear: order.buyerBirthYear,
    membershipType: (order.membershipType ?? 'ordinary') as 'ordinary' | 'student',
    validUntil: season.validUntil.toISOString(),
    source: 'web' as const,
    consentNewsletter: Boolean(order.consentNewsletter),
  }

  const member = existing.docs[0]
    ? ((await payload.update({ collection: 'members', id: existing.docs[0].id, data: memberData })) as { id: number; memberId?: string })
    : await payload.create({
        collection: 'members',
        data: { ...memberData, memberId: await nextMemberId(payload, new Date().getFullYear()) },
      })

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      status: 'paid',
      member: member.id,
      rawEvents: [...(Array.isArray(order.rawEvents) ? order.rawEvents : []), { at: new Date().toISOString(), ...event }],
    },
  })

  await sendReceipt(payload, {
    to: email,
    name: String(order.buyerName),
    memberId: String(member.memberId),
    membershipType: String(order.membershipType),
    seasonLabel: season.label,
    validUntil: season.validUntil,
    amountOre: Number(order.amountOre),
  })

  return { ok: true }
}

/** Remaining stock for a ticket-type row on an event: max quantity minus issued
 * (non-refunded) tickets. Used by checkout AND re-checked here at fulfilment. */
export async function remainingFor(
  payload: Payload,
  eventId: number | string,
  typeRow: { id?: string | null; quantity?: number | null },
): Promise<number> {
  if (typeof typeRow.quantity !== 'number') return Infinity
  const { totalDocs } = await payload.count({
    collection: 'tickets',
    where: {
      and: [
        { event: { equals: eventId } },
        { typeId: { equals: typeRow.id } },
        { status: { not_equals: 'refunded' } },
      ],
    },
  })
  return typeRow.quantity - totalDocs
}

async function fulfilTickets(
  payload: Payload,
  order: Record<string, any>,
  event: Record<string, unknown>,
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  const eventId = typeof order.event === 'object' ? order.event?.id : order.event
  const eventDoc = await payload.findByID({ collection: 'events', id: eventId, depth: 0 }).catch(() => null)
  if (!eventDoc) return { ok: false, error: 'event not found' }

  // Final stock check (checkout also checks, but payment takes time).
  for (const item of order.items || []) {
    const row = (eventDoc.ticketTypes || []).find((r: any) => r.id === item.typeId)
    if (!row) return { ok: false, error: `unknown ticket type ${item.typeId}` }
    const left = await remainingFor(payload, eventId, row)
    if (left < item.quantity) return { ok: false, error: `utsolgt: ${row.name}` }
  }

  const issued: { code: string; typeName: string }[] = []
  for (const item of order.items || []) {
    for (let i = 0; i < item.quantity; i++) {
      const code = newTicketCode()
      await payload.create({
        collection: 'tickets',
        data: {
          ticketCode: code,
          event: eventId,
          typeId: item.typeId,
          typeName: item.name,
          priceOre: item.unitPriceOre,
          status: 'valid',
          order: order.id,
          customer: typeof order.customer === 'object' ? order.customer?.id : order.customer,
        },
      })
      issued.push({ code, typeName: item.name })
    }
  }

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      status: 'paid',
      rawEvents: [...(Array.isArray(order.rawEvents) ? order.rawEvents : []), { at: new Date().toISOString(), ...event }],
    },
  })

  await sendTickets(payload, {
    to: String(order.buyerEmail),
    name: String(order.buyerName || ''),
    eventTitle: String(eventDoc.title),
    tickets: issued,
  })

  return { ok: true }
}
