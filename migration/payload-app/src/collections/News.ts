import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { craftId, slugField } from '../fields/common'
import { complexContentBlocks } from '../blocks/complexContent'
import { previewFor } from '../preview'
import { versions, readPublished } from '../versioned'

// Craft `news` channel (entry type `newsEntry`). Frontend reads: title, slug,
// postDate, newsPhoto, pagePhoto, complexContent.
export const News: CollectionConfig = {
  slug: 'news',
  versions,
  access: { read: readPublished },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'postDate'],
    preview: previewFor('news'), // opens /ostre/news/:slug
  },
  fields: [
    craftId,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'postDate', type: 'date' },
    { name: 'newsPhoto', type: 'upload', relationTo: 'media' },
    { name: 'pagePhoto', type: 'upload', relationTo: 'media' },
    { name: 'intro', type: 'richText', editor: lexicalEditor() },
    { name: 'newsContent', type: 'richText', editor: lexicalEditor() },
    { name: 'newsMediaPosition', type: 'text' },
    { name: 'complexContent', type: 'blocks', blocks: complexContentBlocks },
  ],
}
