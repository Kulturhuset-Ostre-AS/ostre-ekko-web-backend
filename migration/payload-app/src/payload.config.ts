import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

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

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  admin: { user: Users.slug },
  editor: lexicalEditor(),

  // Mirror Craft's two sites (en, nb). en is default.
  localization: {
    locales: ['en', 'nb'],
    defaultLocale: 'en',
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

  // CORS/CSRF so the local React Router frontend (5173/8788) can call the API.
  cors: (process.env.PAYLOAD_CORS || 'http://localhost:5173,http://localhost:8788').split(','),
  csrf: (process.env.PAYLOAD_CORS || 'http://localhost:5173,http://localhost:8788').split(','),

  sharp: (await import('sharp')).default,
})
