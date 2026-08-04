/**
 * Egen overskrift på innloggingssiden (admin.components.beforeLogin) — større
 * enn Payload-logoen, slik at redaktører umiddelbart ser hvor de er kommet.
 */
import React from 'react'

export default function LoginTitle() {
  return (
    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
      <h1 style={{ fontSize: '2.6rem', lineHeight: 1.1, margin: 0, letterSpacing: '-0.02em' }}>
        Østre&nbsp;/&nbsp;EKKO
      </h1>
      <p style={{ margin: '0.5rem 0 0', fontSize: '1rem', opacity: 0.75 }}>
        Redaksjon og administrasjon — admin.ekko.no
      </p>
    </div>
  )
}
