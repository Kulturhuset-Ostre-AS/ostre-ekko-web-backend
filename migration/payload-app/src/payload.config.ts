import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { gcsStorage } from '@payloadcms/storage-gcs'

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
import { globals } from './globals'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// In the cloud (Cloud Run) the container filesystem is ephemeral, so media must
// live in GCS. Locally (docker/dev) GCS_BUCKET is unset and Payload keeps using
// the on-disk staticDir, so nothing about the test env changes.
//   GCS_BUCKET               - target bucket (enables the plugin when set)
//   GCS_PROJECT_ID           - GCP project (optional; inferred on GCP)
//   GOOGLE_APPLICATION_CREDENTIALS - key file path (optional; ADC on Cloud Run)
const gcsPlugins = process.env.GCS_BUCKET
  ? [
      gcsStorage({
        collections: { media: true },
        bucket: process.env.GCS_BUCKET,
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
  : []

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  admin: {
    user: Users.slug,
    // Where Payload generates/reads the admin importMap (matches create-payload-app).
    importMap: { baseDir: path.resolve(dirname) },
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
  ],
  globals,

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
