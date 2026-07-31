import type { GlobalConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

// Membership product config. Public read: the /medlemskap page loads prices and
// page text from here. Season windows are code-side (src/commerce/seasons.ts);
// this holds what editors should control: prices, text, and the master switch.
export const MembershipConfig: GlobalConfig = {
  slug: 'membership-config',
  label: 'Medlemskap – oppsett',
  admin: { group: 'Medlemskap' },
  access: { read: () => true },
  fields: [
    {
      name: 'salesOpen',
      type: 'checkbox',
      defaultValue: false,
      label: 'Salg åpent',
      admin: { description: 'Hovedbryter for nettsalg av medlemskap' },
    },
    { name: 'priceOrdinary', type: 'number', required: true, defaultValue: 300, label: 'Pris ordinær (kr/halvår)' },
    { name: 'priceStudent', type: 'number', required: true, defaultValue: 200, label: 'Pris student (kr/halvår)' },
    { name: 'title', type: 'text', localized: true },
    // Page copy — source text lives in the client doc «Oppsett nettside medlemskap».
    { name: 'pageContent', type: 'richText', editor: lexicalEditor(), localized: true },
  ],
}
