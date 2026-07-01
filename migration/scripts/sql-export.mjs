// Direct SQL export from the restored Craft 3 DB -> JSON, bypassing Craft GraphQL.
//
// Reads the Craft EAV schema via the mariadb client in the craft3 container:
//   - entries: craft_entries + craft_elements_sites (slug/uri) + craft_content (title + field_*)
//   - matrix:  craft_matrixblocks + craft_matrixcontent_<field> + craft_matrixblocktypes
//   - relations: craft_relations (fieldId, sourceId -> targetId), per locale
//   - assets:  craft_assets + craft_volumefolders + craft_volumes
//   - categories: craft_categories + content
//
// Output: data/sql/<collection>.<site>.json (one JSON doc per element, native-ish).
// Run: node migration/scripts/sql-export.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'data', 'sql')
const COMPOSE = path.join(ROOT, 'docker', 'docker-compose.craft3.yml')

fs.mkdirSync(OUT, { recursive: true })

const SITES = [{ id: 1, handle: 'nb' }, { id: 2, handle: 'en' }]

// Run SQL in the container, return rows. `json=true` expects each row to be a single
// JSON_OBJECT column (one JSON value per line).
function sql(query, { json = false } = {}) {
  const out = execFileSync(
    'docker',
    ['compose', '-f', COMPOSE, 'exec', '-T', 'db', 'sh', '-c',
      `mariadb -uroot -proot ekko -N -e ${shellQuote(query)}`],
    { maxBuffer: 1024 * 1024 * 512, encoding: 'utf8' },
  )
  const lines = out.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.length)
  if (!json) return lines
  return lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}
const shellQuote = (s) => `'${s.replace(/'/g, `'\\''`)}'`

function writeJSON(name, obj) {
  const p = path.join(OUT, name)
  fs.writeFileSync(p, JSON.stringify(obj, null, 2))
  return p
}

// ---- field maps (Craft field handle -> content column / relation) ---------------
// Built dynamically: list field_* columns present per content table.
function contentColumns(table) {
  return sql(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS ` +
    `WHERE TABLE_SCHEMA='ekko' AND TABLE_NAME='${table}' AND COLUMN_NAME LIKE 'field\\_%';`,
  )
}

// Craft appends a `_<8-char-uid>` suffix to field columns when a field is reused
// inside a field layout (e.g. field_venue_elprwjet). Those UIDs are install-specific,
// so we strip both `field_` and the trailing uid suffix to get a stable handle
// (venue). Verified: no legitimate field handle ends in `_[a-z0-9]{8}` in this schema,
// so there are no false positives. Import code keys off the clean names.
function cleanFieldName(col) {
  return col.replace(/^field_/, '').replace(/_[a-z0-9]{8}$/, '')
}

// Relation fields: which field handles are relations (entries/assets/categories).
function relationFieldHandles() {
  return sql(
    `SELECT DISTINCT f.handle FROM craft_relations r JOIN craft_fields f ON r.fieldId=f.id;`,
  )
}

// ---- sections to export ----------------------------------------------------------
const SECTIONS = ['events', 'news', 'arena', 'artists', 'performance',
  'about', 'archive', 'homepage', 'legal', 'oestre', 'ekko_festival_info']

// Build the SELECT of all content field columns for a site, as one JSON_OBJECT.
function entriesQuery(sectionHandle, siteId, fieldCols) {
  // JSON_OBJECT of base fields + every field_* column (aliased without the field_ prefix).
  const base = [
    `'id', e.id`, `'uid', e.uid`, `'typeId', e.typeId`, `'typeHandle', et.handle`,
    `'sectionHandle', s.handle`, `'title', c.title`, `'slug', es.slug`, `'uri', es.uri`,
    `'enabled', el.enabled`, `'postDate', e.postDate`,
    `'lft', st.lft`, `'rgt', st.rgt`, `'level', st.level`, `'parentId',
      (SELECT a.elementId FROM craft_structureelements a
        WHERE a.structureId = st.structureId
          AND a.lft < st.lft AND a.rgt > st.rgt AND a.level = st.level - 1
        ORDER BY a.lft DESC LIMIT 1)`,
  ]
  const fieldPairs = fieldCols.map((col) => `'${cleanFieldName(col)}', c.${col}`)
  const jsonObj = `JSON_OBJECT(${[...base, ...fieldPairs].join(', ')})`
  return `
    SELECT ${jsonObj}
    FROM craft_entries e
    JOIN craft_elements el ON el.id=e.id
      AND el.dateDeleted IS NULL
      AND el.revisionId IS NULL   -- exclude Craft revision history (old saved versions)
      AND el.draftId IS NULL      -- exclude drafts
    JOIN craft_sections s ON e.sectionId=s.id
    JOIN craft_entrytypes et ON e.typeId=et.id
    JOIN craft_elements_sites es ON es.elementId=e.id AND es.siteId=${siteId}
    JOIN craft_content c ON c.elementId=e.id AND c.siteId=${siteId}
    LEFT JOIN craft_structureelements st ON st.elementId=e.id
    WHERE s.handle='${sectionHandle}'
    GROUP BY e.id;`
}

