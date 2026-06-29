import type { CollectionConfig } from 'payload'
import { craftId, slugField } from '../fields/common'
import { complexContentBlocks } from '../blocks/complexContent'

// Craft `arena` channel. Frontend reads: title, id, complexContent (incl. video
// blocks) and related artists.
export const Arena: CollectionConfig = {
  slug: 'arena',
  access: { read: () => true },
  admin: { useAsTitle: 'title' },
  fields: [
    craftId,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'artist', type: 'relationship', relationTo: 'artists', hasMany: true },
    { name: 'complexContent', type: 'blocks', blocks: complexContentBlocks },
  ],
}
