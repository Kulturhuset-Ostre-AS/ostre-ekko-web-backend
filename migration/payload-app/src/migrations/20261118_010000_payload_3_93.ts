import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload 3.85 → 3.93:
 * - 3.90: `resetPasswordRequestedAt` på auth-collections (struping av glemt
 *   passord og opphevelse av låsing) — users og customers.
 * - 3.91: indeks på `_parent_id` i lokaliserte tabeller (#18724).
 * Utledet ved å la 3.93 bygge skjemaet i en tom database og sammenligne med
 * 3.85-skjemaet: ingen andre forskjeller. IF NOT EXISTS gjør den trygg å kjøre om.
 */

const AUTH_TABLES = ['users', 'customers']

const PARENT_ID_INDEXES: [index: string, table: string][] = [
  ['_arena_v_locales_parent_id_idx', '_arena_v_locales'],
  ['_artists_v_locales_parent_id_idx', '_artists_v_locales'],
  ['_events_v_locales_parent_id_idx', '_events_v_locales'],
  ['_events_v_version_sections_locales_parent_id_idx', '_events_v_version_sections_locales'],
  ['_events_v_version_ticket_types_locales_parent_id_idx', '_events_v_version_ticket_types_locales'],
  ['_news_v_locales_parent_id_idx', '_news_v_locales'],
  ['_performance_v_locales_parent_id_idx', '_performance_v_locales'],
  ['about_locales_parent_id_idx', 'about_locales'],
  ['archive_locales_parent_id_idx', 'archive_locales'],
  ['arena_locales_parent_id_idx', 'arena_locales'],
  ['artists_locales_parent_id_idx', 'artists_locales'],
  ['ekko_festival_info_blocks_entry_locales_parent_id_idx', 'ekko_festival_info_blocks_entry_locales'],
  ['ekko_festival_info_locales_parent_id_idx', 'ekko_festival_info_locales'],
  ['events_locales_parent_id_idx', 'events_locales'],
  ['events_sections_locales_parent_id_idx', 'events_sections_locales'],
  ['events_ticket_types_locales_parent_id_idx', 'events_ticket_types_locales'],
  ['global_info_locales_parent_id_idx', 'global_info_locales'],
  ['homepage_blocks_entry_locales_parent_id_idx', 'homepage_blocks_entry_locales'],
  ['homepage_locales_parent_id_idx', 'homepage_locales'],
  ['legal_locales_parent_id_idx', 'legal_locales'],
  ['locations_locales_parent_id_idx', 'locations_locales'],
  ['membership_config_locales_parent_id_idx', 'membership_config_locales'],
  ['navigation_nodes_locales_parent_id_idx', 'navigation_nodes_locales'],
  ['news_locales_parent_id_idx', 'news_locales'],
  ['oestre_blocks_entry_locales_parent_id_idx', 'oestre_blocks_entry_locales'],
  ['oestre_locales_parent_id_idx', 'oestre_locales'],
  ['organizers_locales_parent_id_idx', 'organizers_locales'],
  ['performance_locales_parent_id_idx', 'performance_locales'],
  ['tags_locales_parent_id_idx', 'tags_locales'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of AUTH_TABLES) {
    await db.execute(
      sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;`),
    )
  }
  for (const [index, table] of PARENT_ID_INDEXES) {
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${index}" ON "${table}" USING btree ("_parent_id");`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [index] of PARENT_ID_INDEXES) {
    await db.execute(sql.raw(`DROP INDEX IF EXISTS "${index}";`))
  }
  for (const table of AUTH_TABLES) {
    await db.execute(sql.raw(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "reset_password_requested_at";`))
  }
}
