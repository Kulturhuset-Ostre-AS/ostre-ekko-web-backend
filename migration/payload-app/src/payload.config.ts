import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { gcsStorage } from '@payloadcms/storage-gcs'

import { resendAdapter } from '@payloadcms/email-resend'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { Performance } from './collections/Performance'
import { Artists } from './collections/Artists'
import { Events } from './collections/Events'
import { News } from './collections/News'
import { Arena } from './collections/Arena'
import { NavigationNodes } from './collections/NavigationNodes'
import { Users } from './collections/Users'
import { Orders } from './collections/Orders'
import { Members } from './collections/Members'
import { Customers } from './collections/Customers'
import { Tickets } from './collections/Tickets'
import { globals } from './globals'
import { commerceEndpoints } from './commerce/endpoints'
import { ticketEndpoints } from './commerce/ticket-endpoints'
import { reportEndpoints } from './commerce/reports'
import { walletEndpoints } from './commerce/wallet'
import { cardEndpoints } from './commerce/cards'
import { translateEndpoints } from './commerce/translate'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// In the cloud (Cloud Run) the container filesystem is ephemeral, so media must
// live in GCS. Locally (docker/dev) GCS_BUCKET is unset, the plugin is DISABLED
// (`enabled: false`) and Payload keeps using the on-disk staticDir — so nothing
// about the test env changes.
//
// The plugin is ALWAYS present in the config (never conditionally omitted) so the
// admin importMap is identical whether or not GCS_BUCKET is set. Omitting it when
// the bucket is unset used to drop the GcsClientUploadHandler client component from
// the generated importMap, which made the Cloud Run admin render blank (the build
// ran without GCS_BUCKET). `enabled` toggles behaviour without changing the map.
//   GCS_BUCKET               - target bucket (enables uploads to GCS when set)
//   GCS_PROJECT_ID           - GCP project (optional; inferred on GCP)
//   GOOGLE_APPLICATION_CREDENTIALS - key file path (optional; ADC on Cloud Run)
const gcsPlugins = [
  gcsStorage({
    enabled: Boolean(process.env.GCS_BUCKET),
    collections: { media: true },
    bucket: process.env.GCS_BUCKET || 'unused-local-dev',
    options: {
      projectId: process.env.GCS_PROJECT_ID,
      // On Cloud Run, Application Default Credentials are used automatically.
      // Locally you can point GOOGLE_APPLICATION_CREDENTIALS at a key file.
      ...(process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
        : {}),
    },
  }),
]

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  admin: {
    user: Users.slug,
    // Where Payload generates/reads the admin importMap (matches create-payload-app).
    importMap: { baseDir: path.resolve(dirname) },
    components: {
      views: {
        // Salgsrapporter (billetter + medlemskap) — /admin/rapporter.
        salesReports: { Component: '/components/SalesReports', path: '/rapporter' },
      },
      // Personal-lenker i navigasjonen: rapporter, skanner, medlemskort.
      afterNavLinks: ['/components/StaffNavLinks'],
    },
  },
  editor: lexicalEditor(),

  // Mirror Craft's two sites (en, nb). nb (Norwegian Bokmål) is the default.
  localization: {
    locales: ['en', 'nb'],
    defaultLocale: 'nb',
    fallback: true,
  },

  collections: [
    Events,
    News,
    Arena,
    Artists,
    Performance,
    Categories,
    Tags,
    Media,
    NavigationNodes,
    Users,
    Orders,
    Members,
    Customers,
    Tickets,
  ],
  globals,

  // Commerce: membership (checkout, mock payment, status, CSV) + ticket shop
  // (availability, checkout, my-tickets, door scanning) + sales reports +
  // wallet passes (env-gated on Apple/Google credentials).
  endpoints: [...commerceEndpoints, ...ticketEndpoints, ...reportEndpoints, ...walletEndpoints, ...cardEndpoints, ...translateEndpoints],

  // Transactional email (password resets, membership receipts). Without
  // RESEND_API_KEY (local dev) Payload falls back to the console adapter —
  // emails are logged, not sent.
  ...(process.env.RESEND_API_KEY
    ? {
        email: resendAdapter({
          apiKey: process.env.RESEND_API_KEY,
          defaultFromAddress: process.env.EMAIL_FROM || 'medlem@ekko.no',
          defaultFromName: process.env.EMAIL_FROM_NAME || 'Østre / EKKO',
        }),
      }
    : {}),

  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI || 'postgres://payload:payload@localhost:5432/payload' },
  }),

  graphQL: {
    // Exposed at /api/graphql — this is what the frontend will point at.
    schemaOutputFile: path.resolve(dirname, '../generated-schema.graphql'),
  },

  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },

  plugins: [...gcsPlugins],

  // CORS/CSRF so the local React Router frontend (5173/8788) can call the API.
  cors: (process.env.PAYLOAD_CORS || 'http://localhost:5173,http://localhost:8788').split(','),
  csrf: (process.env.PAYLOAD_CORS || 'http://localhost:5173,http://localhost:8788').split(','),

  sharp: (await import('sharp')).default,
})
