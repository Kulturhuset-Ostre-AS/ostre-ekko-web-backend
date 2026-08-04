import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'
import { createHash, randomInt, timingSafeEqual } from 'crypto'

// Glemt passord med ENGANGSKODE (moderne flyt, jf. redaktørønske 2026-08-04):
//   POST /commerce/auth/otp/request { email }                  -> alltid 200 (lekker ikke om kontoen finnes)
//   POST /commerce/auth/otp/verify  { email, code, password }  -> verifiserer koden og setter nytt passord
// Under panseret gjenbrukes Payloads reset-token (forgotPassword m/
// disableEmail); koden er 6 sifre, hashet med PAYLOAD_SECRET, gyldig 10 min,
// maks 5 forsøk. Frontenden logger inn med det nye passordet etterpå, så vi
// slipper å prege sesjons-cookies selv. Lenke-flyten (/konto/nytt-passord)
// finnes fortsatt som reserve.

const json = (req: PayloadRequest, status: number, body: unknown) =>
  Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

const hashCode = (code: string) =>
  createHash('sha256').update(`otp:${code}:${process.env.PAYLOAD_SECRET || 'dev-secret-change-me'}`).digest('hex')

async function findCustomer(req: PayloadRequest, email: string) {
  const r = await req.payload.find({
    collection: 'customers',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })
  return (r.docs[0] as any) || null
}

const otpRequest: Endpoint = {
  path: '/commerce/auth/otp/request',
  method: 'post',
  handler: async (req) => {
    await addDataAndFileToRequest(req)
    const email = String((req.data as any)?.email || '').toLowerCase().trim()
    if (!email) return json(req, 400, { error: 'email kreves' })

    const customer = await findCustomer(req, email)
    if (customer) {
      try {
        // Payloads eget reset-token — koden er bare en brukervennlig nøkkel til det.
        const token = await req.payload.forgotPassword({
          collection: 'customers',
          data: { email },
          disableEmail: true,
        })
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
        await req.payload.update({
          collection: 'customers',
          id: customer.id,
          overrideAccess: true,
          data: {
            otpCodeHash: hashCode(code),
            otpResetToken: token,
            otpExpiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
            otpAttempts: 0,
          },
        })
        await req.payload.sendEmail({
          to: email,
          subject: `${code} er engangskoden din – Østre / EKKO`,
          html: `
            <div style="background: #ffffff; padding: 24px; font-family: Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111111;">
              <p style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 10px;">Østre&nbsp;/&nbsp;EKKO</p>
              <h1 style="font-size: 22px; margin: 18px 0 8px;">Engangskoden din</h1>
              <p style="font-size: 15px;">Skriv inn koden på nettsiden for å velge nytt passord.
              Den er gyldig i 10 minutter.</p>
              <p style="font-size: 34px; letter-spacing: 0.35em; font-weight: bold; margin: 20px 0; font-family: monospace;">${code}</p>
              <p style="font-size: 13px; color: #777;">Ba du ikke om koden, kan du se bort fra e-posten — passordet er uendret.</p>
            </div>`,
        })
      } catch (err) {
        req.payload.logger.error({ err, email }, 'otp request failed')
      }
    }
    // Alltid samme svar — avslører ikke om kontoen finnes.
    return json(req, 200, { sent: true })
  },
}

const otpVerify: Endpoint = {
  path: '/commerce/auth/otp/verify',
  method: 'post',
  handler: async (req) => {
    await addDataAndFileToRequest(req)
    const d = (req.data || {}) as { email?: string; code?: string; password?: string }
    const email = String(d.email || '').toLowerCase().trim()
    const code = String(d.code || '').replace(/\s+/g, '')
    const password = String(d.password || '')
    if (!email || !code || !password) return json(req, 400, { error: 'email, code og password kreves' })
    if (password.length < 8) return json(req, 400, { error: 'Passordet må ha minst 8 tegn' })

    const generic = { error: 'Feil eller utløpt kode — be om en ny.' }
    const customer = await findCustomer(req, email)
    if (!customer?.otpCodeHash || !customer?.otpResetToken) return json(req, 400, generic)
    if (!customer.otpExpiresAt || new Date(customer.otpExpiresAt).getTime() < Date.now()) return json(req, 400, generic)
    if ((customer.otpAttempts ?? 0) >= MAX_ATTEMPTS) return json(req, 429, { error: 'For mange forsøk — be om en ny kode.' })

    const expected = Buffer.from(String(customer.otpCodeHash), 'hex')
    const got = Buffer.from(hashCode(code), 'hex')
    const ok = expected.length === got.length && timingSafeEqual(expected, got)
    if (!ok) {
      await req.payload.update({
        collection: 'customers',
        id: customer.id,
        overrideAccess: true,
        data: { otpAttempts: (customer.otpAttempts ?? 0) + 1 },
      })
      return json(req, 400, generic)
    }

    try {
      await req.payload.resetPassword({
        collection: 'customers',
        data: { token: String(customer.otpResetToken), password },
        overrideAccess: true,
      })
    } catch (err) {
      req.payload.logger.error({ err, email }, 'otp reset failed')
      return json(req, 400, generic)
    }
    await req.payload.update({
      collection: 'customers',
      id: customer.id,
      overrideAccess: true,
      data: { otpCodeHash: null, otpResetToken: null, otpExpiresAt: null, otpAttempts: 0 },
    })
    return json(req, 200, { ok: true })
  },
}

export const otpEndpoints: Endpoint[] = [otpRequest, otpVerify]
