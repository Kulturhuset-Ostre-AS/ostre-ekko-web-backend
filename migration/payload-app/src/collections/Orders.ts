import type { CollectionConfig } from 'payload'

// Commerce orders. Generic by design (type discriminates) so phase 2 (tickets)
// reuses the same collection. Created by the checkout endpoints via the local
// API (which bypasses access control); the REST/GraphQL surface is admin-only.
export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    group: 'Medlemskap',
    useAsTitle: 'providerRef',
    defaultColumns: ['providerRef', 'type', 'status', 'amountOre', 'buyerEmail', 'createdAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  timestamps: true,
  fields: [
    { name: 'type', type: 'select', required: true, defaultValue: 'membership', options: ['membership', 'ticket'] },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'paid', 'failed', 'refunded'],
      admin: { description: 'pending → paid/failed; refunded settes manuelt etter refusjon i betalingsportalen' },
    },
    // Amount in øre (NOK) — matches what Vipps expects, avoids float kroner.
    { name: 'amountOre', type: 'number', required: true },
    { name: 'currency', type: 'text', required: true, defaultValue: 'NOK' },
    { name: 'provider', type: 'select', required: true, options: ['mock', 'vipps', 'door'] },
    // Provider payment reference — unique: doubles as the webhook idempotency key.
    { name: 'providerRef', type: 'text', unique: true, index: true },
    {
      // Bokføringsforskriften § 5-1-1: salgsdokument skal ha maskinelt tildelt,
      // fortløpende nummer. Tildeles fra receipt_number_seq ved FULLFØRT
      // betaling (fulfil.ts) — aldri manuelt.
      name: 'receiptNumber',
      type: 'number',
      index: true,
      admin: { readOnly: true, description: 'Kvitteringsnummer — tildeles automatisk ved betaling' },
    },
    { name: 'membershipType', type: 'select', options: ['ordinary', 'student'] },
    { name: 'season', type: 'text', admin: { description: 'F.eks. 2027-var' } },
    // Buyer snapshot at purchase time (the member doc may be updated later).
    { name: 'buyerName', type: 'text', required: true },
    { name: 'buyerEmail', type: 'text', required: true, index: true },
    { name: 'buyerAddress', type: 'text' },
    { name: 'buyerPostalCode', type: 'text' },
    { name: 'buyerCity', type: 'text' },
    { name: 'buyerBirthYear', type: 'number' },
    { name: 'consentNewsletter', type: 'checkbox', defaultValue: false },
    { name: 'member', type: 'relationship', relationTo: 'members', index: true },
    // ---- ticket orders ----
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true },
    { name: 'event', type: 'relationship', relationTo: 'events', index: true },
    {
      name: 'items',
      type: 'array',
      admin: { description: 'Ordrelinjer (billettkjøp): billettype-rad + antall + stykkpris ved kjøp' },
      fields: [
        { name: 'typeId', type: 'text', required: true },
        { name: 'name', type: 'text' },
        { name: 'unitPriceOre', type: 'number', required: true },
        { name: 'quantity', type: 'number', required: true },
      ],
    },
    // Raw provider events (webhook payloads / mock completions) for debugging.
    { name: 'rawEvents', type: 'json' },
  ],
}
