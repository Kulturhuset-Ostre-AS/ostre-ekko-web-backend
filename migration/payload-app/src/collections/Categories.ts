import type { CollectionConfig } from 'payload'
import { craftId, slugField } from '../fields/common'

// Craft category groups `locationsCategory` + `organizersCategory` -> one
// `categories` collection discriminated by `group`. Location-specific fields
// (fullTitle/venue/room) live here too, matching the frontend's
// `... on locationsCategory_Category { fullTitle venue room }` selections.
export const Categories: CollectionConfig = {
  slug: 'categories',
  access: { read: () => true },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'group'] },
  fields: [
    craftId,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    {
      name: 'group',
      type: 'select',
      required: true,
      options: ['locations', 'organizers'],
    },
    // Location-only fields (shown when group = locations).
    {
      name: 'fullTitle',
      type: 'text',
      localized: true,
      admin: { condition: (d) => d.group === 'locations' },
    },
    { name: 'venue', type: 'text', admin: { condition: (d) => d.group === 'locations' } },
    { name: 'room', type: 'text', admin: { condition: (d) => d.group === 'locations' } },
    // Venue capacity — the default max ticket count for ticket types on events
    // held here (see Events.ticketTypes hook).
    {
      name: 'capacity',
      type: 'number',
      admin: { condition: (d) => d.group === 'locations', description: 'Kapasitet — brukes som default maks antall billetter' },
    },
  ],
}
