'use client'
/**
 * Personal-lenker nederst i admin-navigasjonen: salgsrapporter (custom view)
 * og dør-skanneren (på frontenden — NEXT_PUBLIC_FRONTEND_URL / framtid).
 */
import React, { useEffect, useState } from 'react'

export default function StaffNavLinks() {
  const [frontend, setFrontend] = useState('')
  useEffect(() => {
    fetch('/api/commerce/config')
      .then((r) => r.json())
      .then((j: { frontendUrl?: string }) => setFrontend((j.frontendUrl || '').replace(/\/$/, '')))
      .catch(() => {})
  }, [])
  const style: React.CSSProperties = { display: 'block', padding: '4px 0' }
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--theme-elevation-150)', paddingTop: 12 }}>
      <a href="/admin/rapporter" style={style}>Salgsrapporter</a>
      <a href={`${frontend}/skann`} target="_blank" rel="noreferrer" style={style}>
        Skann billetter ↗
      </a>
      <a href="/api/commerce/members/cards?scope=pending" target="_blank" rel="noreferrer" style={style}>
        Skriv ut uhentede medlemskort ↗
      </a>
    </div>
  )
}
