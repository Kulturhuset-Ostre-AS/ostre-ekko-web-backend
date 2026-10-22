// Reset migrated CONTENT so the import can be re-run cleanly, WITHOUT re-transferring
// assets. Truncates the content collection tables (events/news/arena/artists/
// performance/locations/organizers) and clears the content half of data/sql/id-map.json.
//
// KEEPS: media (+ its files on the volume), users, and data/sql/asset-map.json — so a
// re-import reuses the already-uploaded assets. To also wipe media, pass --with-media.
//
// Only needed for a RE-run; a first import into an empty DB doesn't need this.
// Run: node scripts/sql-reset.mjs [--with-media]
//
// Cloud: `--cloud` runs psql in a throwaway postgres container against a
// cloud-sql-proxy on the host, using PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD
// from the environment (scripts/reimport-cloud.sh sets these). Both --cloud and
// PGHOST are required, so a stray env var can't send a TRUNCATE to the cloud.
// --with-media is refused in cloud mode (media files live in GCS).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL = path.resolve(__dirname, '..', 'data', 'sql')
const COMPOSE = path.resolve(__dirname, '..', 'docker', 'docker-compose.payload.yml')
const withMedia = process.argv.includes('--with-media')
const cloud = process.argv.includes('--cloud')

if (cloud !== Boolean(process.env.PGHOST)) {
  console.error(cloud ? '--cloud needs PGHOST (cloud-sql-proxy) in the environment' : 'PGHOST is set — pass --cloud to reset the cloud DB')
  process.exit(2)
}
if (cloud && withMedia) {
  console.error('--with-media is not supported with --cloud (media files live in GCS)')
  process.exit(2)
}

const CONTENT_TABLES = ['events', 'news', 'arena', 'artists', 'performance', 'locations', 'organizers']
const CONTENT_IDMAP_KEYS = [...CONTENT_TABLES]
const tables = withMedia ? [...CONTENT_TABLES, 'media'] : CONTENT_TABLES

function psql(sql) {
  const args = cloud
    ? ['run', '--rm', ...['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGPASSWORD'].flatMap((k) => ['-e', k]),
        'postgres:16-alpine', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', sql]
    : ['compose', '-f', COMPOSE, 'exec', '-T', 'postgres', 'psql', '-U', 'payload', '-d', 'payload', '-c', sql]
  return execFileSync('docker', args, { encoding: 'utf8' })
}

console.log(`Resetting content tables${cloud ? ` in CLOUD (${process.env.PGHOST}:${process.env.PGPORT})` : ''}: ${tables.join(', ')}`)
// CASCADE clears the collections' own locale/array/block/rels subtables. This does NOT
// touch media unless --with-media (content tables have no rows media depends on).
psql(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`)
console.log('✓ tables truncated')

// Clear the content half of the id-map (keep media/asset mappings unless --with-media).
const idMapPath = path.join(SQL, 'id-map.json')
if (fs.existsSync(idMapPath)) {
  const idMap = JSON.parse(fs.readFileSync(idMapPath, 'utf8'))
  for (const k of CONTENT_IDMAP_KEYS) idMap[k] = {}
  fs.writeFileSync(idMapPath, JSON.stringify(idMap))
  console.log('✓ id-map content keys reset')
}
if (withMedia) {
  const assetMapPath = path.join(SQL, 'asset-map.json')
  if (fs.existsSync(assetMapPath)) fs.rmSync(assetMapPath)
  console.log('✓ asset-map removed (media will re-transfer)')
}

console.log(`\n✔ reset complete. Re-run: sql-import.mjs → sql-import-relations.mjs${withMedia ? ' (after sql-transfer-assets.mjs)' : ''} → sql-verify.mjs`)
