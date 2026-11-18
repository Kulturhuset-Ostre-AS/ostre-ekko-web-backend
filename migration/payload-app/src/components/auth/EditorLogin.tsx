'use client'
/**
 * Innloggingen for redaksjonen (admin.components.beforeLogin). Erstatter Payloads
 * eget passordskjema, som skjules i custom.scss: passkey først, ellers passord +
 * kode fra autentiseringsapp. Første gang: kode på e-post, så oppsett av passkey
 * eller app. Serversiden er src/auth/editor-mfa.ts.
 */
import React, { useEffect, useState } from 'react'
import { Button } from '@payloadcms/ui'
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { deviceName, mfaCall, passkeyError } from './mfa-client'

type Step = 'start' | 'code' | 'email' | 'enroll' | 'totp' | 'backup'

function goToAdmin() {
  const r = new URLSearchParams(window.location.search).get('redirect')
  window.location.href = r && r.startsWith('/admin') && !r.startsWith('//') ? r : '/admin'
}

export default function EditorLogin() {
  const [step, setStep] = useState<Step>('start')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeInfo, setCodeInfo] = useState<{ hasTotp: boolean; hasPasskey: boolean }>({ hasTotp: true, hasPasskey: false })
  const [totp, setTotp] = useState<{ qr: string; secret: string; uri: string } | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  // Etter mount: serveren vet ikke om nettleseren støtter passkeys (unngår hydreringsavvik).
  const [webauthn, setWebauthn] = useState(false)
  useEffect(() => setWebauthn(browserSupportsWebAuthn()), [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await fn() } catch (e: any) { setError(e?.message || String(e)) } finally { setBusy(false) }
  }
  const afterEnroll = (codes: string[] | null) => {
    if (codes?.length) { setBackupCodes(codes); setStep('backup') } else goToAdmin()
  }

  const loginWithPasskey = () => run(async () => {
    const options = await mfaCall('/passkey/login/options', {})
    let response
    try { response = await startAuthentication({ optionsJSON: options }) } catch (e) { throw new Error(passkeyError(e)) }
    await mfaCall('/passkey/login/verify', { response })
    goToAdmin()
  })

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const r = await mfaCall<{ next: 'code' | 'email'; hasTotp?: boolean; hasPasskey?: boolean }>('/password', { email, password })
      setPassword('')
      setCode('')
      if (r.next === 'code') { setCodeInfo({ hasTotp: Boolean(r.hasTotp), hasPasskey: Boolean(r.hasPasskey) }); setStep('code') }
      else setStep('email')
    })
  }

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => { await mfaCall('/code', { code }); goToAdmin() })
  }

  const submitEmailCode = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => { await mfaCall('/email/verify', { code }); setCode(''); setStep('enroll') })
  }

  const enrollPasskey = () => run(async () => {
    const options = await mfaCall('/passkey/register/options', {})
    let response
    try { response = await startRegistration({ optionsJSON: options }) } catch (e) { throw new Error(passkeyError(e)) }
    const r = await mfaCall<{ backupCodes: string[] | null }>('/passkey/register/verify', { response, name: deviceName() })
    afterEnroll(r.backupCodes)
  })

  const startTotp = () => run(async () => {
    setTotp(await mfaCall('/totp/setup', {}))
    setCode('')
    setStep('totp')
  })

  const confirmTotp = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const r = await mfaCall<{ backupCodes: string[] | null }>('/totp/confirm', { code })
      afterEnroll(r.backupCodes)
    })
  }

  return (
    <div className="ekko-mfa">
      {error && <p className="ekko-mfa__error" role="alert">{error}</p>}

      {step === 'start' && (
        <>
          {webauthn && (
            <>
              <Button buttonStyle="primary" size="large" onClick={loginWithPasskey} disabled={busy} className="ekko-mfa__wide">
                Logg inn med passkey
              </Button>
              <p className="ekko-mfa__hint">Face ID, Touch ID, Windows Hello eller sikkerhetsnøkkel.</p>
              <div className="ekko-mfa__divider"><span>eller med passord</span></div>
            </>
          )}
          <form onSubmit={submitPassword} className="ekko-mfa__form">
            <label>
              E-post
              <input type="email" autoComplete="username webauthn" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Passord
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <Button type="submit" buttonStyle={webauthn ? 'secondary' : 'primary'} size="large" disabled={busy} className="ekko-mfa__wide">
              Neste
            </Button>
          </form>
          <p className="ekko-mfa__links"><a href="/admin/forgot">Glemt passord?</a></p>
        </>
      )}

      {step === 'code' && (
        <form onSubmit={submitCode} className="ekko-mfa__form">
          {codeInfo.hasTotp ? (
            <p>Skriv inn koden fra autentiseringsappen. Har du ikke telefonen, kan du bruke en av reservekodene.</p>
          ) : (
            <p>Kontoen din bruker passkey. Gå tilbake og velg «Logg inn med passkey», eller skriv inn en reservekode.</p>
          )}
          <label>
            {codeInfo.hasTotp ? 'Kode fra app eller reservekode' : 'Reservekode'}
            <input inputMode={codeInfo.hasTotp ? 'numeric' : 'text'} autoComplete="one-time-code" autoFocus required
              value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <Button type="submit" buttonStyle="primary" size="large" disabled={busy} className="ekko-mfa__wide">Logg inn</Button>
          <p className="ekko-mfa__links"><a href="#" onClick={(e) => { e.preventDefault(); setError(''); setStep('start') }}>Tilbake</a></p>
        </form>
      )}

      {step === 'email' && (
        <form onSubmit={submitEmailCode} className="ekko-mfa__form">
          <p>
            Første gang med ny innlogging: vi har sendt en sekssifret kode til e-posten din. Etterpå setter du opp
            passkey eller autentiseringsapp, som du bruker ved neste innlogging.
          </p>
          <label>
            Kode fra e-posten
            <input inputMode="numeric" autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <Button type="submit" buttonStyle="primary" size="large" disabled={busy} className="ekko-mfa__wide">Fortsett</Button>
        </form>
      )}

      {step === 'enroll' && (
        <div className="ekko-mfa__form">
          <p><strong>Sett opp sikker innlogging.</strong> Velg det du vil bruke neste gang du logger inn.</p>
          {webauthn && (
            <>
              <Button buttonStyle="primary" size="large" onClick={enrollPasskey} disabled={busy} className="ekko-mfa__wide">
                Opprett passkey på denne enheten
              </Button>
              <p className="ekko-mfa__hint">Anbefalt. Du logger inn med Face ID, Touch ID eller Windows Hello, uten passord.</p>
            </>
          )}
          <Button buttonStyle="secondary" size="large" onClick={startTotp} disabled={busy} className="ekko-mfa__wide">
            Bruk autentiseringsapp
          </Button>
          <p className="ekko-mfa__hint">Passord pluss en kode fra f.eks. Google Authenticator, Microsoft Authenticator eller 1Password.</p>
        </div>
      )}

      {step === 'totp' && totp && (
        <form onSubmit={confirmTotp} className="ekko-mfa__form">
          <p>Skann koden med autentiseringsappen, og skriv inn den sekssifrede koden appen viser.</p>
          <div className="ekko-mfa__qr" dangerouslySetInnerHTML={{ __html: totp.qr }} />
          <p className="ekko-mfa__hint">Kan du ikke skanne? Legg inn denne nøkkelen manuelt: <code>{totp.secret}</code></p>
          <label>
            Kode fra appen
            <input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <Button type="submit" buttonStyle="primary" size="large" disabled={busy} className="ekko-mfa__wide">Bekreft</Button>
          <p className="ekko-mfa__links"><a href="#" onClick={(e) => { e.preventDefault(); setError(''); setStep('enroll') }}>Tilbake</a></p>
        </form>
      )}

      {step === 'backup' && (
        <div className="ekko-mfa__form">
          <p>
            <strong>Reservekoder.</strong> Hver kode virker én gang, i stedet for app eller passkey, hvis du mister
            telefonen. Lagre dem i passordbehandleren eller skriv dem ut. De vises bare nå.
          </p>
          <ul className="ekko-mfa__codes">{backupCodes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
          <Button buttonStyle="primary" size="large" onClick={goToAdmin} className="ekko-mfa__wide">
            Jeg har lagret kodene – fortsett
          </Button>
        </div>
      )}
    </div>
  )
}
