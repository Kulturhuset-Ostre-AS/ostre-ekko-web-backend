import type { CollectionConfig } from 'payload'

// Base URL of the public (React Router) frontend. Override per-environment with
// FRONTEND_URL (e.g. https://ekko.no). Defaults to the local dev frontend.
const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

type Doc = Record<string, any>

/** Frontend URL for a given collection doc, or null when it has no public page. */
export function frontendUrl(collection: string, doc: Doc): string | null {
  const slug = doc?.slug
  if (!slug) return null
  switch (collection) {
    case 'events':
      // events and festivals share the Events collection, discriminated by entryType.
      return doc.entryType === 'festival' ? `${FRONTEND}/festival/${slug}` : `${FRONTEND}/ostre/${slug}`
    case 'news':
      return `${FRONTEND}/ostre/news/${slug}`
    case 'arena':
      return `${FRONTEND}/ostre` // arena content renders on the Østre hub
    default:
      return null
  }
}

/** `admin.preview` function for a collection. Opens the matching frontend page. */
export const previewFor =
  (collection: string): NonNullable<CollectionConfig['admin']>['preview'] =>
  (doc) =>
    frontendUrl(collection, doc as Doc)
