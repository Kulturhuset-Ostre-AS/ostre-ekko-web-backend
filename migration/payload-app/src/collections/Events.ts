import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { craftId, slugField } from '../fields/common'
import { complexContentBlocks } from '../blocks/complexContent'
import { previewFor, livePreviewFor } from '../preview'

// Craft `events` channel. Holds two Craft entry types: `event` and `festival`.
// Modeled as one collection with an `entryType` discriminator (frontend reads it as
// `type: typeHandle`). Frontend selections covered: featuredImage(eventFeaturedPhoto),
// date, dateEnd, performances[], location, artist, complexContent, ticket/link fields,
// linkedEvents, linkedFestival.
export const Events: CollectionConfig = {
  slug: 'events',
  access: { read: () => true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'entryType', 'date'],
    preview: previewFor('events'), // opens /ostre/:slug or /festival/:slug in the frontend
    // Live Preview: renders the frontend in an in-editor iframe that updates as you
    // type. Same target URLs as the Preview button; the frontend route subscribes to
    // the draft via @payloadcms/live-preview-react. Enabled for festivals/events.
    livePreview: {
      url: livePreviewFor('events'),
      breakpoints: [
        { name: 'mobile', label: 'Mobile', width: 375, height: 667 },
        { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { name: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      ],
    },
  },
  fields: [
    craftId,
    {
      name: 'entryType',
      type: 'select',
      required: true,
      defaultValue: 'event',
      options: ['event', 'festival'],
      admin: { position: 'sidebar', description: 'Craft typeHandle' },
    },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'eventFeaturedPhoto', type: 'upload', relationTo: 'media', label: 'Featured photo' },
    { name: 'date', type: 'date' },
    { name: 'dateEnd', type: 'date' },
    { name: 'isMultiDay', type: 'checkbox' },
    { name: 'singlePage', type: 'checkbox' },
    { name: 'showArtistInfo', type: 'checkbox' },
    { name: 'openingTime', type: 'text' },
    { name: 'closingTime', type: 'text' },
    {
      name: 'organizer',
      type: 'relationship',
      relationTo: 'categories',
      filterOptions: { group: { equals: 'organizers' } },
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'categories',
      filterOptions: { group: { equals: 'locations' } },
      hasMany: true,
    },
    { name: 'layout', type: 'text', admin: { description: 'Craft layout variant' } },
    { name: 'intro', type: 'richText', editor: lexicalEditor() },
    { name: 'description', type: 'richText', editor: lexicalEditor() },
    { name: 'ticketLink', type: 'text' },
    // richText so multi-line ticket tiers (Craft <br>-separated HTML) keep their breaks.
    { name: 'ticketDescription', type: 'richText', editor: lexicalEditor() },
    { name: 'performances', type: 'relationship', relationTo: 'performance', hasMany: true },
    // festival-type cross links
    { name: 'linkedEvents', type: 'relationship', relationTo: 'events', hasMany: true },
    { name: 'linkedFestival', type: 'relationship', relationTo: 'events', hasMany: true },
    { name: 'gallery', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'complexContent', type: 'blocks', blocks: complexContentBlocks },

    // ---- festival-type extras (Craft festival_Entry) ----
    // Festival theming / "skin" colours (Craft Color + Lightswitch fields).
    { name: 'festivalColor', type: 'text', admin: { condition: (d) => d.entryType === 'festival', description: 'Festival background colour (hex, e.g. #ff743c)' } },
    { name: 'festivalSectionBgColor', type: 'text', admin: { condition: (d) => d.entryType === 'festival', description: 'Section background colour (hex)' } },
    { name: 'festivalSectionTextColor', type: 'text', admin: { condition: (d) => d.entryType === 'festival', description: 'Section text colour (hex)' } },
    { name: 'darkMode', type: 'checkbox', admin: { condition: (d) => d.entryType === 'festival', description: 'Dark mode' } },
    { name: 'festivalLinkInvert', type: 'checkbox', admin: { condition: (d) => d.entryType === 'festival', description: 'Invert link colour' } },
    { name: 'lineup', type: 'textarea', admin: { condition: (d) => d.entryType === 'festival' } },
    {
      name: 'festivalSectionGraphicElements',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: { condition: (d) => d.entryType === 'festival' },
    },
    { name: 'linkednews', type: 'relationship', relationTo: 'news', hasMany: true },
    {
      name: 'program',
      type: 'array',
      labels: { singular: 'Day', plural: 'Program (days)' },
      admin: { condition: (d) => d.entryType === 'festival' },
      fields: [
        { name: 'date', type: 'date' },
        { name: 'startTime', type: 'text' },
        { name: 'endTime', type: 'text' },
        { name: 'ticketInformation', type: 'textarea' },
      ],
    },
    {
      name: 'tickets',
      type: 'array',
      admin: { condition: (d) => d.entryType === 'festival' },
      fields: [
        { name: 'description', type: 'text' },
        { name: 'subdescription', type: 'text' },
        { name: 'price', type: 'text' },
        { name: 'ticketLink', type: 'text' },
        { name: 'textContent', type: 'textarea' },
        { name: 'relatedPerformances', type: 'relationship', relationTo: 'performance', hasMany: true },
      ],
    },
    {
      name: 'sections',
      type: 'array',
      admin: { condition: (d) => d.entryType === 'festival' },
      fields: [
        { name: 'sectionTitle', type: 'text', localized: true },
        { name: 'sectionBody', type: 'richText', editor: lexicalEditor() },
        { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
      ],
    },
  ],
}
