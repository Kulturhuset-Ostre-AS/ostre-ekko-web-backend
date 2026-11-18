import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Passkeys og tofaktor for redaksjonen (src/auth/editor-mfa.ts): skjulte felt på
 * users. Utledet fra skjemaet Payload selv lager i dev (push) for de nye feltene:
 * bare disse kolonnene, ingen indekser. IF NOT EXISTS gjør den trygg å kjøre om.
 */

const COLS: [name: string, type: string][] = [
  ['mfa_totp_secret', 'varchar'],
  ['mfa_totp_pending', 'varchar'],
  ['mfa_totp_last_step', 'numeric'],
  ['mfa_backup_codes', 'jsonb'],
  ['mfa_passkeys', 'jsonb'],
  ['mfa_email_code_hash', 'varchar'],
  ['mfa_email_code_expires', 'timestamp(3) with time zone'],
  ['mfa_failed_attempts', 'numeric'],
  ['mfa_lock_until', 'timestamp(3) with time zone'],
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
