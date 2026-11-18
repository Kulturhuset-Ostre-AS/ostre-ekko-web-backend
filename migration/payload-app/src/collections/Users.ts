import type { CollectionConfig, Field } from 'payload'
import { editorLoginGuard, editorMfaEndpoints, editorMfaFields, stripResetSession } from '../auth/editor-mfa'

// Admin users for the Payload control panel. First user is created on first boot.
// Innlogging: passkey, eller passord + kode fra autentiseringsapp (src/auth/editor-mfa.ts).
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // API keys for service users (the Craft→Payload import scripts use
    // import@ekko.no with a key from Secret Manager instead of a password).
    // Header: `Authorization: users API-Key <key>`.
    useAPIKey: true,
  },
  admin: { useAsTitle: 'email' },
  endpoints: editorMfaEndpoints,
  hooks: {
    beforeLogin: [editorLoginGuard],
    afterOperation: [stripResetSession],
  },
  fields: [
    { name: 'name', type: 'text' },
    // «Sikkerhet» på kontosiden: passkeys, autentiseringsapp og reservekoder.
    {
      name: 'mfaSecurity',
      type: 'ui',
      admin: { components: { Field: '/components/auth/AccountSecurity' } },
    },
    ...(editorMfaFields as unknown as Field[]),
  ],
}
