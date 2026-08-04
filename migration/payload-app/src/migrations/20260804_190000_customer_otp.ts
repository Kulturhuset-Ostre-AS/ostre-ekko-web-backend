import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Engangskode-felter for glemt passord på customers (commerce/auth-otp.ts). */

const COLS: [name: string, type: string][] = [
  ['otp_code_hash', 'varchar'],
  ['otp_reset_token', 'varchar'],
  ['otp_expires_at', 'timestamp(3) with time zone'],
  ['otp_attempts', 'numeric'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [name, type] of COLS) {
    await db.execute(sql.raw(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "${name}" ${type};`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [name] of COLS) {
    await db.execute(sql.raw(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "${name}";`))
  }
}
