/**
 * Ekko-logo i stedet for Payload-logoen (admin.components.graphics.Logo):
 * samme merke som nettsidens topplinje — sirkelen fulgt av navnet. Vises på
 * innloggingssiden og andre «ytre» admin-sider. currentColor gjør at den
 * følger admin-temaet (lyst/mørkt).
 */
import React from 'react'

export default function EkkoLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <svg viewBox="0 0 107 107" width="44" height="44" aria-hidden="true">
        <circle cx="53.5" cy="53.5" r="53" fill="currentColor" />
      </svg>
      <span style={{ fontSize: '2.4rem', fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1 }}>
        EKKO
      </span>
    </div>
  )
}
