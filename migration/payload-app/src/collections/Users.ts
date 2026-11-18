import type { CollectionConfig } from 'payload'

// Admin users for the Payload control panel. First user is created on first boot.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // API keys for service users (the Craft→Payload import scripts use
    // import@ekko.no with a key from Secret Manager instead of a password).
    // Header: `Authorization: users API-Key <key>`.
    useAPIKey: true,
  },
  admin: { useAsTitle: 'email' },
  fields: [{ name: 'name', type: 'text' }],
}
