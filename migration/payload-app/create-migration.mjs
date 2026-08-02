// Workaround for `payload migrate:create` failing under the payload bin's tsx
// fork (ENOENT node:crypto?tsx-namespace) — call createMigration via the local
// API instead. Run with:  npx tsx create-migration.mjs <name>
import { getPayload } from 'payload'
import config from './src/payload.config.ts'

const name = process.argv[2] || 'migration'
const payload = await getPayload({ config })
await payload.db.createMigration({ migrationName: name, payload, forceAcceptWarning: true })
process.exit(0)
