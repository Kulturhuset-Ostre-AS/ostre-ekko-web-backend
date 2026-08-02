'use client'
/**
 * «Oversett fra norsk (utkast)» — vises kun i EN-visningen av et dokument.
 * Kaller /api/translate/draft som maskinoversetter nb-innholdet og lagrer det
 * som EN-utkast (aldri publisering). Redaktøren gjennomgår og publiserer selv.
 */
import React, { useState } from 'react'
import { useDocumentInfo, useLocale } from '@payloadcms/ui'

export default function TranslateButton() {
  const { id, collectionSlug } = useDocumentInfo()
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  if (!id || locale?.code !== 'en') return null

  const run = async () => {
    if (!window.confirm('Maskinoversette norsk innhold til engelsk og lagre som UTKAST? (Publiseres ikke automatisk — du gjennomgår og publiserer selv.)')) return
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch('/api/translate/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: collectionSlug, id }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || r.status)
      setMsg(`Oversatte ${j.strings} tekstbiter til utkast — laster på nytt…`)
      setTimeout(() => window.location.reload(), 900)
    } catch (e) {
      setMsg('Feil: ' + (e instanceof Error ? e.message : String(e)))
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button type="button" onClick={run} disabled={busy}>
        {busy ? 'Oversetter…' : 'Oversett fra norsk (utkast)'}
      </button>
      {msg && <p style={{ fontSize: 12, marginTop: 4 }}>{msg}</p>}
    </div>
  )
}
