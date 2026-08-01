import type { CollectionConfig } from 'payload'

// Replaces the Verbb Navigation plugin. Each node is a nav item with an order and
// an optional parent (so the frontend can build the level-1 tree the old
// `navigationNodes(level: 1)` query returned). `nav` groups items into named menus
// (the old global sets / menu handles).
export const NavigationNodes: CollectionConfig = {
  slug: 'navigationNodes',
  access: { read: () => true },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'nav', 'order'], group: 'Navigation' },
  defaultSort: 'order',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'nav',
      type: 'select',
      required: true,
      defaultValue: 'main',
      // Matches the Craft/Verbb nav handles the frontend filters on:
      // toggle = the top site switcher, festival/ostre = section anchor menus,
      // about = Foreningen Ekko (empty in Craft, kept for parity).
      options: ['main', 'festival', 'ostre', 'footer', 'toggle', 'about'],
      admin: { description: 'Which menu this node belongs to' },
    },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'parent', type: 'relationship', relationTo: 'navigationNodes' },
    // Link target: either a manual URL or a reference to an entry.
    { name: 'url', type: 'text', admin: { description: 'Manual URL (overrides reference)' } },
    {
      name: 'reference',
      type: 'relationship',
      relationTo: ['events', 'news', 'artists', 'arena'],
      admin: { description: 'Internal link target' },
    },
    { name: 'newWindow', type: 'checkbox', defaultValue: false },
    // Legacy node-type discriminator (festival_Node, ostre_Node, about_Node, toggle_Node)
    {
      name: 'nodeType',
      type: 'select',
      options: ['default', 'festival', 'ostre', 'about', 'toggle'],
      defaultValue: 'default',
      admin: { position: 'sidebar' },
    },
  ],
}
