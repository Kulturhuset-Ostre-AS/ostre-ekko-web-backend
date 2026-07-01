import type { CollectionConfig } from 'payload'

// Base URL of the public (React Router) frontend. Override per-environment with
// FRONTEND_URL (e.g. https://ekko.no). Defaults to the local dev frontend.
const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

type Doc = Record<string, any>

// Frontend URL prefix per locale. nb is the default (no prefix); en lives under /en.
// Mirrors the frontend routing in app/routes.ts + app/loadContext.ts.
const localePrefix = (locale?: string) => (locale === 'en' ? '/en' : '')

/** Frontend URL for a given collection doc in the given locale, or null when the doc
 * has no public page. */
export function frontendUrl(collection: string, doc: Doc, locale?: string): string | null {
  const slug = doc?.slug
  if (!slug) return null
  const p = `${FRONTEND}${localePrefix(locale)}`
  switch (collection) {
    case 'events':
      // events and festivals share the Events collection, discriminated by entryType.
      return doc.entryType === 'festival' ? `${p}/festival/${slug}` : `${p}/ostre/${slug}`
    case 'news':
      return `${p}/ostre/news/${slug}`
    case 'arena':
      return `${p}/ostre` // arena content renders on the Østre hub
    default:
      return null
  }
}

/** `admin.preview` for a collection. Opens the matching frontend page in the locale
 * currently selected in the editor (nb → /…, en → /en/…). */
export const previewFor =
  (collection: string): NonNullable<CollectionConfig['admin']>['preview'] =>
  (doc, { locale } = {} as { locale?: string }) =>
    frontendUrl(collection, doc as Doc, locale)
