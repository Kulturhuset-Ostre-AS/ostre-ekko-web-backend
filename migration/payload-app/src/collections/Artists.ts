import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { craftId, slugField } from '../fields/common'
import { complexContentBlocks } from '../blocks/complexContent'
import { versions, readPublished } from '../versioned'

// Craft `artists` structure section. Frontend reads: title, slug, artistName,
// artistFeaturedPhoto (as featuredImage), performances, complexContent blocks.
export const Artists: CollectionConfig = {
  slug: 'artists',
  versions,
  access: { read: readPublished },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'artistName'] },
  fields: [
    craftId,
    { name: 'translateHelper', type: 'ui', admin: { components: { Field: '/components/TranslateButton' } } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'artistName', type: 'text' },
    { name: 'artistMeta', type: 'text', admin: { description: 'Label / country' } },
    { name: 'shortTitle', type: 'text', localized: true },
    { name: 'artistFeaturedPhoto', type: 'upload', relationTo: 'media' },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'bio', type: 'richText', editor: lexicalEditor(), localized: true },
    { name: 'openingTimes', type: 'text' },
    { name: 'isFeatured', type: 'checkbox' },
    { name: 'isVisible', type: 'checkbox', defaultValue: true },
    { name: 'hideMoreLink', type: 'checkbox' },
    {
      name: 'performance',
      type: 'relationship',
      relationTo: 'performance',
      hasMany: true,
    },
    { name: 'complexContent', type: 'blocks', blocks: complexContentBlocks },
    // structure tree
    { name: 'order', type: 'number', admin: { position: 'sidebar', readOnly: true } },
    { name: 'parent', type: 'relationship', relationTo: 'artists', admin: { position: 'sidebar' } },
  ],
}
