import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_navigation_nodes_nav" ADD VALUE 'toggle';
  ALTER TYPE "public"."enum_navigation_nodes_nav" ADD VALUE 'about';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "navigation_nodes" ALTER COLUMN "nav" SET DATA TYPE text;
  ALTER TABLE "navigation_nodes" ALTER COLUMN "nav" SET DEFAULT 'main'::text;
  DROP TYPE "public"."enum_navigation_nodes_nav";
  CREATE TYPE "public"."enum_navigation_nodes_nav" AS ENUM('main', 'festival', 'ostre', 'footer');
  ALTER TABLE "navigation_nodes" ALTER COLUMN "nav" SET DEFAULT 'main'::"public"."enum_navigation_nodes_nav";
  ALTER TABLE "navigation_nodes" ALTER COLUMN "nav" SET DATA TYPE "public"."enum_navigation_nodes_nav" USING "nav"::"public"."enum_navigation_nodes_nav";`)
}
