import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "members" ADD COLUMN "customer_id" integer;
  ALTER TABLE "members" ADD CONSTRAINT "members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "members_customer_idx" ON "members" USING btree ("customer_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "members" DROP CONSTRAINT "members_customer_id_customers_id_fk";
  
  DROP INDEX "members_customer_idx";
  ALTER TABLE "members" DROP COLUMN "customer_id";`)
}
