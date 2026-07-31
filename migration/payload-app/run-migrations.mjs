// Companion to create-migration.mjs (same tsx-fork workaround): run pending
// migrations via the local API.  npx tsx run-migrations.mjs
import { getPayload } from 'payload'
import config from './src/payload.config.ts'

const payload = await getPayload({ config })
await payload.db.migrate()
process.exit(0)
