import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Gjør rikteksfeltene lokaliserte (nb/en): flytter kolonnene fra basistabellene
 * til *_locales-tabellene og KOPIERER eksisterende innhold inn som nb — både
 * for publiserte dokumenter og versjonstabellene (utkast). Håndskrevet fordi
 * drizzle-diffen ikke kan vite at flyttingen skal bevare data (den ville
 * droppet kolonnene rått), og genereringen henger interaktivt på tvetydigheten.
 *
 * Felter: events.intro/description/ticket_description, news.intro/news_content,
 * artists.bio, arena.page_content.
 */

const MOVES: [table: string, versioned: boolean, columns: string[]][] = [
  ['events', true, ['intro', 'description', 'ticket_description']],
  ['news', true, ['intro', 'news_content']],
  ['artists', true, ['bio']],
  ['arena', true, ['page_content']],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [table, versioned, cols] of MOVES) {
    for (const col of cols) {
      // 1) legg kolonnen til i locales-tabellen
      await db.execute(sql.raw(`ALTER TABLE "${table}_locales" ADD COLUMN IF NOT EXISTS "${col}" jsonb;`))
      // 2) sørg for at alle dokumenter har en nb-rad, kopier verdien inn
      await db.execute(sql.raw(`
        INSERT INTO "${table}_locales" ("_locale", "_parent_id")
        SELECT 'nb', b."id" FROM "${table}" b
        WHERE NOT EXISTS (SELECT 1 FROM "${table}_locales" l WHERE l."_parent_id" = b."id" AND l."_locale" = 'nb');`))
      await db.execute(sql.raw(`
        UPDATE "${table}_locales" l SET "${col}" = b."${col}"
        FROM "${table}" b WHERE l."_parent_id" = b."id" AND l."_locale" = 'nb' AND b."${col}" IS NOT NULL;`))
      // 3) fjern basiskolonnen
      await db.execute(sql.raw(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${col}";`))

      if (versioned) {
        const v = `_${table}_v`
        await db.execute(sql.raw(`ALTER TABLE "${v}_locales" ADD COLUMN IF NOT EXISTS "version_${col}" jsonb;`))
        await db.execute(sql.raw(`
          INSERT INTO "${v}_locales" ("_locale", "_parent_id")
          SELECT 'nb', b."id" FROM "${v}" b
          WHERE NOT EXISTS (SELECT 1 FROM "${v}_locales" l WHERE l."_parent_id" = b."id" AND l."_locale" = 'nb');`))
        await db.execute(sql.raw(`
          UPDATE "${v}_locales" l SET "version_${col}" = b."version_${col}"
          FROM "${v}" b WHERE l."_parent_id" = b."id" AND l."_locale" = 'nb' AND b."version_${col}" IS NOT NULL;`))
        await db.execute(sql.raw(`ALTER TABLE "${v}" DROP COLUMN IF EXISTS "version_${col}";`))
      }
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [table, versioned, cols] of MOVES) {
    for (const col of cols) {
      await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" jsonb;`))
      await db.execute(sql.raw(`
        UPDATE "${table}" b SET "${col}" = l."${col}"
        FROM "${table}_locales" l WHERE l."_parent_id" = b."id" AND l."_locale" = 'nb';`))
      await db.execute(sql.raw(`ALTER TABLE "${table}_locales" DROP COLUMN IF EXISTS "${col}";`))
      if (versioned) {
        const v = `_${table}_v`
        await db.execute(sql.raw(`ALTER TABLE "${v}" ADD COLUMN IF NOT EXISTS "version_${col}" jsonb;`))
        await db.execute(sql.raw(`
          UPDATE "${v}" b SET "version_${col}" = l."version_${col}"
          FROM "${v}_locales" l WHERE l."_parent_id" = b."id" AND l."_locale" = 'nb';`))
        await db.execute(sql.raw(`ALTER TABLE "${v}_locales" DROP COLUMN IF EXISTS "version_${col}";`))
      }
    }
  }
}
