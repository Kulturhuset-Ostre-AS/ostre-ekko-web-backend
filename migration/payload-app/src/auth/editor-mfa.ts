/**
 * Innlogging for redaksjonen (users): passkey først, ellers passord + kode fra
 * autentiseringsapp (TOTP). Reservekoder når appen ikke er for hånden.
 *
 *   Passkey:  /mfa/passkey/login/options → nettleseren → /mfa/passkey/login/verify → økt
 *   Passord:  /mfa/password → /mfa/code (app- eller reservekode) → økt
 *   Første gang (verken passkey eller app): /mfa/password → kode på e-post →
 *             /mfa/email/verify → må sette opp passkey eller app → økt
 *
 * Mellomtrinnene holdes i en signert, httpOnly «ekko-mfa»-cookie (bruker-id, trinn,
 * utløp). Ingen økt finnes før andre faktor er bestått: økten pregs til slutt med
 * Payloads egne funksjoner (addSessionToUser + jwtSign + generatePayloadCookie).
 *
 * Vanlig passordinnlogging (REST /users/login, GraphQL loginUsers) blokkeres av
 * beforeLogin-kroken. /mfa/password sjekker passordet gjennom Payloads egen login
 * (med lås etter 5 feil), men kroken avbryter før token utstedes, så transaksjonen
 * (og økten) rulles tilbake. «Tilbakestill passord» får bytte passord, men økten
 * fjernes (afterOperation), så man må logge inn med andre faktor etterpå.
 *
 * Lokalt kan ADMIN_MFA=off slå av sperren (skript med SEED_EMAIL/SEED_PASSWORD).
 */
import type {
  CollectionAfterOperationHook,
  CollectionBeforeLoginHook,
  Endpoint,
  PayloadRequest,
} from 'payload'
import { APIError, addDataAndFileToRequest, getFieldsToSign, headersWithCors, jwtSign, resetLoginAttempts } from 'payload'
import { addSessionToUser, generatePayloadCookie, parseCookies } from 'payload/shared'
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import QRCode from 'qrcode'

