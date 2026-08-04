// Reset migrated CONTENT so the import can be re-run cleanly, WITHOUT re-transferring
// assets. Truncates the content collection tables (events/news/arena/artists/
// performance/locations/organizers) and clears the content half of data/sql/id-map.json.
//
// KEEPS: media (+ its files on the volume), users, and data/sql/asset-map.json — so a
// re-import reuses the already-uploaded assets. To also wipe media, pass --with-media.
//
// Only needed for a RE-run; a first import into an empty DB doesn't need this.
// Run: node scripts/sql-reset.mjs [--with-media]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL = path.resolve(__dirname, '..', 'data', 'sql')
const COMPOSE = path.resolve(__dirname, '..', 'docker', 'docker-compose.payload.yml')
const withMedia = process.argv.includes('--with-media')

const CONTENT_TABLES = ['events', 'news', 'arena', 'artists', 'performance', 'locations', 'organizers']
const CONTENT_IDMAP_KEYS = [...CONTENT_TABLES]
const tables = withMedia ? [...CONTENT_TABLES, 'media'] : CONTENT_TABLES

function psql(sql) {
  return execFileSync(
    'docker',
    ['compose', '-f', COMPOSE, 'exec', '-T', 'postgres', 'psql', '-U', 'payload', '-d', 'payload', '-c', sql],
    { encoding: 'utf8' },
  )
}

console.log(`Resetting content tables: ${tables.join(', ')}`)
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
