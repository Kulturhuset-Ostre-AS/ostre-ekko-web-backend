import type { CollectionConfig } from 'payload'

// Public customer accounts (ticket + membership buyers) — SEPARATE from the
// admin `users` collection. Payload auto-provides /api/customers/login, logout,
// me, forgot-password etc. Registration is open (public create); customers can
// read/update only themselves. framtid.ekko.no ↔ admin.ekko.no are same-site
// (same eTLD+1), so the default Lax auth cookie works cross-subdomain.
export const Customers: CollectionConfig = {
  slug: 'customers',
  auth: {
    tokenExpiration: 60 * 60 * 24 * 14, // 14 days
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    group: 'Medlemskap',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'createdAt'],
    description: 'Kundekontoer (billett-/medlemskjøp på nettsiden). Ikke admin-brukere.',
  },
  access: {
    create: () => true, // open registration
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection !== 'customers') return true // admin users see all
      return { id: { equals: req.user.id } }
    },
    update: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection !== 'customers') return true
      return { id: { equals: req.user.id } }
    },
    delete: ({ req }) => Boolean(req.user && req.user.collection !== 'customers'),
  },
  fields: [{ name: 'name', type: 'text' }],
}
