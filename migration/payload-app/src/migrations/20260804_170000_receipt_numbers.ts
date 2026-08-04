import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Kvitteringsnummer (bokføringsforskriften § 5-1-1: salgsdokument skal ha
 * maskinelt tildelt, fortløpende nummer). Egen sekvens som tildeles ved
 * FULLFØRT betaling — ordre-id-en tildeles ved checkout og gir hull for
 * avbrutte kjøp. Eksisterende betalte ordrer får numre i kjøpsrekkefølge.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "receipt_number_seq" START 1000;`))
  await db.execute(sql.raw(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "receipt_number" numeric;`))
  await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "orders_receipt_number_unique" ON "orders" ("receipt_number") WHERE "receipt_number" IS NOT NULL;`))
  // Deterministisk backfill i kjøpsrekkefølge.
  await db.execute(sql.raw(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN SELECT id FROM "orders" WHERE status = 'paid' AND "receipt_number" IS NULL ORDER BY created_at, id
      LOOP
        UPDATE "orders" SET "receipt_number" = nextval('receipt_number_seq') WHERE id = r.id;
      END LOOP;
    END $$;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "receipt_number";`))
  await db.execute(sql.raw(`DROP SEQUENCE IF EXISTS "receipt_number_seq";`))
}
