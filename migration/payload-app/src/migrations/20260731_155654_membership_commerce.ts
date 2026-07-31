import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_type" AS ENUM('membership');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'paid', 'failed', 'refunded');
  CREATE TYPE "public"."enum_orders_provider" AS ENUM('mock', 'vipps', 'door');
  CREATE TYPE "public"."enum_orders_membership_type" AS ENUM('ordinary', 'student');
  CREATE TYPE "public"."enum_members_membership_type" AS ENUM('ordinary', 'student');
  CREATE TYPE "public"."enum_members_source" AS ENUM('web', 'door');
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_orders_type" DEFAULT 'membership' NOT NULL,
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"amount_ore" numeric NOT NULL,
  	"currency" varchar DEFAULT 'NOK' NOT NULL,
  	"provider" "enum_orders_provider" NOT NULL,
  	"provider_ref" varchar,
  	"membership_type" "enum_orders_membership_type",
  	"season" varchar,
  	"buyer_name" varchar NOT NULL,
  	"buyer_email" varchar NOT NULL,
  	"buyer_address" varchar,
  	"buyer_postal_code" varchar,
  	"buyer_city" varchar,
  	"buyer_birth_year" numeric,
  	"consent_newsletter" boolean DEFAULT false,
  	"member_id" integer,
  	"raw_events" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" varchar,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"address" varchar,
  	"postal_code" varchar,
  	"city" varchar,
  	"birth_year" numeric,
  	"membership_type" "enum_members_membership_type" DEFAULT 'ordinary' NOT NULL,
  	"valid_until" timestamp(3) with time zone NOT NULL,
  	"card_picked_up" boolean DEFAULT false,
  	"source" "enum_members_source" DEFAULT 'door' NOT NULL,
  	"consent_newsletter" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "membership_config" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sales_open" boolean DEFAULT false,
  	"price_ordinary" numeric DEFAULT 300 NOT NULL,
  	"price_student" numeric DEFAULT 200 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "membership_config_locales" (
  	"title" varchar,
  	"page_content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "members_id" integer;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_config_locales" ADD CONSTRAINT "membership_config_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership_config"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "orders_provider_ref_idx" ON "orders" USING btree ("provider_ref");
  CREATE INDEX "orders_buyer_email_idx" ON "orders" USING btree ("buyer_email");
  CREATE INDEX "orders_member_idx" ON "orders" USING btree ("member_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE UNIQUE INDEX "members_member_id_idx" ON "members" USING btree ("member_id");
  CREATE UNIQUE INDEX "members_email_idx" ON "members" USING btree ("email");
  CREATE INDEX "members_updated_at_idx" ON "members" USING btree ("updated_at");
  CREATE INDEX "members_created_at_idx" ON "members" USING btree ("created_at");
  CREATE UNIQUE INDEX "membership_config_locales_locale_parent_id_unique" ON "membership_config_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_members_id_idx" ON "payload_locked_documents_rels" USING btree ("members_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_config" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_config_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "members" CASCADE;
  DROP TABLE "membership_config" CASCADE;
  DROP TABLE "membership_config_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_members_fk";
  
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  DROP INDEX "payload_locked_documents_rels_members_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "members_id";
  DROP TYPE "public"."enum_orders_type";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_provider";
  DROP TYPE "public"."enum_orders_membership_type";
  DROP TYPE "public"."enum_members_membership_type";
  DROP TYPE "public"."enum_members_source";`)
}
