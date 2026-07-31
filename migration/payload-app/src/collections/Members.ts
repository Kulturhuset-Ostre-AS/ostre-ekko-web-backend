import type { CollectionConfig } from 'payload'
import { nextMemberId } from '../commerce/fulfil'

// Membership register (GDPR: personal data — admin-only API access; no public
// read). Active/expired is DERIVED from validUntil (afterRead hook adds
// `active`), never stored, so there is no cron to keep it fresh. Door sales =
// staff creating members manually in the admin (source: door).
export const Members: CollectionConfig = {
  slug: 'members',
  admin: {
    group: 'Medlemskap',
    useAsTitle: 'email',
    defaultColumns: ['memberId', 'name', 'email', 'membershipType', 'validUntil', 'cardPickedUp'],
    description:
      'Aktiv = gyldig-til-dato frem i tid. Dørsalg: opprett medlem her manuelt (kilde: door). CSV-eksport: /api/commerce/members/export.csv (innlogget).',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  timestamps: true,
  hooks: {
    // Door sales: staff create members in the admin without a memberId — generate
    // one here so web (fulfilment) and door share the same sequence.
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' && !data.memberId) {
          data.memberId = await nextMemberId(req.payload, new Date().getFullYear())
        }
        return data
      },
    ],
  },
  fields: [
    // Derived, never stored: aktiv = gyldig-til-dato frem i tid.
    {
      name: 'active',
      type: 'checkbox',
      virtual: true,
      admin: { readOnly: true, description: 'Beregnet fra gyldig-til' },
      hooks: {
        afterRead: [({ siblingData }) => Boolean(siblingData?.validUntil && new Date(siblingData.validUntil) >= new Date())],
      },
    },
    // EKKO-<år>-<løpenr>, generated at creation by the fulfilment code / a
    // beforeChange hook for manual door-sale creation in the admin.
    { name: 'memberId', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    { name: 'name', type: 'text', required: true },
    // Unique: the renewal key — buying again with the same email extends this doc.
    { name: 'email', type: 'text', required: true, unique: true, index: true },
    { name: 'address', type: 'text' },
    { name: 'postalCode', type: 'text' },
    { name: 'city', type: 'text' },
    { name: 'birthYear', type: 'number' },
    { name: 'membershipType', type: 'select', required: true, defaultValue: 'ordinary', options: ['ordinary', 'student'] },
    { name: 'validUntil', type: 'date', required: true, admin: { description: 'Sesongslutt (30/6 eller 31/12)' } },
    { name: 'cardPickedUp', type: 'checkbox', defaultValue: false, label: 'Medlemsbevis hentet' },
    { name: 'source', type: 'select', required: true, defaultValue: 'door', options: ['web', 'door'] },
    { name: 'consentNewsletter', type: 'checkbox', defaultValue: false },
    // Purchase/renewal history: all orders pointing at this member.
    { name: 'orders', type: 'join', collection: 'orders', on: 'member' },
  ],
}
