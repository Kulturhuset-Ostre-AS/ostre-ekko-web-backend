import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { craftId, slugField } from '../fields/common'
import { complexContentBlocks } from '../blocks/complexContent'

// Craft `news` channel (entry type `newsEntry`). Frontend reads: title, slug,
// postDate, newsPhoto, pagePhoto, complexContent.
export const News: CollectionConfig = {
  slug: 'news',
  access: { read: () => true },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'postDate'] },
  fields: [
    craftId,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'postDate', type: 'date' },
    { name: 'newsPhoto', type: 'upload', relationTo: 'media' },
    { name: 'pagePhoto', type: 'upload', relationTo: 'media' },
    { name: 'intro', type: 'richText', editor: lexicalEditor() },
    { name: 'complexContent', type: 'blocks', blocks: complexContentBlocks },
  ],
}
