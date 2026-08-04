import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Miro-brettet «EKKONETTSIDE» (docs/design/miro-ekkonettside/README.md):
 *  - events: doorsOpenTime («Dørene åpner»), ageLimit, practicalInfo,
 *    spilleplan (lokaliserte felter i *_locales)
 *  - events.doorsOpenByVenue: ny array-tabell (festival-tidsplanens
 *    «Dørene åpner»-rader per scene/dag)
 *  - events.tickets: category (enum festivalpass/dagspass/enkeltbillett) +
 *    strukturerte felter validFor/ticketAgeLimit/guardianInfo/
 *    accessibilityInfo/practicalInfo
 *  - fanzine (upload hasMany) trenger ingen DDL — lagres i events_rels.
 *
 * Håndskrevet fordi drizzle-genereringen henger interaktivt (samme som
 * 20260802_120000_localize_richtext). Kolonnenavn/typer speiler eksisterende
 * konvensjoner (jf. events_tickets, events_program, *_locales, _events_v_*).
 */

const TICKET_COLS = ['valid_for', 'ticket_age_limit', 'guardian_info', 'accessibility_info', 'practical_info']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // -- nye enkeltfelter ------------------------------------------------------
  await db.execute(sql.raw(`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "doors_open_time" varchar;`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v" ADD COLUMN IF NOT EXISTS "version_doors_open_time" varchar;`))

  await db.execute(sql.raw(`ALTER TABLE "events_locales" ADD COLUMN IF NOT EXISTS "age_limit" varchar;`))
  await db.execute(sql.raw(`ALTER TABLE "events_locales" ADD COLUMN IF NOT EXISTS "practical_info" jsonb;`))
  await db.execute(sql.raw(`ALTER TABLE "events_locales" ADD COLUMN IF NOT EXISTS "spilleplan" varchar;`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v_locales" ADD COLUMN IF NOT EXISTS "version_age_limit" varchar;`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v_locales" ADD COLUMN IF NOT EXISTS "version_practical_info" jsonb;`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v_locales" ADD COLUMN IF NOT EXISTS "version_spilleplan" varchar;`))

  // -- billettkategori (enum) + strukturerte billettfelter -------------------
  await db.execute(sql.raw(`
    DO $$ BEGIN
      CREATE TYPE "enum_events_tickets_category" AS ENUM ('festivalpass', 'dagspass', 'enkeltbillett');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      CREATE TYPE "enum__events_v_version_tickets_category" AS ENUM ('festivalpass', 'dagspass', 'enkeltbillett');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`ALTER TABLE "events_tickets" ADD COLUMN IF NOT EXISTS "category" "enum_events_tickets_category";`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v_version_tickets" ADD COLUMN IF NOT EXISTS "category" "enum__events_v_version_tickets_category";`))
  for (const col of TICKET_COLS) {
    await db.execute(sql.raw(`ALTER TABLE "events_tickets" ADD COLUMN IF NOT EXISTS "${col}" varchar;`))
    await db.execute(sql.raw(`ALTER TABLE "_events_v_version_tickets" ADD COLUMN IF NOT EXISTS "${col}" varchar;`))
  }

  // -- doorsOpenByVenue (array-tabeller) -------------------------------------
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "events_doors_open_by_venue" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "date" timestamp(3) with time zone,
      "location_id" integer,
      "time" varchar
    );`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "events_doors_open_by_venue"
        ADD CONSTRAINT "events_doors_open_by_venue_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "events"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "events_doors_open_by_venue"
        ADD CONSTRAINT "events_doors_open_by_venue_location_id_categories_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "categories"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "events_doors_open_by_venue_order_idx" ON "events_doors_open_by_venue" ("_order");`))
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "events_doors_open_by_venue_parent_id_idx" ON "events_doors_open_by_venue" ("_parent_id");`))
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "events_doors_open_by_venue_location_idx" ON "events_doors_open_by_venue" ("location_id");`))

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "_events_v_version_doors_open_by_venue" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "date" timestamp(3) with time zone,
      "location_id" integer,
      "time" varchar,
      "_uuid" varchar
    );`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "_events_v_version_doors_open_by_venue"
        ADD CONSTRAINT "_events_v_version_doors_open_by_venue_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_events_v"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "_events_v_version_doors_open_by_venue"
        ADD CONSTRAINT "_events_v_version_doors_open_by_venue_location_id_categories_id"
        FOREIGN KEY ("location_id") REFERENCES "categories"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "_events_v_version_doors_open_by_venue_order_idx" ON "_events_v_version_doors_open_by_venue" ("_order");`))
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "_events_v_version_doors_open_by_venue_parent_id_idx" ON "_events_v_version_doors_open_by_venue" ("_parent_id");`))
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "_events_v_version_doors_open_by_venue_location_idx" ON "_events_v_version_doors_open_by_venue" ("location_id");`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "_events_v_version_doors_open_by_venue";`))
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "events_doors_open_by_venue";`))
  for (const col of [...TICKET_COLS, 'category']) {
    await db.execute(sql.raw(`ALTER TABLE "events_tickets" DROP COLUMN IF EXISTS "${col}";`))
    await db.execute(sql.raw(`ALTER TABLE "_events_v_version_tickets" DROP COLUMN IF EXISTS "${col}";`))
  }
  await db.execute(sql.raw(`DROP TYPE IF EXISTS "enum_events_tickets_category";`))
  await db.execute(sql.raw(`DROP TYPE IF EXISTS "enum__events_v_version_tickets_category";`))
  for (const col of ['age_limit', 'practical_info', 'spilleplan']) {
    await db.execute(sql.raw(`ALTER TABLE "events_locales" DROP COLUMN IF EXISTS "${col}";`))
    await db.execute(sql.raw(`ALTER TABLE "_events_v_locales" DROP COLUMN IF EXISTS "version_${col}";`))
  }
  await db.execute(sql.raw(`ALTER TABLE "events" DROP COLUMN IF EXISTS "doors_open_time";`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v" DROP COLUMN IF EXISTS "version_doors_open_time";`))
}