// ---------------------------------------------------------------- oppsett
const ISSUER = 'Østre / EKKO'
const SECRET = () => process.env.PAYLOAD_SECRET || 'dev-secret-change-me'
const SERVER_URL = () => process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
export const mfaEnforced = () => process.env.ADMIN_MFA !== 'off'
// Passkeys knyttes til admin-domenet (admin.ekko.no). Kan overstyres, f.eks. til
// ekko.no hvis passkeys senere skal gjelde flere underdomener.
const RP_ID = () => process.env.WEBAUTHN_RP_ID || new URL(SERVER_URL()).hostname
const ORIGINS = () => [
  new URL(SERVER_URL()).origin,
  ...(process.env.WEBAUTHN_EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]

const STATE_COOKIE = 'ekko-mfa'
const CHALLENGE_COOKIE = 'ekko-webauthn'
const COOKIE_PATH = '/api/users/mfa'
const STATE_TTL_S = 10 * 60
const ENROLL_TTL_S = 20 * 60
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
const MAX_CODE_FAILURES = 5
const CODE_LOCK_MS = 15 * 60 * 1000
const BACKUP_CODE_COUNT = 10

type Stage = 'code' | 'email' | 'enroll'
type MfaState = { uid: string | number; st: Stage; exp: number }
type Challenge = { c: string; p: 'reg' | 'auth'; uid?: string | number; exp: number }
export type StoredPasskey = {
  id: string
  publicKey: string // base64url
  counter: number
  transports?: string[]
  name: string
  createdAt: string
  lastUsedAt?: string
  deviceType?: string
  backedUp?: boolean
}

// ---------------------------------------------------------------- krypto
const key = (purpose: string) => createHash('sha256').update(`editor-mfa:${purpose}:${SECRET()}`).digest()
const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
const hashCode = (kind: string, code: string) =>
  createHmac('sha256', key('codes')).update(`${kind}:${code}`).digest('hex')

function seal(obj: object): string {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${body}.${createHmac('sha256', key('state')).update(body).digest('base64url')}`
}
function unseal<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token) return null
  const [body, mac] = token.split('.')
  if (!body || !mac || !safeEqual(mac, createHmac('sha256', key('state')).update(body).digest('base64url'))) return null
  try {
    const v = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
    return v.exp > Date.now() ? v : null
  } catch {
    return null
  }
}

// TOTP-hemmeligheten lagres kryptert (AES-256-GCM) med nøkkel avledet fra PAYLOAD_SECRET.
function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key('totp'), iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url')
}
function decrypt(sealed: string): string {
  const raw = Buffer.from(sealed, 'base64url')
  const d = createDecipheriv('aes-256-gcm', key('totp'), raw.subarray(0, 12))
  d.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8')
}

// ---------------------------------------------------------------- TOTP (RFC 6238)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32(buf: Buffer): string {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}
function unbase32(s: string): Buffer {
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch)
    if (i < 0) continue
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}
function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', secret).update(msg).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}
/** Gyldig steg (±30 s), eller null. Steg som allerede er brukt godtas ikke igjen. */
function verifyTotp(secretB32: string, code: string, lastStep?: number | null): number | null {
  const secret = unbase32(secretB32)
  const now = Math.floor(Date.now() / 30_000)
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep != null && step <= lastStep) continue
    if (safeEqual(hotp(secret, step), code)) return step
  }
  return null
}

const newBackupCodes = () =>
  Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const s = base32(randomBytes(5)).toLowerCase()
    return `${s.slice(0, 4)}-${s.slice(4, 8)}`
  })
const normalizeBackup = (code: string) => code.toLowerCase().replace(/[^a-z2-7]/g, '')

// ---------------------------------------------------------------- HTTP-hjelpere
const isHttps = () => SERVER_URL().startsWith('https:')
function cookie(name: string, value: string, maxAgeS: number) {
  return `${name}=${value}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAgeS}${isHttps() ? '; Secure' : ''}`
}
function reply(req: PayloadRequest, status: number, body: unknown, cookies: string[] = []) {
  const headers = headersWithCors({ headers: new Headers(), req })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return Response.json(body, { status, headers })
}
const clearState = () => [cookie(STATE_COOKIE, '', 0), cookie(CHALLENGE_COOKIE, '', 0)]
const readState = (req: PayloadRequest) => unseal<MfaState>(parseCookies(req.headers).get(STATE_COOKIE))
const stateCookie = (uid: string | number, st: Stage) => {
  const ttl = st === 'enroll' ? ENROLL_TTL_S : STATE_TTL_S
  return cookie(STATE_COOKIE, seal({ uid, st, exp: Date.now() + ttl * 1000 }), ttl)
}
async function body(req: PayloadRequest): Promise<Record<string, any>> {
  await addDataAndFileToRequest(req)
  return (req.data as Record<string, any>) || {}
}

// ---------------------------------------------------------------- brukerdata
type EditorDoc = {
  id: string | number
  email: string
  name?: string
  mfaTotpSecret?: string | null
  mfaTotpPending?: string | null
  mfaTotpLastStep?: number | null
  mfaBackupCodes?: string[] | null
  mfaPasskeys?: StoredPasskey[] | null
  mfaEmailCodeHash?: string | null
  mfaEmailCodeExpires?: string | null
  mfaFailedAttempts?: number | null
  mfaLockUntil?: string | null
  [k: string]: unknown
}
const loadUser = (req: PayloadRequest, id: string | number) =>
  req.payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, showHiddenFields: true }) as unknown as Promise<EditorDoc>
const saveUser = (req: PayloadRequest, id: string | number, data: Partial<EditorDoc>) =>
  req.payload.update({ collection: 'users', id, data: data as any, depth: 0, overrideAccess: true })

const passkeysOf = (u: EditorDoc) => (Array.isArray(u.mfaPasskeys) ? u.mfaPasskeys : [])
const hasTotp = (u: EditorDoc) => Boolean(u.mfaTotpSecret)
const hasFactor = (u: EditorDoc) => hasTotp(u) || passkeysOf(u).length > 0
const isCodeLocked = (u: EditorDoc) => Boolean(u.mfaLockUntil && new Date(u.mfaLockUntil).getTime() > Date.now())
const LOCKED_MSG = 'For mange feil koder. Vent et kvarter og prøv igjen.'

async function codeFailed(req: PayloadRequest, u: EditorDoc) {
  const n = (u.mfaFailedAttempts || 0) + 1
  await saveUser(req, u.id, n >= MAX_CODE_FAILURES
    ? { mfaFailedAttempts: 0, mfaLockUntil: new Date(Date.now() + CODE_LOCK_MS).toISOString() }
    : { mfaFailedAttempts: n })
}

/** Lager en vanlig Payload-økt for brukeren og returnerer Set-Cookie for payload-token. */
async function issueSession(req: PayloadRequest, id: string | number): Promise<string> {
  const collectionConfig = req.payload.collections.users.config
  const user = (await loadUser(req, id)) as any
  user.collection = 'users'
  user._strategy = 'local-jwt'
  const { sid } = await addSessionToUser({ collectionConfig, payload: req.payload, req, user })
  const fieldsToSign = getFieldsToSign({ collectionConfig, email: user.email, sid, user })
  const { token } = await jwtSign({
    fieldsToSign,
    secret: req.payload.secret,
    tokenExpiration: collectionConfig.auth.tokenExpiration,
  })
  await saveUser(req, id, { mfaFailedAttempts: 0, mfaLockUntil: null, mfaEmailCodeHash: null, mfaEmailCodeExpires: null })
  return generatePayloadCookie({ collectionAuthConfig: collectionConfig.auth, cookiePrefix: req.payload.config.cookiePrefix, token })
}

/** Hvem setter opp en faktor: innlogget redaktør (kontosiden) eller innloggingens oppsettrinn. */
function enrollActor(req: PayloadRequest): { uid: string | number; duringLogin: boolean } | null {
  if (req.user && req.user.collection === 'users') return { uid: req.user.id, duringLogin: false }
  const s = readState(req)
  return s && s.st === 'enroll' ? { uid: s.uid, duringLogin: true } : null
}
const sessionUser = (req: PayloadRequest) => (req.user && req.user.collection === 'users' ? req.user.id : null)

// ---------------------------------------------------------------- kroker
class PasswordVerified extends Error {
  constructor(public uid: string | number) { super('ekko-mfa:password-verified') }
}

export const editorLoginGuard: CollectionBeforeLoginHook = ({ req, user }) => {
  if (req.context?.ekkoMfa === 'check') throw new PasswordVerified(user.id)
  if (!mfaEnforced()) return user
  // Tilbakestill passord: passordbyttet får gå gjennom, økten fjernes i afterOperation.
  const path = (() => { try { return new URL(req.url || '', 'http://x').pathname } catch { return '' } })()
  if (path.endsWith('/users/reset-password')) {
    req.context.ekkoStripSession = true
    return user
  }
  throw new APIError(
    'Innlogging for redaksjonen krever passkey eller kode fra autentiseringsapp. Bruk innloggingssiden på admin.ekko.no.',
    403, null, true,
  )
}

export const stripResetSession: CollectionAfterOperationHook = ({ operation, req, result }) => {
  if (operation === 'resetPassword' && req.context?.ekkoStripSession && result && typeof result === 'object') {
    return { ...(result as object), token: undefined } as typeof result
  }
  return result
}

// ---------------------------------------------------------------- e-postkode
async function sendEmailCode(req: PayloadRequest, u: EditorDoc) {
  // Ikke send ny kode oftere enn hvert minutt (en med passordet kunne ellers fylle innboksen).
  const issuedAt = u.mfaEmailCodeExpires ? new Date(u.mfaEmailCodeExpires).getTime() - EMAIL_CODE_TTL_MS : 0
  if (u.mfaEmailCodeHash && Date.now() - issuedAt < 60_000) return
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await saveUser(req, u.id, {
    mfaEmailCodeHash: hashCode('email', code),
    mfaEmailCodeExpires: new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString(),
  })
  // Lokal utvikling uten e-posttjeneste: koden må kunne leses et sted.
  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
    req.payload.logger.info(`[editor-mfa] e-postkode til ${u.email}: ${code} (bare lokalt, ingen e-posttjeneste)`)
  }
  await req.payload.sendEmail({
    to: u.email,
    subject: `${code} er påloggingskoden din – ${ISSUER}`,
    text:
      `Påloggingskoden din til redaksjonen på ${new URL(SERVER_URL()).host} er ${code}.\n\n` +
      `Koden gjelder i 10 minutter. Etterpå setter du opp passkey eller autentiseringsapp, ` +
      `som du bruker ved neste innlogging.\n\nHar du ikke prøvd å logge inn, kan du se bort fra ` +
      `denne e-posten, men bytt gjerne passord: noen kjenner det.\n`,
    html:
      `<p>Påloggingskoden din til redaksjonen på ${new URL(SERVER_URL()).host}:</p>` +
      `<p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>` +
      `<p>Koden gjelder i 10 minutter. Etterpå setter du opp passkey eller autentiseringsapp, ` +
      `som du bruker ved neste innlogging.</p>` +
      `<p>Har du ikke prøvd å logge inn, kan du se bort fra denne e-posten, men bytt gjerne passord: noen kjenner det.</p>`,
  })
}

// ---------------------------------------------------------------- endepunkter
const passwordStep: Endpoint = {
  path: '/mfa/password',
  method: 'post',
  handler: async (req) => {
    const { email, password } = await body(req)
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return reply(req, 400, { error: 'Skriv inn e-post og passord.' })
    }
    let uid: string | number | null = null
    try {
      await req.payload.login({ collection: 'users', data: { email, password }, context: { ekkoMfa: 'check' } })
    } catch (e: any) {
      if (e instanceof PasswordVerified || e?.message === 'ekko-mfa:password-verified') uid = e.uid
      else if (e?.name === 'LockedAuth') return reply(req, 429, { error: 'Kontoen er midlertidig låst etter for mange feil passord. Prøv igjen om ti minutter.' })
      else return reply(req, 401, { error: 'Feil e-post eller passord.' })
    }
    if (uid == null) return reply(req, 500, { error: 'Uventet svar fra innloggingen.' })
    const u = await loadUser(req, uid)
    // Passordet var riktig: nullstill telleren for feil passord (Payloads egen
    // nullstilling ble rullet tilbake sammen med økten).
    await resetLoginAttempts({ collection: req.payload.collections.users.config, doc: u as any, payload: req.payload, req })
    if (isCodeLocked(u)) return reply(req, 429, { error: LOCKED_MSG })

    if (hasFactor(u)) {
      return reply(req, 200, { next: 'code', hasTotp: hasTotp(u), hasPasskey: passkeysOf(u).length > 0 }, [stateCookie(u.id, 'code')])
    }
    await sendEmailCode(req, u)
    return reply(req, 200, { next: 'email' }, [stateCookie(u.id, 'email')])
  },
}

const codeStep: Endpoint = {
  path: '/mfa/code',
  method: 'post',
  handler: async (req) => {
    const s = readState(req)
    if (!s || s.st !== 'code') return reply(req, 401, { error: 'Økten gikk ut. Logg inn på nytt.' }, clearState())
    const { code } = await body(req)
    const raw = String(code || '').trim()
    const u = await loadUser(req, s.uid)
    if (isCodeLocked(u)) return reply(req, 429, { error: LOCKED_MSG })

    // App-kode (6 sifre)
    if (/^\d{6}$/.test(raw.replace(/\s/g, '')) && u.mfaTotpSecret) {
      const step = verifyTotp(decrypt(u.mfaTotpSecret), raw.replace(/\s/g, ''), u.mfaTotpLastStep)
      if (step != null) {
        await saveUser(req, u.id, { mfaTotpLastStep: step })
        return reply(req, 200, { ok: true }, [await issueSession(req, u.id), ...clearState()])
      }
    }
    // Reservekode (engangs)
    const norm = normalizeBackup(raw)
    const codes = Array.isArray(u.mfaBackupCodes) ? u.mfaBackupCodes : []
    if (norm.length === 8) {
      const h = hashCode('backup', norm)
      const i = codes.findIndex((c) => safeEqual(c, h))
      if (i >= 0) {
        const left = codes.filter((_, j) => j !== i)
        await saveUser(req, u.id, { mfaBackupCodes: left })
        return reply(req, 200, { ok: true, backupCodesLeft: left.length }, [await issueSession(req, u.id), ...clearState()])
      }
    }
    await codeFailed(req, u)
    return reply(req, 401, { error: 'Koden stemmer ikke. Prøv igjen.' })
  },
}

const emailVerify: Endpoint = {
  path: '/mfa/email/verify',
  method: 'post',
  handler: async (req) => {
    const s = readState(req)
    if (!s || s.st !== 'email') return reply(req, 401, { error: 'Økten gikk ut. Logg inn på nytt.' }, clearState())
    const { code } = await body(req)
    const u = await loadUser(req, s.uid)
    if (isCodeLocked(u)) return reply(req, 429, { error: LOCKED_MSG })
    const ok =
      u.mfaEmailCodeHash && u.mfaEmailCodeExpires && new Date(u.mfaEmailCodeExpires).getTime() > Date.now() &&
      safeEqual(u.mfaEmailCodeHash, hashCode('email', String(code || '').replace(/\D/g, '')))
    if (!ok) {
      await codeFailed(req, u)
      return reply(req, 401, { error: 'Koden stemmer ikke eller er utløpt.' })
    }
    await saveUser(req, u.id, { mfaEmailCodeHash: null, mfaEmailCodeExpires: null, mfaFailedAttempts: 0 })
    return reply(req, 200, { next: 'enroll' }, [stateCookie(u.id, 'enroll')])
  },
}

const totpSetup: Endpoint = {
  path: '/mfa/totp/setup',
  method: 'post',
  handler: async (req) => {
    const actor = enrollActor(req)
    if (!actor) return reply(req, 401, { error: 'Ikke innlogget.' })
    const u = await loadUser(req, actor.uid)
    const secret = base32(randomBytes(20))
    await saveUser(req, u.id, { mfaTotpPending: encrypt(secret) })
    const label = encodeURIComponent(`${ISSUER}:${u.email}`)
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`
    const qr = await QRCode.toString(uri, { type: 'svg', margin: 1, width: 200 })
    return reply(req, 200, { uri, qr, secret: secret.match(/.{1,4}/g)?.join(' ') })
  },
}

