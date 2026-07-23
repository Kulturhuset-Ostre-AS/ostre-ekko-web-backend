import type { Access, CollectionConfig } from 'payload'

// Shared config for the five versioned content collections (Events, News,
// Arena, Artists, Performance). Mirrors the Craft workflow: Save = draft,
// Publish = live. Autosave keeps Live Preview updating near-keystroke.
export const versions: CollectionConfig['versions'] = {
  drafts: { autosave: true },
  maxPerDoc: 20,
}

// With drafts enabled this is mandatory: anonymous (frontend) reads must only
// see published docs, while logged-in admin users see drafts too. The frontend's
// preview loaders authenticate with the shared PREVIEW_SECRET header (the admin
// Preview/Live-Preview URLs carry it — see preview.ts) so they can render drafts.
export const readPublished: Access = ({ req }) => {
  if (req.user) return true
  const secret = process.env.PREVIEW_SECRET
  if (secret && req.headers.get('x-preview-secret') === secret) return true
  return { _status: { equals: 'published' } }
}
