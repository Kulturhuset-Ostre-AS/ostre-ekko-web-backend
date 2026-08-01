'use client'
/**
 * «Skriv ut medlemskort»-knapp på medlemsdokumentet i admin. Åpner
 * kort-HTML-en (CR80-format) i ny fane — skriv ut derfra til kortprinter
 * eller papir. Batch-lenken tar alle aktive medlemmer uten hentet kort.
 */
import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

export default function PrintCardButton() {
  const { id } = useDocumentInfo()
  if (!id) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <a href={`/api/commerce/members/${id}/card`} target="_blank" rel="noreferrer">
        <button type="button">Skriv ut medlemskort</button>
      </a>{' '}
      <a href="/api/commerce/members/cards?scope=pending" target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>
        Alle uhentede kort
      </a>
    </div>
  )
}
