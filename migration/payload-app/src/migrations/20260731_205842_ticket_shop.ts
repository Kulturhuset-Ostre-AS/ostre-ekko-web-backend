import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tickets_status" AS ENUM('valid', 'used', 'refunded');
  ALTER TYPE "public"."enum_orders_type" ADD VALUE 'ticket';
  CREATE TABLE "events_ticket_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"price_kr" numeric,
  	"quantity" numeric,
  	"on_sale" boolean DEFAULT true
  );
  
  CREATE TABLE "events_ticket_types_locales" (
  	"name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_events_v_version_ticket_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"price_kr" numeric,
  	"quantity" numeric,
  	"on_sale" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v_version_ticket_types_locales" (
  	"name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type_id" varchar NOT NULL,
  	"name" varchar,
  	"unit_price_ore" numeric NOT NULL,
  	"quantity" numeric NOT NULL
  );
  
  CREATE TABLE "customers_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "tickets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ticket_code" varchar NOT NULL,
  	"event_id" integer NOT NULL,
  	"type_id" varchar,
  	"type_name" varchar,
  	"price_ore" numeric,
  	"status" "enum_tickets_status" DEFAULT 'valid' NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"order_id" integer,
  	"customer_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "categories" ADD COLUMN "capacity" numeric;
  ALTER TABLE "orders" ADD COLUMN "customer_id" integer;
  ALTER TABLE "orders" ADD COLUMN "event_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tickets_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "customers_id" integer;
  ALTER TABLE "events_ticket_types" ADD CONSTRAINT "events_ticket_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_ticket_types_locales" ADD CONSTRAINT "events_ticket_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events_ticket_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_ticket_types" ADD CONSTRAINT "_events_v_version_ticket_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_ticket_types_locales" ADD CONSTRAINT "_events_v_version_ticket_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v_version_ticket_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_sessions" ADD CONSTRAINT "customers_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "events_ticket_types_order_idx" ON "events_ticket_types" USING btree ("_order");
  CREATE INDEX "events_ticket_types_parent_id_idx" ON "events_ticket_types" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "events_ticket_types_locales_locale_parent_id_unique" ON "events_ticket_types_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_events_v_version_ticket_types_order_idx" ON "_events_v_version_ticket_types" USING btree ("_order");
  CREATE INDEX "_events_v_version_ticket_types_parent_id_idx" ON "_events_v_version_ticket_types" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_events_v_version_ticket_types_locales_locale_parent_id_uniq" ON "_events_v_version_ticket_types_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE INDEX "customers_sessions_order_idx" ON "customers_sessions" USING btree ("_order");
  CREATE INDEX "customers_sessions_parent_id_idx" ON "customers_sessions" USING btree ("_parent_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE UNIQUE INDEX "tickets_ticket_code_idx" ON "tickets" USING btree ("ticket_code");
  CREATE INDEX "tickets_event_idx" ON "tickets" USING btree ("event_id");
  CREATE INDEX "tickets_type_id_idx" ON "tickets" USING btree ("type_id");
  CREATE INDEX "tickets_order_idx" ON "tickets" USING btree ("order_id");
  CREATE INDEX "tickets_customer_idx" ON "tickets" USING btree ("customer_id");
  CREATE INDEX "tickets_updated_at_idx" ON "tickets" USING btree ("updated_at");
  CREATE INDEX "tickets_created_at_idx" ON "tickets" USING btree ("created_at");
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tickets_fk" FOREIGN KEY ("tickets_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
  CREATE INDEX "orders_event_idx" ON "orders" USING btree ("event_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("tickets_id");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "events_ticket_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_ticket_types_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_ticket_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_ticket_types_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tickets" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "events_ticket_types" CASCADE;
  DROP TABLE "events_ticket_types_locales" CASCADE;
  DROP TABLE "_events_v_version_ticket_types" CASCADE;
  DROP TABLE "_events_v_version_ticket_types_locales" CASCADE;
  DROP TABLE "orders_items" CASCADE;
  DROP TABLE "customers_sessions" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "tickets" CASCADE;
  ALTER TABLE "orders" DROP CONSTRAINT "orders_customer_id_customers_id_fk";
  
  ALTER TABLE "orders" DROP CONSTRAINT "orders_event_id_events_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tickets_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_customers_fk";
  
  ALTER TABLE "orders" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "type" SET DEFAULT 'membership'::text;
  DROP TYPE "public"."enum_orders_type";
  CREATE TYPE "public"."enum_orders_type" AS ENUM('membership');
  ALTER TABLE "orders" ALTER COLUMN "type" SET DEFAULT 'membership'::"public"."enum_orders_type";
  ALTER TABLE "orders" ALTER COLUMN "type" SET DATA TYPE "public"."enum_orders_type" USING "type"::"public"."enum_orders_type";
  DROP INDEX "orders_customer_idx";
  DROP INDEX "orders_event_idx";
  DROP INDEX "payload_locked_documents_rels_customers_id_idx";
  DROP INDEX "payload_locked_documents_rels_tickets_id_idx";
  DROP INDEX "payload_preferences_rels_customers_id_idx";
  ALTER TABLE "categories" DROP COLUMN "capacity";
  ALTER TABLE "orders" DROP COLUMN "customer_id";
  ALTER TABLE "orders" DROP COLUMN "event_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tickets_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "customers_id";
  DROP TYPE "public"."enum_tickets_status";`)
}