const totpConfirm: Endpoint = {
  path: '/mfa/totp/confirm',
  method: 'post',
  handler: async (req) => {
    const actor = enrollActor(req)
    if (!actor) return reply(req, 401, { error: 'Ikke innlogget.' })
    const { code } = await body(req)
    const u = await loadUser(req, actor.uid)
    if (isCodeLocked(u)) return reply(req, 429, { error: LOCKED_MSG })
    if (!u.mfaTotpPending) return reply(req, 400, { error: 'Start oppsettet på nytt.' })
    const secret = decrypt(u.mfaTotpPending)
    const step = verifyTotp(secret, String(code || '').replace(/\s/g, ''))
    if (step == null) {
      await codeFailed(req, u)
      return reply(req, 401, { error: 'Koden stemmer ikke. Sjekk at klokka på telefonen går riktig, og prøv neste kode.' })
    }
    const backupCodes = Array.isArray(u.mfaBackupCodes) && u.mfaBackupCodes.length ? null : newBackupCodes()
    await saveUser(req, u.id, {
      mfaTotpSecret: encrypt(secret),
      mfaTotpPending: null,
      mfaTotpLastStep: step,
      mfaFailedAttempts: 0,
      ...(backupCodes ? { mfaBackupCodes: backupCodes.map((c) => hashCode('backup', normalizeBackup(c))) } : {}),
    })
    const cookies = actor.duringLogin ? [await issueSession(req, u.id), ...clearState()] : []
    return reply(req, 200, { ok: true, backupCodes }, cookies)
  },
}

