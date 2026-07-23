import type { CollectionConfig } from 'payload'

// Base URL of the public (React Router) frontend. Override per-environment with
// FRONTEND_URL (e.g. https://ekko.no). Defaults to the local dev frontend.
const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

// Shared secret that lets the frontend's loaders read drafts (see versioned.ts).
// Appended to Preview/Live-Preview URLs so the frontend knows the request comes
// from the admin and fetches draft content instead of the published version.
const PREVIEW_SECRET = process.env.PREVIEW_SECRET || ''
const withPreview = (url: string | null) =>
  url && PREVIEW_SECRET ? `${url}${url.includes('?') ? '&' : '?'}preview=${encodeURIComponent(PREVIEW_SECRET)}` : url

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
  (doc, options) =>
    withPreview(frontendUrl(collection, doc as Doc, (options as { locale?: string })?.locale))

/** `admin.livePreview.url` for a collection. Same target as the Preview button, but
 * the frontend route detects the live-preview iframe and subscribes to draft updates
 * via @payloadcms/live-preview-react. Returns the frontend base when the doc has no
 * slug yet (new, unsaved docs) so the iframe still loads. */
export const livePreviewFor =
  (collection: string) =>
  ({ data, locale }: { data: Doc; locale?: string | { code?: string } }) => {
    const localeCode = typeof locale === 'string' ? locale : locale?.code
    const url = frontendUrl(collection, data, localeCode) ?? `${FRONTEND}${localePrefix(localeCode)}`
    return withPreview(url) as string
  }
