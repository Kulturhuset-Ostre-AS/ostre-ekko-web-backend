import type { CollectionConfig } from 'payload'
import { craftId, slugField } from '../fields/common'

// Steder/lokaler — skilt ut fra den Craft-arvede `categories`-collectionen
// (2026-08-04). Steder er driftsdata: venue/rom/kapasitet, der kapasiteten er
// standard maks antall billetter i billettbutikken (Events.ticketTypes-hooken).
// Id-ene er bevart fra `categories`, så alle relasjoner overlevde splitten
// (migrasjon 20260804_categories_split).
export const Locations: CollectionConfig = {
  slug: 'locations',
  access: { read: () => true },
  labels: { singular: 'Sted', plural: 'Steder' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'venue', 'room', 'capacity'] },
  fields: [
    craftId,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'fullTitle', type: 'text', localized: true },
    { name: 'venue', type: 'text' },
    { name: 'room', type: 'text' },
    {
      name: 'capacity',
      type: 'number',
      admin: { description: 'Kapasitet — brukes som default maks antall billetter' },
    },
  ],
}
