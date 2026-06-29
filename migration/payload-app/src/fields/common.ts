import type { Field } from 'payload'

// Every migrated doc keeps the originating Craft element id so relationships can be
// resolved during import and so the frontend can map legacy URLs if needed.
export const craftId: Field = {
  name: 'craftId',
  type: 'number',
  index: true,
  admin: { readOnly: true, position: 'sidebar', description: 'Original Craft element id' },
}

export const slugField: Field = {
  name: 'slug',
  type: 'text',
  index: true,
  required: true,
  admin: { position: 'sidebar' },
}

// Structure sections (artists, performance) carry tree order + parent link.
export const structureFields: Field[] = [
  { name: 'order', type: 'number', admin: { position: 'sidebar', readOnly: true } },
  {
    name: 'parent',
    type: 'relationship',
    relationTo: 'performance',
    admin: { position: 'sidebar' },
  },
]
