'use client'
// Felles klienthjelpere for innloggingen og kontosiden (src/auth/editor-mfa.ts).

export const MFA_API = '/api/users/mfa'

export async function mfaCall<T = any>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`${MFA_API}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || json?.errors?.[0]?.message || `Feil ${res.status}`)
  return json as T
}

/** Et lesbart standardnavn på en ny passkey, f.eks. «iPhone» eller «Mac (Chrome)». */
export function deviceName(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Enhet'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : ''
  return browser ? `${os} (${browser})` : os
}

/** Feilmeldinger fra nettleserens passkey-dialog, på norsk. */
export function passkeyError(e: any): string {
  const name = e?.name || ''
  if (name === 'NotAllowedError' || name === 'AbortError') return 'Passkey-dialogen ble avbrutt eller gikk ut på tid.'
  if (name === 'InvalidStateError') return 'Denne enheten har allerede en passkey for kontoen.'
  if (name === 'SecurityError') return 'Passkeys virker bare på admin-adressen (https).'
  return e?.message || String(e)
}
