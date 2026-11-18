import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload 3.90: plugin-cloud-storage legger til feltet `_objectKey` (tekst) på
 * upload-collections som bruker skylagring — hos oss bare media (gcsStorage).
 * Feltet finnes kun når GCS_BUCKET er satt, derfor kom det ikke med i
 * skjemasammenligningen for 20261118_010000_payload_3_93 (lokalt er GCS av).
 * Uten kolonnen gir alle media-spørringer 500. IF NOT EXISTS: trygg å kjøre om.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "media" DROP COLUMN IF EXISTS "_objectkey";`))
}
