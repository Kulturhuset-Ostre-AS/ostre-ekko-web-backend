import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { craftId, slugField } from '../fields/common'
import { complexContentBlocks } from '../blocks/complexContent'
import { previewFor, livePreviewFor } from '../preview'
import { versions, readPublished } from '../versioned'

// Craft `events` channel. Holds two Craft entry types: `event` and `festival`.
// Modeled as one collection with an `entryType` discriminator (frontend reads it as
// `type: typeHandle`). Frontend selections covered: featuredImage(eventFeaturedPhoto),
// date, dateEnd, performances[], location, artist, complexContent, ticket/link fields,
// linkedEvents, linkedFestival.
export const Events: CollectionConfig = {
  slug: 'events',
  versions,
  access: { read: readPublished },
  hooks: {
    // Ticket types without an explicit quantity default to the (first) venue's
    // capacity, resolved at save time so editors see the number on next load.
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const rows = data?.ticketTypes
        if (!Array.isArray(rows) || !rows.some((r) => r && r.quantity == null)) return data
        // Partial updates omit unchanged fields — fall back to the stored doc's location.
        const locSource = data.location ?? originalDoc?.location
        const locId = Array.isArray(locSource) ? locSource[0] : locSource
        if (!locId) return data
        const loc = await req.payload
          .findByID({ collection: 'locations', id: typeof locId === 'object' ? locId.id : locId, depth: 0 })
          .catch(() => null)
        if (loc && typeof loc.capacity === 'number') {
          for (const r of rows) if (r && r.quantity == null) r.quantity = loc.capacity
        }
        return data
      },
    ],
  },
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
    { name: 'translateHelper', type: 'ui', admin: { components: { Field: '/components/TranslateButton' } } },
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
    // Miro-brettet «EKKONETTSIDE» §1–2: strukturert arrangementsinfo.
    // openingTime/closingTime er Crafts felter og vises nå som «Starttid»/«Ferdig»;
    // doorsOpenTime er nytt («Dørene åpner»).
    { name: 'openingTime', type: 'text', label: 'Starttid (HH:mm)' },
    { name: 'closingTime', type: 'text', label: 'Ferdig (HH:mm)' },
    { name: 'doorsOpenTime', type: 'text', label: 'Dørene åpner (HH:mm)' },
    {
      name: 'ageLimit',
      type: 'text',
      localized: true,
      label: 'Aldersgrense',
      admin: { description: 'F.eks. «18 år aldersgrense» eller «Fri aldersgrense»' },
    },
    {
      name: 'practicalInfo',
      type: 'richText',
      editor: lexicalEditor(),
      localized: true,
      label: 'Praktisk info',
      admin: { description: 'F.eks. «Les mer her om tilgjengelighet, vergeordning og ledsagerbillett» (med lenke)' },
    },
    {
      name: 'spilleplan',
      type: 'textarea',
      localized: true,
      label: 'Spilleplan',
      admin: {
        description:
          'Fritekst-spilleplan for kvelden (én linje per sett, f.eks. «23:00 - 00:00  Olav Eggestøl b2b Stine Lundberg»). Vises under Kjøp billetter.',
      },
    },
    {
      // Festival-tidsplanen viser en «Dørene åpner»-rad per scene per dag.
      name: 'doorsOpenByVenue',
      type: 'array',
      labels: { singular: 'Dørene åpner (scene)', plural: 'Dørene åpner per scene/dag' },
      admin: {
        condition: (d) => d.entryType === 'festival',
        description: 'Når dørene åpner per scene og dag — vises øverst i tidsplanen for scenen.',
      },
      fields: [
        { name: 'date', type: 'date' },
        {
          name: 'location',
          type: 'relationship',
          relationTo: 'locations',
        },
        { name: 'time', type: 'text', required: true, admin: { description: 'HH:mm' } },
      ],
    },
    {
      name: 'organizer',
      type: 'relationship',
      relationTo: 'organizers',
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
    },
    { name: 'layout', type: 'text', admin: { description: 'Craft layout variant' } },
    { name: 'intro', type: 'richText', editor: lexicalEditor(), localized: true },
    { name: 'description', type: 'richText', editor: lexicalEditor(), localized: true },
    { name: 'ticketLink', type: 'text' },
    // richText so multi-line ticket tiers (Craft <br>-separated HTML) keep their breaks.
    { name: 'ticketDescription', type: 'richText', editor: lexicalEditor(), localized: true },

    // ---- own ticket shop (phase 2 commerce) ----
    // Ticket types sold through OUR shop (as opposed to ticketLink/tickets which
    // point at TicketCo). Editable inline on both events and festivals. `quantity`
    // left empty defaults to the venue's capacity (beforeChange hook below).
    {
      name: 'ticketTypes',
      type: 'array',
      labels: { singular: 'Billettype', plural: 'Billettyper (egen butikk)' },
      admin: { description: 'Billettyper solgt i egen nettbutikk. Tomt antall = kapasiteten til stedet.' },
      fields: [
        { name: 'name', type: 'text', required: true, localized: true },
        { name: 'priceKr', type: 'number', required: true, admin: { description: 'Pris i kroner' } },
        {
          name: 'quantity',
          type: 'number',
          admin: { description: 'Maks antall. La stå tomt for å bruke stedets kapasitet (fylles ved lagring).' },
        },
        { name: 'onSale', type: 'checkbox', defaultValue: true, label: 'Til salgs' },
      ],
    },
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
        // Miro-brettet §3: billettsiden grupperes i tre nedtrekk, og praktisk
        // info flyttes ut av fritekst og inn i egne felter for lesbarhet.
        {
          name: 'category',
          type: 'select',
          label: 'Kategori',
          options: [
            { label: 'Festivalpass', value: 'festivalpass' },
            { label: 'Dagspass', value: 'dagspass' },
            { label: 'Enkeltbillett', value: 'enkeltbillett' },
          ],
          admin: { description: 'Grupperer billetten i nedtrekksmenyen på billettsiden.' },
        },
        { name: 'validFor', type: 'text', label: 'Gyldig for', admin: { description: 'F.eks. «31.10 - 2.11.2026»' } },
        { name: 'ticketAgeLimit', type: 'text', label: 'Aldersgrense', admin: { description: 'F.eks. «18 års aldersgrense» / «Fri aldersgrense»' } },
        { name: 'guardianInfo', type: 'text', label: 'Vergeordning', admin: { description: 'F.eks. «Ta kontakt med info@ekko.no»' } },
        { name: 'accessibilityInfo', type: 'text', label: 'Tilgjengelighet', admin: { description: 'F.eks. «Les mer her om tilgjengelighet»' } },
        { name: 'practicalInfo', type: 'text', label: 'Praktisk info', admin: { description: 'F.eks. «Festivalarmbånd kan hentes på Østre alle festivaldager fra 14:00 - 16:00»' } },
      ],
    },
    {
      // Miro-brettet §4: arkivet lenker videre til tidligere års fanziner —
      // klikk på et arkivår åpner bildevisning av årets Ekko-fanzine.
      name: 'fanzine',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: 'Fanzine (oppslag)',
      admin: {
        condition: (d) => d.entryType === 'festival',
        description: 'Bilder/oppslag fra årets fanzine — vises i arkivet.',
      },
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
