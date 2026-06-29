import type { CollectionConfig } from 'payload'

// Admin users for the Payload control panel. First user is created on first boot.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [{ name: 'name', type: 'text' }],
}
