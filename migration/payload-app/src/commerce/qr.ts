import { createHmac, randomBytes } from 'crypto'

// Ticket QR payloads: "<code>.<sig>" where sig = HMAC-SHA256(code, PAYLOAD_SECRET)
// truncated to 16 base64url chars. The code alone is unguessable (80 bits random);
// the signature additionally makes payloads self-verifiable offline-ish at the
// door and forgery-proof even if a code list leaks. The same payload is what a
// future .pkpass (Apple Wallet) barcode will carry — see docs/medlemskapssalg-plan.md.

const secret = () => process.env.PAYLOAD_SECRET || 'dev-secret-change-me'

export function newTicketCode(): string {
  return `TKT-${randomBytes(10).toString('base64url')}`
}

export function signTicketCode(code: string): string {
  return createHmac('sha256', secret()).update(code).digest('base64url').slice(0, 16)
}

export function qrPayloadFor(code: string): string {
  return `${code}.${signTicketCode(code)}`
}

/** Returns the ticket code if the payload verifies, else null. */
export function verifyQrPayload(payload: string): string | null {
  const i = payload.lastIndexOf('.')
  if (i < 1) return null
  const code = payload.slice(0, i)
  return payload.slice(i + 1) === signTicketCode(code) ? code : null
}

/** QR-innholdet er en URL (iPhone-kameraet gjør ingenting med ren tekst):
 * åpner billettstatus-siden /t/<payload> for publikum, mens dørskanneren
 * plukker payloaden ut av URL-en (normalizeQrScan). */
export function qrUrlFor(code: string): string {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
  return `${frontend}/t/${qrPayloadFor(code)}`
}

/** Godtar både rå payload (gamle QR-er) og URL-formen /t/<payload>. */
export function normalizeQrScan(text: string): string {
  const t = decodeURIComponent(String(text || '').trim())
  const m = /\/t\/([^/?#]+)/.exec(t)
  return m ? m[1] : t
}