const passkeyRegisterOptions: Endpoint = {
  path: '/mfa/passkey/register/options',
  method: 'post',
  handler: async (req) => {
    const actor = enrollActor(req)
    if (!actor) return reply(req, 401, { error: 'Ikke innlogget.' })
    const u = await loadUser(req, actor.uid)
    const options = await generateRegistrationOptions({
      rpName: ISSUER,
      rpID: RP_ID(),
      userName: u.email,
      userDisplayName: u.name || u.email,
      userID: new TextEncoder().encode(`ekko-user-${u.id}`),
      attestationType: 'none',
      excludeCredentials: passkeysOf(u).map((p) => ({ id: p.id, transports: p.transports as any })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    })
    const ch: Challenge = { c: options.challenge, p: 'reg', uid: u.id, exp: Date.now() + 5 * 60_000 }
    return reply(req, 200, options, [cookie(CHALLENGE_COOKIE, seal(ch), 300)])
  },
}

const passkeyRegisterVerify: Endpoint = {
  path: '/mfa/passkey/register/verify',
  method: 'post',
  handler: async (req) => {
    const actor = enrollActor(req)
    if (!actor) return reply(req, 401, { error: 'Ikke innlogget.' })
    const ch = unseal<Challenge>(parseCookies(req.headers).get(CHALLENGE_COOKIE))
    if (!ch || ch.p !== 'reg' || String(ch.uid) !== String(actor.uid)) return reply(req, 400, { error: 'Start på nytt.' })
    const { response, name } = await body(req)
    let v
    try {
      v = await verifyRegistrationResponse({
        response,
        expectedChallenge: ch.c,
        expectedOrigin: ORIGINS(),
        expectedRPID: RP_ID(),
        requireUserVerification: true,
      })
    } catch (e: any) {
      return reply(req, 400, { error: `Passkey ble ikke godkjent: ${e?.message || e}` })
    }
    if (!v.verified) return reply(req, 400, { error: 'Passkey ble ikke godkjent.' })
    const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo
    const u = await loadUser(req, actor.uid)
    const pk: StoredPasskey = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports,
      name: String(name || '').trim().slice(0, 60) || 'Passkey',
      createdAt: new Date().toISOString(),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    }
    const backupCodes = Array.isArray(u.mfaBackupCodes) && u.mfaBackupCodes.length ? null : newBackupCodes()
    await saveUser(req, u.id, {
      mfaPasskeys: [...passkeysOf(u).filter((p) => p.id !== pk.id), pk],
      ...(backupCodes ? { mfaBackupCodes: backupCodes.map((c) => hashCode('backup', normalizeBackup(c))) } : {}),
    })
    const cookies = [cookie(CHALLENGE_COOKIE, '', 0), ...(actor.duringLogin ? [await issueSession(req, u.id), cookie(STATE_COOKIE, '', 0)] : [])]
    return reply(req, 200, { ok: true, backupCodes }, cookies)
  },
}

