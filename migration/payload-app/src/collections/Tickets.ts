import type { CollectionConfig } from 'payload'
import { qrPayloadFor } from '../commerce/qr'

// One doc per issued ticket. Created by fulfilment when a ticket order is paid.
// The QR payload (code + HMAC signature) is derived, never stored — afterRead
// adds it for the owner/admin. Customers see only their own tickets.
export const Tickets: CollectionConfig = {
  slug: 'tickets',
  admin: {
    group: 'Medlemskap',
    useAsTitle: 'ticketCode',
    defaultColumns: ['ticketCode', 'event', 'typeName', 'status', 'customer'],
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection !== 'customers') return true // admin
      return { customer: { equals: req.user.id } }
    },
    create: ({ req }) => Boolean(req.user && req.user.collection !== 'customers'),
    update: ({ req }) => Boolean(req.user && req.user.collection !== 'customers'),
    delete: ({ req }) => Boolean(req.user && req.user.collection !== 'customers'),
  },
  timestamps: true,
  fields: [
    { name: 'ticketCode', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    // Derived, never stored: signed QR content (code + HMAC). Same payload a
    // future Apple Wallet pass will carry.
    {
      name: 'qrPayload',
      type: 'text',
      virtual: true,
      admin: { readOnly: true },
      hooks: {
        afterRead: [({ siblingData }) => (siblingData?.ticketCode ? qrPayloadFor(siblingData.ticketCode) : null)],
      },
    },
    { name: 'event', type: 'relationship', relationTo: 'events', required: true, index: true },
    // Snapshot of the purchased ticket type (array-row id + label + price at purchase).
    { name: 'typeId', type: 'text', index: true },
    { name: 'typeName', type: 'text' },
    { name: 'priceOre', type: 'number' },
    { name: 'status', type: 'select', required: true, defaultValue: 'valid', options: ['valid', 'used', 'refunded'] },
    { name: 'usedAt', type: 'date', admin: { readOnly: true } },
    { name: 'order', type: 'relationship', relationTo: 'orders', index: true },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true },
  ],
}
