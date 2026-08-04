import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Splitter den Craft-arvede `categories`-collectionen (group locations/
 * organizers) i to egne collections: `locations` (venue/rom/kapasitet) og
 * `organizers` (kun navn). Id-ene BEVARES fra categories — de to gruppene var
 * disjunkte delmengder — så alle relasjoner re-pekes uten id-omskrivning:
 *
 *   events_rels/performance_rels/_events_v_rels/_performance_v_rels:
 *     categories_id -> locations_id (path 'location'/'version.location')
 *   events.organizer_id + _events_v.version_organizer_id: FK -> organizers
 *   events_doors_open_by_venue(+versjon).location_id: FK -> locations
 *   payload_locked_documents_rels: categories_id -> locations_id/organizers_id
 *
 * DDL-en speiler drizzle-generert skjema (verifisert mot dev-push på tom
 * scratch-DB 2026-08-04). Håndskrevet av samme grunn som tidligere: generatoren
 * henger interaktivt på flyttinger.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ---- nye tabeller ---------------------------------------------------------
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "locations" (
      "id" serial PRIMARY KEY NOT NULL,
      "craft_id" numeric,
      "slug" varchar NOT NULL,
      "venue" varchar,
      "room" varchar,
      "capacity" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );`))
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "locations_locales" (
      "title" varchar NOT NULL,
      "full_title" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL,
      CONSTRAINT "locations_locales_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "locations"("id") ON DELETE CASCADE
    );`))
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "organizers" (
      "id" serial PRIMARY KEY NOT NULL,
      "craft_id" numeric,
      "slug" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );`))
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "organizers_locales" (
      "title" varchar NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL,
      CONSTRAINT "organizers_locales_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "organizers"("id") ON DELETE CASCADE
    );`))
  for (const t of ['locations', 'organizers']) {
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${t}_craft_id_idx" ON "${t}" ("craft_id");`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${t}_slug_idx" ON "${t}" ("slug");`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${t}_updated_at_idx" ON "${t}" ("updated_at");`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${t}_created_at_idx" ON "${t}" ("created_at");`))
    await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "${t}_locales_locale_parent_id_unique" ON "${t}_locales" ("_locale", "_parent_id");`))
  }

  // ---- datakopi (id-ene bevares) -------------------------------------------
  await db.execute(sql.raw(`
    INSERT INTO "locations" ("id", "craft_id", "slug", "venue", "room", "capacity", "updated_at", "created_at")
    SELECT "id", "craft_id", "slug", "venue", "room", "capacity", "updated_at", "created_at"
    FROM "categories" WHERE "group" = 'locations';`))
  await db.execute(sql.raw(`
    INSERT INTO "locations_locales" ("title", "full_title", "_locale", "_parent_id")
    SELECT l."title", l."full_title", l."_locale", l."_parent_id"
    FROM "categories_locales" l JOIN "categories" c ON c."id" = l."_parent_id"
    WHERE c."group" = 'locations' AND l."title" IS NOT NULL;`))
  await db.execute(sql.raw(`
    INSERT INTO "organizers" ("id", "craft_id", "slug", "updated_at", "created_at")
    SELECT "id", "craft_id", "slug", "updated_at", "created_at"
    FROM "categories" WHERE "group" = 'organizers';`))
  await db.execute(sql.raw(`
    INSERT INTO "organizers_locales" ("title", "_locale", "_parent_id")
    SELECT l."title", l."_locale", l."_parent_id"
    FROM "categories_locales" l JOIN "categories" c ON c."id" = l."_parent_id"
    WHERE c."group" = 'organizers' AND l."title" IS NOT NULL;`))
  await db.execute(sql.raw(`SELECT setval('locations_id_seq', (SELECT COALESCE(MAX("id"), 1) FROM "locations"));`))
  await db.execute(sql.raw(`SELECT setval('organizers_id_seq', (SELECT COALESCE(MAX("id"), 1) FROM "organizers"));`))

  // ---- re-pek rels-tabellene (categories_id -> locations_id) ---------------
  const RELS: [table: string, fkName: string][] = [
    ['events_rels', 'events_rels_locations_fk'],
    ['performance_rels', 'performance_rels_locations_fk'],
    ['_events_v_rels', '_events_v_rels_locations_fk'],
    ['_performance_v_rels', '_performance_v_rels_locations_fk'],
  ]
  for (const [table, fkName] of RELS) {
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "locations_id" integer;`))
    await db.execute(sql.raw(`UPDATE "${table}" SET "locations_id" = "categories_id" WHERE "categories_id" IS NOT NULL;`))
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "${table}" ADD CONSTRAINT "${fkName}"
          FOREIGN KEY ("locations_id") REFERENCES "locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null; END $$;`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${table}_locations_id_idx" ON "${table}" ("locations_id");`))
    await db.execute(sql.raw(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "categories_id";`))
  }

  // ---- enkelt-FK-er: organizer + doors-open ---------------------------------
  await db.execute(sql.raw(`ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_organizer_id_categories_id_fk";`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_organizers_id_fk"
        FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v" DROP CONSTRAINT IF EXISTS "_events_v_version_organizer_id_categories_id_fk";`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_organizer_id_organizers_id_fk"
        FOREIGN KEY ("version_organizer_id") REFERENCES "organizers"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))

  await db.execute(sql.raw(`ALTER TABLE "events_doors_open_by_venue" DROP CONSTRAINT IF EXISTS "events_doors_open_by_venue_location_id_categories_id_fk";`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "events_doors_open_by_venue" ADD CONSTRAINT "events_doors_open_by_venue_location_id_locations_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v_version_doors_open_by_venue" DROP CONSTRAINT IF EXISTS "_events_v_version_doors_open_by_venue_location_id_categories_id";`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "_events_v_version_doors_open_by_venue" ADD CONSTRAINT "_events_v_version_doors_open_by_venue_location_id_locations_id_"
        FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))

  // ---- payload_locked_documents_rels (transient lås-referanser) -------------
  await db.execute(sql.raw(`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "locations_id" integer;`))
  await db.execute(sql.raw(`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "organizers_id" integer;`))
  await db.execute(sql.raw(`
    UPDATE "payload_locked_documents_rels" r SET "locations_id" = r."categories_id"
    FROM "categories" c WHERE c."id" = r."categories_id" AND c."group" = 'locations';`))
  await db.execute(sql.raw(`
    UPDATE "payload_locked_documents_rels" r SET "organizers_id" = r."categories_id"
    FROM "categories" c WHERE c."id" = r."categories_id" AND c."group" = 'organizers';`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_locations_fk"
        FOREIGN KEY ("locations_id") REFERENCES "locations"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_organizers_fk"
        FOREIGN KEY ("organizers_id") REFERENCES "organizers"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_locations_id_idx" ON "payload_locked_documents_rels" ("locations_id");`))
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_organizers_id_idx" ON "payload_locked_documents_rels" ("organizers_id");`))
  await db.execute(sql.raw(`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "categories_id";`))

  // ---- fjern categories -----------------------------------------------------
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "categories_locales";`))
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "categories";`))
  await db.execute(sql.raw(`DROP TYPE IF EXISTS "enum_categories_group";`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Gjenoppretter categories fra locations+organizers (motsatt av up).
  await db.execute(sql.raw(`
    DO $$ BEGIN
      CREATE TYPE "enum_categories_group" AS ENUM ('locations', 'organizers');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "craft_id" numeric,
      "slug" varchar NOT NULL,
      "group" "enum_categories_group" NOT NULL,
      "venue" varchar,
      "room" varchar,
      "capacity" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );`))
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "categories_locales" (
      "title" varchar NOT NULL,
      "full_title" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "_locales" NOT NULL,
      "_parent_id" integer NOT NULL,
      CONSTRAINT "categories_locales_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "categories"("id") ON DELETE CASCADE
    );`))
  await db.execute(sql.raw(`
    INSERT INTO "categories" ("id", "craft_id", "slug", "group", "venue", "room", "capacity", "updated_at", "created_at")
    SELECT "id", "craft_id", "slug", 'locations', "venue", "room", "capacity", "updated_at", "created_at" FROM "locations";`))
  await db.execute(sql.raw(`
    INSERT INTO "categories" ("id", "craft_id", "slug", "group", "updated_at", "created_at")
    SELECT "id", "craft_id", "slug", 'organizers', "updated_at", "created_at" FROM "organizers";`))
  await db.execute(sql.raw(`
    INSERT INTO "categories_locales" ("title", "full_title", "_locale", "_parent_id")
    SELECT "title", "full_title", "_locale", "_parent_id" FROM "locations_locales";`))
  await db.execute(sql.raw(`
    INSERT INTO "categories_locales" ("title", "_locale", "_parent_id")
    SELECT "title", "_locale", "_parent_id" FROM "organizers_locales";`))
  await db.execute(sql.raw(`SELECT setval('categories_id_seq', (SELECT COALESCE(MAX("id"), 1) FROM "categories"));`))

  for (const [table, fkName] of [
    ['events_rels', 'events_rels_categories_fk'],
    ['performance_rels', 'performance_rels_categories_fk'],
    ['_events_v_rels', '_events_v_rels_categories_fk'],
    ['_performance_v_rels', '_performance_v_rels_categories_fk'],
  ] as [string, string][]) {
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "categories_id" integer;`))
    await db.execute(sql.raw(`UPDATE "${table}" SET "categories_id" = "locations_id" WHERE "locations_id" IS NOT NULL;`))
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "${table}" ADD CONSTRAINT "${fkName}"
          FOREIGN KEY ("categories_id") REFERENCES "categories"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null; END $$;`))
    await db.execute(sql.raw(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "locations_id";`))
  }

  await db.execute(sql.raw(`ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_organizer_id_organizers_id_fk";`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_categories_id_fk"
        FOREIGN KEY ("organizer_id") REFERENCES "categories"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v" DROP CONSTRAINT IF EXISTS "_events_v_version_organizer_id_organizers_id_fk";`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_organizer_id_categories_id_fk"
        FOREIGN KEY ("version_organizer_id") REFERENCES "categories"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`ALTER TABLE "events_doors_open_by_venue" DROP CONSTRAINT IF EXISTS "events_doors_open_by_venue_location_id_locations_id_fk";`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "events_doors_open_by_venue" ADD CONSTRAINT "events_doors_open_by_venue_location_id_categories_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "categories"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`ALTER TABLE "_events_v_version_doors_open_by_venue" DROP CONSTRAINT IF EXISTS "_events_v_version_doors_open_by_venue_location_id_locations_id_";`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "_events_v_version_doors_open_by_venue" ADD CONSTRAINT "_events_v_version_doors_open_by_venue_location_id_categories_id"
        FOREIGN KEY ("location_id") REFERENCES "categories"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))

  await db.execute(sql.raw(`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "categories_id" integer;`))
  await db.execute(sql.raw(`UPDATE "payload_locked_documents_rels" SET "categories_id" = COALESCE("locations_id", "organizers_id");`))
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk"
        FOREIGN KEY ("categories_id") REFERENCES "categories"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
  await db.execute(sql.raw(`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "locations_id";`))
  await db.execute(sql.raw(`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "organizers_id";`))

  await db.execute(sql.raw(`DROP TABLE IF EXISTS "locations_locales";`))
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "organizers_locales";`))
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "locations";`))
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "organizers";`))
}