const passkeyLoginOptions: Endpoint = {
  path: '/mfa/passkey/login/options',
  method: 'post',
  handler: async (req) => {
    // Oppdagbare passkeys: nettleseren tilbyr kontoene den kjenner, ingen e-post trengs.
    const options = await generateAuthenticationOptions({ rpID: RP_ID(), userVerification: 'required' })
    const ch: Challenge = { c: options.challenge, p: 'auth', exp: Date.now() + 5 * 60_000 }
    return reply(req, 200, options, [cookie(CHALLENGE_COOKIE, seal(ch), 300)])
  },
}

const passkeyLoginVerify: Endpoint = {
  path: '/mfa/passkey/login/verify',
  method: 'post',
  handler: async (req) => {
    const ch = unseal<Challenge>(parseCookies(req.headers).get(CHALLENGE_COOKIE))
    if (!ch || ch.p !== 'auth') return reply(req, 400, { error: 'Prøv på nytt.' })
    const { response } = await body(req)
    const credId = typeof response?.id === 'string' ? response.id : ''
    // Få redaktører: søk gjennom dem i stedet for å spørre i JSON-kolonnen.
    const all = await req.payload.find({
      collection: 'users', limit: 1000, depth: 0, overrideAccess: true, showHiddenFields: true, pagination: false,
    })
    const u = (all.docs as unknown as EditorDoc[]).find((d) => passkeysOf(d).some((p) => p.id === credId))
    const pk = u && passkeysOf(u).find((p) => p.id === credId)
    if (!u || !pk) return reply(req, 401, { error: 'Denne passkeyen er ikke registrert her. Logg inn med passord og kode, og legg den til på kontosiden.' })
    let v
    try {
      v = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.c,
        expectedOrigin: ORIGINS(),
        expectedRPID: RP_ID(),
        credential: { id: pk.id, publicKey: Buffer.from(pk.publicKey, 'base64url'), counter: pk.counter, transports: pk.transports as any },
        requireUserVerification: true,
      })
    } catch (e: any) {
      return reply(req, 401, { error: `Passkey ble ikke godkjent: ${e?.message || e}` })
    }
    if (!v.verified) return reply(req, 401, { error: 'Passkey ble ikke godkjent.' })
    const now = new Date().toISOString()
    await saveUser(req, u.id, {
      mfaPasskeys: passkeysOf(u).map((p) => (p.id === pk.id ? { ...p, counter: v.authenticationInfo.newCounter, lastUsedAt: now } : p)),
    })
    return reply(req, 200, { ok: true }, [await issueSession(req, u.id), ...clearState()])
  },
}