// Relations for a set of source element ids, grouped by field handle.
function exportRelations() {
  // (sourceId, fieldHandle, [targetIds in sortOrder])
  const rows = sql(
    `SELECT JSON_OBJECT('source', r.sourceId, 'field', f.handle, 'target', r.targetId, 'sort', r.sortOrder)
     FROM craft_relations r JOIN craft_fields f ON r.fieldId=f.id
     ORDER BY r.sourceId, f.handle, r.sortOrder;`,
    { json: true },
  )
  // group -> { [sourceId]: { [field]: [targetId,...] } }
  const map = {}
  for (const r of rows) {
    ;((map[r.source] ||= {})[r.field] ||= []).push(r.target)
  }
  return map
}

// Matrix blocks for a given matrixcontent table + field.
function exportMatrix(fieldHandle, table) {
  const cols = contentColumns(table) // field_<blocktype>_<subfield>
  const colPairs = cols.map((c) => `'${c.replace(/^field_/, '')}', mc.${c}`)
  const rows = sql(
    `SELECT JSON_OBJECT(
       'ownerId', mb.ownerId, 'blockType', bt.handle, 'sort', mb.sortOrder,
       'id', mb.id, 'siteId', mc.siteId
       ${colPairs.length ? ',' + colPairs.join(',') : ''}
     )
     FROM craft_matrixblocks mb
     JOIN craft_matrixblocktypes bt ON mb.typeId=bt.id
     JOIN craft_elements el ON el.id=mb.id AND el.dateDeleted IS NULL
     -- owner must be a canonical entry (not a revision/draft), else we'd carry blocks
     -- from old saved versions.
     JOIN craft_elements owner ON owner.id=mb.ownerId
       AND owner.dateDeleted IS NULL AND owner.revisionId IS NULL AND owner.draftId IS NULL
     JOIN ${table} mc ON mc.elementId=mb.id
     ORDER BY mb.ownerId, mb.sortOrder;`,
    { json: true },
  )
  // group by ownerId, per site
  const map = {} // ownerId -> { siteId -> [blocks] }
  for (const b of rows) {
    ((map[b.ownerId] ||= {})[b.siteId] ||= []).push(b)
  }
  return map
}

function main() {
  console.log('Reading field maps…')
  const relFields = new Set(relationFieldHandles())
  const relations = exportRelations()
  writeJSON('_relations.json', relations)
  console.log(`  relations: ${Object.keys(relations).length} source elements`)

  // Matrix fields -> table mapping (craft_matrixcontent_<lowercasehandle>)
  const matrixTables = sql(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='ekko' AND TABLE_NAME LIKE 'craft_matrixcontent_%';`,
  )
  const matrix = {}
  for (const t of matrixTables) {
    const field = t.replace('craft_matrixcontent_', '')
    matrix[field] = exportMatrix(field, t)
    console.log(`  matrix ${field}: ${Object.keys(matrix[field]).length} owners`)
  }
  writeJSON('_matrix.json', matrix)

  // Entries per section per site
  const fieldCols = contentColumns('craft_content')
  let total = 0
  for (const section of SECTIONS) {
    for (const site of SITES) {
      const rows = sql(entriesQuery(section, site.id, fieldCols), { json: true })
      writeJSON(`${section}.${site.handle}.json`, rows)
      total += rows.length
      console.log(`  ${section}.${site.handle}: ${rows.length}`)
    }
  }

  // Categories. venue/room may carry install-specific UID suffixes; resolve by handle.
  const allCols = contentColumns('craft_content')
  const findCol = (h) => allCols.find((c) => c === `field_${h}` || new RegExp(`^field_${h}_[a-z0-9]{8}$`).test(c)) || `field_${h}`
  const venueCol = findCol('venue')
  const roomCol = findCol('room')
  for (const site of SITES) {
    const rows = sql(`
      SELECT JSON_OBJECT('id', cat.id, 'uid', cat.uid, 'group', g.handle,
        'title', c.title, 'slug', es.slug,
        'fullTitle', c.field_fullTitle, 'venue', c.${venueCol}, 'room', c.${roomCol})
      FROM craft_categories cat
      JOIN craft_elements el ON el.id=cat.id
        AND el.dateDeleted IS NULL AND el.revisionId IS NULL AND el.draftId IS NULL
      JOIN craft_categorygroups g ON cat.groupId=g.id
      JOIN craft_elements_sites es ON es.elementId=cat.id AND es.siteId=${site.id}
      JOIN craft_content c ON c.elementId=cat.id AND c.siteId=${site.id}
      GROUP BY cat.id;`, { json: true }).filter(Boolean)
    writeJSON(`categories.${site.handle}.json`, rows)
    console.log(`  categories.${site.handle}: ${rows.length}`)
  }

  // Assets
  const assets = sql(`
    SELECT JSON_OBJECT('id', a.id, 'uid', a.uid, 'filename', a.filename,
      'volume', v.handle, 'folderPath', f.path, 'kind', a.kind,
      'width', a.width, 'height', a.height, 'size', a.size,
      'title', c.title)
    FROM craft_assets a
    JOIN craft_elements el ON el.id=a.id AND el.dateDeleted IS NULL
    JOIN craft_volumes v ON a.volumeId=v.id
    JOIN craft_volumefolders f ON a.folderId=f.id
    LEFT JOIN craft_content c ON c.elementId=a.id AND c.siteId=1
    GROUP BY a.id;`, { json: true })
  writeJSON('assets.json', assets)
  console.log(`  assets: ${assets.length}`)

  console.log(`\n✔ SQL export complete — ${total} entries + ${assets.length} assets -> data/sql/`)
}

main()
