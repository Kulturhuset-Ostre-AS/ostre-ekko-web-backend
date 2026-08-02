import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { craftId, slugField } from '../fields/common'
import { complexContentBlocks } from '../blocks/complexContent'
import { previewFor } from '../preview'
import { versions, readPublished } from '../versioned'

// Craft `arena` channel. Frontend reads: title, id, complexContent (incl. video
// blocks) and related artists.
export const Arena: CollectionConfig = {
  slug: 'arena',
  versions,
  access: { read: readPublished },
  admin: { useAsTitle: 'title', preview: previewFor('arena') },
  fields: [
    craftId,
    { name: 'translateHelper', type: 'ui', admin: { components: { Field: '/components/TranslateButton' } } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'artistName', type: 'text' },
    { name: 'projectTitle', type: 'text', localized: true },
    { name: 'videoUrl', type: 'text' },
    { name: 'pageContent', type: 'richText', editor: lexicalEditor(), localized: true },
    { name: 'artist', type: 'relationship', relationTo: 'artists', hasMany: true },
    { name: 'complexContent', type: 'blocks', blocks: complexContentBlocks },
  ],
}