// --- kontosiden (krever innlogget redaktør, gjelder bare egen konto)
const status: Endpoint = {
  path: '/mfa/status',
  method: 'get',
  handler: async (req) => {
    const uid = sessionUser(req)
    if (uid == null) return reply(req, 401, { error: 'Ikke innlogget.' })
    const u = await loadUser(req, uid)
    return reply(req, 200, {
      hasTotp: hasTotp(u),
      backupCodesLeft: Array.isArray(u.mfaBackupCodes) ? u.mfaBackupCodes.length : 0,
      passkeys: passkeysOf(u).map(({ id, name, createdAt, lastUsedAt, backedUp }) => ({ id, name, createdAt, lastUsedAt, backedUp })),
    })
  },
}

const removePasskey: Endpoint = {
  path: '/mfa/passkey/remove',
  method: 'post',
  handler: async (req) => {
    const uid = sessionUser(req)
    if (uid == null) return reply(req, 401, { error: 'Ikke innlogget.' })
    const { id } = await body(req)
    const u = await loadUser(req, uid)
    await saveUser(req, uid, { mfaPasskeys: passkeysOf(u).filter((p) => p.id !== id) })
    return reply(req, 200, { ok: true })
  },
}

const removeTotp: Endpoint = {
  path: '/mfa/totp/remove',
  method: 'post',
  handler: async (req) => {
    const uid = sessionUser(req)
    if (uid == null) return reply(req, 401, { error: 'Ikke innlogget.' })
    await saveUser(req, uid, { mfaTotpSecret: null, mfaTotpPending: null, mfaTotpLastStep: null })
    return reply(req, 200, { ok: true })
  },
}

