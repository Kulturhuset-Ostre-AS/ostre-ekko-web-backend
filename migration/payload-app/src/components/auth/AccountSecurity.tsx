'use client'
/**
 * «Sikkerhet» på kontosiden (ui-felt på users): passkeys, autentiseringsapp og
 * reservekoder for den innloggede redaktøren. Andres kontoer viser bare en merknad.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Button, useAuth, useDocumentInfo } from '@payloadcms/ui'
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { deviceName, mfaCall, passkeyError } from './mfa-client'

type Status = {
  hasTotp: boolean
  backupCodesLeft: number
  passkeys: { id: string; name: string; createdAt: string; lastUsedAt?: string; backedUp?: boolean }[]
}
const fmt = (d?: string) => (d ? new Date(d).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }) : '–')

export default function AccountSecurity() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const own = user && id != null && String(user.id) === String(id)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [totp, setTotp] = useState<{ qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [webauthn, setWebauthn] = useState(false)
  useEffect(() => setWebauthn(browserSupportsWebAuthn()), [])

  const load = useCallback(async () => {
    try { setStatus(await mfaCall<Status>('/status', undefined, 'GET')) } catch (e: any) { setError(e.message) }
  }, [])
  useEffect(() => { if (own) load() }, [own, load])

  if (!own) {
    return (
      <div className="ekko-mfa-account">
        <h3>Sikkerhet</h3>
        <p className="ekko-mfa__hint">Passkeys og autentiseringsapp kan bare endres av brukeren selv, på egen konto.</p>
      </div>
    )
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await fn(); await load() } catch (e: any) { setError(e?.message || String(e)) } finally { setBusy(false) }
  }
  const addPasskey = () => run(async () => {
    const options = await mfaCall('/passkey/register/options', {})
    let response
    try { response = await startRegistration({ optionsJSON: options }) } catch (e) { throw new Error(passkeyError(e)) }
    const name = window.prompt('Navn på passkeyen (f.eks. «Jobb-Mac»):', deviceName()) || deviceName()
    const r = await mfaCall<{ backupCodes: string[] | null }>('/passkey/register/verify', { response, name })
    if (r.backupCodes) setCodes(r.backupCodes)
  })
  const removePasskey = (pid: string, name: string) => {
    if (!window.confirm(`Fjerne passkeyen «${name}»? Den kan ikke lenger brukes til å logge inn her.`)) return
    run(async () => { await mfaCall('/passkey/remove', { id: pid }) })
  }
  const startTotp = () => run(async () => { setTotp(await mfaCall('/totp/setup', {})); setCode('') })
  const confirmTotp = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const r = await mfaCall<{ backupCodes: string[] | null }>('/totp/confirm', { code })
      setTotp(null)
      if (r.backupCodes) setCodes(r.backupCodes)
    })
  }
  const removeTotp = () => {
    if (!window.confirm('Fjerne autentiseringsappen? Da kan du ikke logge inn med passord + kode før du setter den opp igjen.')) return
    run(async () => { await mfaCall('/totp/remove', {}) })
  }
  const newCodes = () => {
    if (!window.confirm('Lage nye reservekoder? De gamle slutter å virke.')) return
    run(async () => { setCodes((await mfaCall<{ backupCodes: string[] }>('/backup-codes', {})).backupCodes) })
  }

  const noFactor = status && !status.hasTotp && status.passkeys.length === 0

  return (
    <div className="ekko-mfa-account">
      <h3>Sikkerhet</h3>
      {error && <p className="ekko-mfa__error" role="alert">{error}</p>}
      {noFactor && (
        <p className="ekko-mfa__error">
          Du har verken passkey eller autentiseringsapp. Neste innlogging krever en kode på e-post og oppsett av en av dem.
        </p>
      )}

      <h4>Passkeys</h4>
      {status?.passkeys.length ? (
        <table className="ekko-mfa__table">
          <thead><tr><th>Navn</th><th>Lagt til</th><th>Sist brukt</th><th /></tr></thead>
          <tbody>
            {status.passkeys.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{fmt(p.createdAt)}</td>
                <td>{fmt(p.lastUsedAt)}</td>
                <td><Button buttonStyle="secondary" size="small" disabled={busy} onClick={() => removePasskey(p.id, p.name)}>Fjern</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="ekko-mfa__hint">Ingen passkeys ennå.</p>
      )}
      {webauthn && (
        <Button buttonStyle="primary" size="small" disabled={busy} onClick={addPasskey}>Legg til passkey på denne enheten</Button>
      )}

      <h4>Autentiseringsapp</h4>
      <p className="ekko-mfa__hint">{status?.hasTotp ? 'Satt opp. Brukes sammen med passord.' : 'Ikke satt opp.'}</p>
      {!totp && (
        <Button buttonStyle={status?.hasTotp ? 'secondary' : 'primary'} size="small" disabled={busy} onClick={startTotp}>
          {status?.hasTotp ? 'Flytt til ny telefon' : 'Sett opp autentiseringsapp'}
        </Button>
      )}
      {!totp && status?.hasTotp && (
        <Button buttonStyle="secondary" size="small" disabled={busy} onClick={removeTotp}>Fjern</Button>
      )}
      {totp && (
        <form onSubmit={confirmTotp} className="ekko-mfa__form">
          <p>Skann koden med appen, og skriv inn den sekssifrede koden appen viser.</p>
          <div className="ekko-mfa__qr" dangerouslySetInnerHTML={{ __html: totp.qr }} />
          <p className="ekko-mfa__hint">Manuell nøkkel: <code>{totp.secret}</code></p>
          <label>
            Kode fra appen
            <input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div>
            <Button type="submit" buttonStyle="primary" size="small" disabled={busy}>Bekreft</Button>
            <Button buttonStyle="secondary" size="small" disabled={busy} onClick={() => setTotp(null)}>Avbryt</Button>
          </div>
        </form>
      )}

      <h4>Reservekoder</h4>
      <p className="ekko-mfa__hint">{status ? `${status.backupCodesLeft} ubrukte reservekoder.` : ''}</p>
      {codes && (
        <>
          <p><strong>Nye reservekoder. De vises bare nå:</strong></p>
          <ul className="ekko-mfa__codes">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
        </>
      )}
      <Button buttonStyle="secondary" size="small" disabled={busy} onClick={newCodes}>Lag nye reservekoder</Button>
    </div>
  )
}
