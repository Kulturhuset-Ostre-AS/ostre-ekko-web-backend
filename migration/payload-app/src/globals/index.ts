import type { GlobalConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { complexContentBlocks } from '../blocks/complexContent'

// Craft singles -> Payload globals. The frontend's contentPage.ts queried these via
// entry(slug: "<handle>"); each becomes a global with the same handle/slug so the
// rewrite maps 1:1.

const pageSectionsBlocks = [
  ...complexContentBlocks,
  // `entry_Entry` page-section block used by contentPage/festival `sections` matrix.
  {
    slug: 'entry',
    labels: { singular: 'Section', plural: 'Sections' },
    fields: [
      { name: 'heading', type: 'text', localized: true },
      { name: 'body', type: 'richText', editor: lexicalEditor() },
      { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    ],
  },
]

const richContentGlobal = (slug: string, label: string): GlobalConfig => ({
  slug,
  label,
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', localized: true },
    { name: 'craftId', type: 'number', admin: { position: 'sidebar', readOnly: true } },
    { name: 'pageContent', type: 'richText', editor: lexicalEditor() },
    { name: 'sections', type: 'blocks', blocks: pageSectionsBlocks as any },
    { name: 'gallery', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'contact', type: 'richText', editor: lexicalEditor() },
    { name: 'linkedFestival', type: 'relationship', relationTo: 'events', hasMany: true },
  ],
})

const simpleGlobal = (slug: string, label: string): GlobalConfig => ({
  slug,
  label,
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', localized: true },
    { name: 'craftId', type: 'number', admin: { position: 'sidebar', readOnly: true } },
    { name: 'pageContent', type: 'richText', editor: lexicalEditor() },
    { name: 'pagePhoto', type: 'upload', relationTo: 'media' },
  ],
})

export const Homepage = richContentGlobal('homepage', 'Homepage')
export const Oestre = richContentGlobal('oestre', 'Østre')
export const EkkoFestivalInfo = richContentGlobal('ekko_festival_info', 'EKKO Festival Info')
export const About = simpleGlobal('about', 'About')
export const Legal = simpleGlobal('legal', 'Legal')
export const Archive = simpleGlobal('archive', 'Archive')

// Craft globalInfo global set (site-wide info used by the nav/footer).
export const GlobalInfo: GlobalConfig = {
  slug: 'globalInfo',
  label: 'Global Info',
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', localized: true },
    { name: 'contact', type: 'richText', editor: lexicalEditor() },
    { name: 'footer', type: 'richText', editor: lexicalEditor() },
    // Social links (Craft globalInfo_GlobalSet)
    { name: 'socialFacebook', type: 'text' },
    { name: 'socialInstagram', type: 'text' },
    { name: 'socialTwitter', type: 'text' },
  ],
}

export const globals: GlobalConfig[] = [
  Homepage,
  Oestre,
  EkkoFestivalInfo,
  About,
  Legal,
  Archive,
  GlobalInfo,
]
