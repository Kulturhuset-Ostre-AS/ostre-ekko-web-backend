import type { CollectionConfig } from 'payload'
import { craftId, slugField } from '../fields/common'

// Craft `performance` structure section. Referenced by events.performances and
// artist pages. Frontend reads: title, slug, date, time, timeEnd, location, artist.
export const Performance: CollectionConfig = {
  slug: 'performance',
  access: { read: () => true },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'date'] },
  fields: [
    craftId,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'date', type: 'date' },
    { name: 'time', type: 'text', admin: { description: 'Start time (HH:mm)' } },
    { name: 'timeEnd', type: 'text', admin: { description: 'End time (HH:mm)' } },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'categories',
      filterOptions: { group: { equals: 'locations' } },
      hasMany: true,
    },
    { name: 'artist', type: 'relationship', relationTo: 'artists', hasMany: true },
    // structure tree
    { name: 'order', type: 'number', admin: { position: 'sidebar', readOnly: true } },
    { name: 'parent', type: 'relationship', relationTo: 'performance', admin: { position: 'sidebar' } },
  ],
}
