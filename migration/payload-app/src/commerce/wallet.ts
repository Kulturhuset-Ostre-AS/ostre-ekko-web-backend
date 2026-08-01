import type { Endpoint, PayloadRequest } from 'payload'
import { headersWithCors } from 'payload'
import { qrPayloadFor } from './qr'

// Wallet passes for tickets (Apple Wallet .pkpass + Google Wallet save-link).
// Both are ENV-GATED: the code paths are complete but activate only when the
// external credentials exist —
//   Apple:  APPLE_PASS_CERT_B64 (signerCert pem), APPLE_PASS_KEY_B64 (signer
//           key pem), APPLE_WWDR_B64 (Apple WWDR CA), APPLE_PASS_TYPE_ID
//           (pass.no.ekko.tickets), APPLE_TEAM_ID
//           -> requires an Apple Developer Program account + Pass Type ID.
//   Google: GOOGLE_WALLET_ISSUER_ID + GOOGLE_WALLET_SA_KEY_B64 (service
//           account JSON) -> requires a Google Wallet API issuer account.
// Until then the endpoints answer 501 and the frontend hides the buttons
// (GET /commerce/wallet/status). The QR payload in the pass is the SAME signed
// payload the door scanner consumes, so no re-issuing when this activates.
// NOTE: written against the passkit-generator / Google Wallet JWT contracts
// but NOT runnable until real credentials exist — verify on first activation.

const json = (req: PayloadRequest, status: number, body: unknown) =>
  Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

const appleReady = () =>
  Boolean(process.env.APPLE_PASS_CERT_B64 && process.env.APPLE_PASS_KEY_B64 && process.env.APPLE_WWDR_B64 && process.env.APPLE_PASS_TYPE_ID && process.env.APPLE_TEAM_ID)
const googleReady = () => Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SA_KEY_B64)

const walletStatus: Endpoint = {
  path: '/commerce/wallet/status',
  method: 'get',
  handler: async (req) => json(req, 200, { apple: appleReady(), google: googleReady() }),
}

async function ownedTicket(req: PayloadRequest, code: string) {
  if (!req.user || req.user.collection !== 'customers') return null
  const r = await req.payload.find({
    collection: 'tickets',
    where: { and: [{ ticketCode: { equals: code } }, { customer: { equals: req.user.id } }] },
    depth: 1,
    limit: 1,
  })
  return (r.docs[0] as any) || null
}

const applePass: Endpoint = {
  path: '/commerce/tickets/:code/pass',
  method: 'get',
  handler: async (req) => {
    if (!appleReady()) return json(req, 501, { error: 'Apple Wallet krever Pass Type ID-sertifikat (Apple Developer) — se docs/medlemskapssalg-plan.md' })
    const t = await ownedTicket(req, String(req.routeParams?.code))
    if (!t) return json(req, 404, { error: 'ukjent billett (krever innlogging som eier)' })
    const { PKPass } = await import('passkit-generator')
    const b64 = (v: string) => Buffer.from(v, 'base64')
    const ev = typeof t.event === 'object' ? t.event : {}
    const pass = new PKPass({}, {
      signerCert: b64(process.env.APPLE_PASS_CERT_B64!),
      signerKey: b64(process.env.APPLE_PASS_KEY_B64!),
      wwdr: b64(process.env.APPLE_WWDR_B64!),
    }, {
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
      teamIdentifier: process.env.APPLE_TEAM_ID!,
      serialNumber: t.ticketCode,
      organizationName: 'Ekko / Østre',
      description: `Billett – ${ev.title || ''}`,
      eventTicket: {
        primaryFields: [{ key: 'event', label: 'Arrangement', value: ev.title || '' }],
        secondaryFields: [
          { key: 'type', label: 'Type', value: t.typeName || '' },
          ...(ev.date ? [{ key: 'date', label: 'Dato', value: new Date(ev.date).toLocaleDateString('nb-NO') }] : []),
        ],
      },
    } as any)
    pass.setBarcodes({ format: 'PKBarcodeFormatQR', message: qrPayloadFor(t.ticketCode), messageEncoding: 'iso-8859-1' })
    const buf = pass.getAsBuffer()
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${t.ticketCode}.pkpass"`,
        ...Object.fromEntries(headersWithCors({ headers: new Headers(), req }).entries()),
      },
    })
  },
}

const googlePass: Endpoint = {
  path: '/commerce/tickets/:code/gpay',
  method: 'get',
  handler: async (req) => {
    if (!googleReady()) return json(req, 501, { error: 'Google Wallet krever issuer-konto — se docs/medlemskapssalg-plan.md' })
    const t = await ownedTicket(req, String(req.routeParams?.code))
    if (!t) return json(req, 404, { error: 'ukjent billett (krever innlogging som eier)' })
    const sa = JSON.parse(Buffer.from(process.env.GOOGLE_WALLET_SA_KEY_B64!, 'base64').toString('utf8'))
    const issuer = process.env.GOOGLE_WALLET_ISSUER_ID!
    const ev = typeof t.event === 'object' ? t.event : {}
    const objectId = `${issuer}.${t.ticketCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    const claims = {
      iss: sa.client_email,
      aud: 'google',
      typ: 'savetowallet',
      payload: {
        eventTicketObjects: [{
          id: objectId,
          classId: `${issuer}.ekko_tickets`,
          state: 'ACTIVE',
          ticketHolderName: String((req.user as any).name || (req.user as any).email),
          ticketType: { defaultValue: { language: 'nb', value: t.typeName || 'Billett' } },
          barcode: { type: 'QR_CODE', value: qrPayloadFor(t.ticketCode) },
          eventName: { defaultValue: { language: 'nb', value: ev.title || 'Arrangement' } },
        }],
      },
    }
    const { default: jwtLib } = await import('jsonwebtoken')
    const token = jwtLib.sign(claims, sa.private_key, { algorithm: 'RS256' })
    return json(req, 200, { saveUrl: `https://pay.google.com/gp/v/save/${token}` })
  },
}

export const walletEndpoints: Endpoint[] = [walletStatus, applePass, googlePass]
