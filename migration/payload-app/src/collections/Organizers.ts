import type { CollectionConfig } from 'payload'
import { craftId, slugField } from '../fields/common'

// Arrangører — skilt ut fra den Craft-arvede `categories`-collectionen
// (2026-08-04). Kun navn (vises som «X presenterer:» på arrangementssidene).
// Id-ene er bevart fra `categories` (migrasjon 20260804_categories_split).
export const Organizers: CollectionConfig = {
  slug: 'organizers',
  access: { read: () => true },
  labels: { singular: 'Arrangør', plural: 'Arrangører' },
  admin: { useAsTitle: 'title', defaultColumns: ['title'] },
  fields: [
    craftId,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
  ],
}
