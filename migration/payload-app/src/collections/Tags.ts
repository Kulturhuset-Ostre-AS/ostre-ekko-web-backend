import type { CollectionConfig } from 'payload'
import { craftId, slugField } from '../fields/common'

// Craft `projectTag` tag group -> simple tags collection.
export const Tags: CollectionConfig = {
  slug: 'tags',
  access: { read: () => true },
  admin: { useAsTitle: 'title' },
  fields: [
    craftId,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
  ],
}
