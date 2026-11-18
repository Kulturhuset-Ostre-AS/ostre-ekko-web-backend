import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * API-nøkler for users (auth.useAPIKey) — tjenestebrukeren import@ekko.no for
 * Craft→Payload-importen, med nøkkelen i Secret Manager i stedet for passord.
 * Utledet ved skjemasammenligning (tom database med/uten useAPIKey): kun disse
 * tre kolonnene. IF NOT EXISTS gjør den trygg å kjøre om.
 */

const COLS: [name: string, type: string][] = [
  ['enable_a_p_i_key', 'boolean'],
  ['api_key', 'varchar'],
  ['api_key_index', 'varchar'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [name, type] of COLS) {
    await db.execute(sql.raw(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "${name}" ${type};`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [name] of COLS) {
    await db.execute(sql.raw(`ALTER TABLE "users" DROP COLUMN IF EXISTS "${name}";`))
  }
}