const regenerateBackupCodes: Endpoint = {
  path: '/mfa/backup-codes',
  method: 'post',
  handler: async (req) => {
    const uid = sessionUser(req)
    if (uid == null) return reply(req, 401, { error: 'Ikke innlogget.' })
    const codes = newBackupCodes()
    await saveUser(req, uid, { mfaBackupCodes: codes.map((c) => hashCode('backup', normalizeBackup(c))) })
    return reply(req, 200, { backupCodes: codes })
  },
}

export const editorMfaEndpoints: Endpoint[] = [
  passwordStep, codeStep, emailVerify,
  totpSetup, totpConfirm,
  passkeyRegisterOptions, passkeyRegisterVerify,
  passkeyLoginOptions, passkeyLoginVerify,
  status, removePasskey, removeTotp, regenerateBackupCodes,
]

// Skjulte felt på users: aldri lesbare eller skrivbare via API-et (bare endepunktene
// over, som bruker overrideAccess).
const hiddenField = { hidden: true, access: { read: () => false, create: () => false, update: () => false } }
export const editorMfaFields = [
  { name: 'mfaTotpSecret', type: 'text', ...hiddenField },
  { name: 'mfaTotpPending', type: 'text', ...hiddenField },
  { name: 'mfaTotpLastStep', type: 'number', ...hiddenField },
  { name: 'mfaBackupCodes', type: 'json', ...hiddenField },
  { name: 'mfaPasskeys', type: 'json', ...hiddenField },
  { name: 'mfaEmailCodeHash', type: 'text', ...hiddenField },
  { name: 'mfaEmailCodeExpires', type: 'date', ...hiddenField },
  { name: 'mfaFailedAttempts', type: 'number', ...hiddenField },
  { name: 'mfaLockUntil', type: 'date', ...hiddenField },
] as const
