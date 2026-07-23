import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_version_entry_type" AS ENUM('event', 'festival');
  CREATE TYPE "public"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_published_locale" AS ENUM('en', 'nb');
  CREATE TYPE "public"."enum_news_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__news_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__news_v_published_locale" AS ENUM('en', 'nb');
  CREATE TYPE "public"."enum_arena_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__arena_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__arena_v_published_locale" AS ENUM('en', 'nb');
  CREATE TYPE "public"."enum_artists_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__artists_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__artists_v_published_locale" AS ENUM('en', 'nb');
  CREATE TYPE "public"."enum_performance_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__performance_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__performance_v_published_locale" AS ENUM('en', 'nb');
  CREATE TABLE "_events_v_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_events_v_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_events_v_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_events_v_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_events_v_version_program" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"start_time" varchar,
  	"end_time" varchar,
  	"ticket_information" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v_version_tickets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar,
  	"subdescription" varchar,
  	"price" varchar,
  	"ticket_link" varchar,
  	"text_content" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v_version_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"section_body" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v_version_sections_locales" (
  	"section_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_craft_id" numeric,
  	"version_entry_type" "enum__events_v_version_entry_type" DEFAULT 'event',
  	"version_slug" varchar,
  	"version_event_featured_photo_id" integer,
  	"version_date" timestamp(3) with time zone,
  	"version_date_end" timestamp(3) with time zone,
  	"version_is_multi_day" boolean,
  	"version_single_page" boolean,
  	"version_show_artist_info" boolean,
  	"version_opening_time" varchar,
  	"version_closing_time" varchar,
  	"version_organizer_id" integer,
  	"version_layout" varchar,
  	"version_intro" jsonb,
  	"version_description" jsonb,
  	"version_ticket_link" varchar,
  	"version_ticket_description" jsonb,
  	"version_festival_color" varchar,
  	"version_festival_section_bg_color" varchar,
  	"version_festival_section_text_color" varchar,
  	"version_dark_mode" boolean,
  	"version_festival_link_invert" boolean,
  	"version_lineup" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__events_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_events_v_locales" (
  	"version_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_events_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"performance_id" integer,
  	"events_id" integer,
  	"media_id" integer,
  	"news_id" integer
  );
  
  CREATE TABLE "_news_v_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_news_v_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_news_v_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_news_v_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_news_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_craft_id" numeric,
  	"version_slug" varchar,
  	"version_post_date" timestamp(3) with time zone,
  	"version_news_photo_id" integer,
  	"version_page_photo_id" integer,
  	"version_intro" jsonb,
  	"version_news_content" jsonb,
  	"version_news_media_position" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__news_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__news_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_news_v_locales" (
  	"version_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_arena_v_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_arena_v_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_arena_v_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_arena_v_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_arena_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_craft_id" numeric,
  	"version_slug" varchar,
  	"version_artist_name" varchar,
  	"version_video_url" varchar,
  	"version_page_content" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__arena_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__arena_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_arena_v_locales" (
  	"version_title" varchar,
  	"version_project_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_arena_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"artists_id" integer
  );
  
  CREATE TABLE "_artists_v_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_artists_v_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_artists_v_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_artists_v_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_artists_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_craft_id" numeric,
  	"version_slug" varchar,
  	"version_artist_name" varchar,
  	"version_artist_meta" varchar,
  	"version_artist_featured_photo_id" integer,
  	"version_bio" jsonb,
  	"version_opening_times" varchar,
  	"version_is_featured" boolean,
  	"version_is_visible" boolean DEFAULT true,
  	"version_hide_more_link" boolean,
  	"version_order" numeric,
  	"version_parent_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__artists_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__artists_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_artists_v_locales" (
  	"version_title" varchar,
  	"version_short_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_artists_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"performance_id" integer
  );
  
  CREATE TABLE "_performance_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_craft_id" numeric,
  	"version_slug" varchar,
  	"version_date" timestamp(3) with time zone,
  	"version_time" varchar,
  	"version_time_end" varchar,
  	"version_order" numeric,
  	"version_parent_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__performance_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__performance_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_performance_v_locales" (
  	"version_title" varchar,
  	"version_full_title" varchar,
  	"version_ekstra_info" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_performance_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"artists_id" integer
  );
  
  ALTER TABLE "events" ALTER COLUMN "entry_type" DROP NOT NULL;
  ALTER TABLE "events" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "events_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "news_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "arena" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "arena_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "artists" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "artists_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "performance" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "performance_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "events" ADD COLUMN "_status" "enum_events_status" DEFAULT 'draft';
  ALTER TABLE "news" ADD COLUMN "_status" "enum_news_status" DEFAULT 'draft';
  ALTER TABLE "arena" ADD COLUMN "_status" "enum_arena_status" DEFAULT 'draft';
  ALTER TABLE "artists" ADD COLUMN "_status" "enum_artists_status" DEFAULT 'draft';
  ALTER TABLE "performance" ADD COLUMN "_status" "enum_performance_status" DEFAULT 'draft';
  ALTER TABLE "_events_v_blocks_text2" ADD CONSTRAINT "_events_v_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_blocks_video" ADD CONSTRAINT "_events_v_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_blocks_embed" ADD CONSTRAINT "_events_v_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_blocks_image_block" ADD CONSTRAINT "_events_v_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v_blocks_image_block" ADD CONSTRAINT "_events_v_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_program" ADD CONSTRAINT "_events_v_version_program_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_tickets" ADD CONSTRAINT "_events_v_version_tickets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_sections" ADD CONSTRAINT "_events_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_sections_locales" ADD CONSTRAINT "_events_v_version_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v_version_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_event_featured_photo_id_media_id_fk" FOREIGN KEY ("version_event_featured_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_organizer_id_categories_id_fk" FOREIGN KEY ("version_organizer_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v_locales" ADD CONSTRAINT "_events_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_rels" ADD CONSTRAINT "_events_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_rels" ADD CONSTRAINT "_events_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_rels" ADD CONSTRAINT "_events_v_rels_performance_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_rels" ADD CONSTRAINT "_events_v_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_rels" ADD CONSTRAINT "_events_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_rels" ADD CONSTRAINT "_events_v_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_blocks_text2" ADD CONSTRAINT "_news_v_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_blocks_video" ADD CONSTRAINT "_news_v_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_blocks_embed" ADD CONSTRAINT "_news_v_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_blocks_image_block" ADD CONSTRAINT "_news_v_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v_blocks_image_block" ADD CONSTRAINT "_news_v_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_parent_id_news_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_news_photo_id_media_id_fk" FOREIGN KEY ("version_news_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_page_photo_id_media_id_fk" FOREIGN KEY ("version_page_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v_locales" ADD CONSTRAINT "_news_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_arena_v_blocks_text2" ADD CONSTRAINT "_arena_v_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_arena_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_arena_v_blocks_video" ADD CONSTRAINT "_arena_v_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_arena_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_arena_v_blocks_embed" ADD CONSTRAINT "_arena_v_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_arena_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_arena_v_blocks_image_block" ADD CONSTRAINT "_arena_v_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_arena_v_blocks_image_block" ADD CONSTRAINT "_arena_v_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_arena_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_arena_v" ADD CONSTRAINT "_arena_v_parent_id_arena_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."arena"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_arena_v_locales" ADD CONSTRAINT "_arena_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_arena_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_arena_v_rels" ADD CONSTRAINT "_arena_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_arena_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_arena_v_rels" ADD CONSTRAINT "_arena_v_rels_artists_fk" FOREIGN KEY ("artists_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_artists_v_blocks_text2" ADD CONSTRAINT "_artists_v_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_artists_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_artists_v_blocks_video" ADD CONSTRAINT "_artists_v_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_artists_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_artists_v_blocks_embed" ADD CONSTRAINT "_artists_v_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_artists_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_artists_v_blocks_image_block" ADD CONSTRAINT "_artists_v_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_artists_v_blocks_image_block" ADD CONSTRAINT "_artists_v_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_artists_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_artists_v" ADD CONSTRAINT "_artists_v_parent_id_artists_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_artists_v" ADD CONSTRAINT "_artists_v_version_artist_featured_photo_id_media_id_fk" FOREIGN KEY ("version_artist_featured_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_artists_v" ADD CONSTRAINT "_artists_v_version_parent_id_artists_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_artists_v_locales" ADD CONSTRAINT "_artists_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_artists_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_artists_v_rels" ADD CONSTRAINT "_artists_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_artists_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_artists_v_rels" ADD CONSTRAINT "_artists_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_artists_v_rels" ADD CONSTRAINT "_artists_v_rels_performance_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_performance_v" ADD CONSTRAINT "_performance_v_parent_id_performance_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."performance"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_performance_v" ADD CONSTRAINT "_performance_v_version_parent_id_performance_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."performance"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_performance_v_locales" ADD CONSTRAINT "_performance_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_performance_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_performance_v_rels" ADD CONSTRAINT "_performance_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_performance_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_performance_v_rels" ADD CONSTRAINT "_performance_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_performance_v_rels" ADD CONSTRAINT "_performance_v_rels_artists_fk" FOREIGN KEY ("artists_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_events_v_blocks_text2_order_idx" ON "_events_v_blocks_text2" USING btree ("_order");
  CREATE INDEX "_events_v_blocks_text2_parent_id_idx" ON "_events_v_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "_events_v_blocks_text2_path_idx" ON "_events_v_blocks_text2" USING btree ("_path");
  CREATE INDEX "_events_v_blocks_video_order_idx" ON "_events_v_blocks_video" USING btree ("_order");
  CREATE INDEX "_events_v_blocks_video_parent_id_idx" ON "_events_v_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "_events_v_blocks_video_path_idx" ON "_events_v_blocks_video" USING btree ("_path");
  CREATE INDEX "_events_v_blocks_embed_order_idx" ON "_events_v_blocks_embed" USING btree ("_order");
  CREATE INDEX "_events_v_blocks_embed_parent_id_idx" ON "_events_v_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "_events_v_blocks_embed_path_idx" ON "_events_v_blocks_embed" USING btree ("_path");
  CREATE INDEX "_events_v_blocks_image_block_order_idx" ON "_events_v_blocks_image_block" USING btree ("_order");
  CREATE INDEX "_events_v_blocks_image_block_parent_id_idx" ON "_events_v_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "_events_v_blocks_image_block_path_idx" ON "_events_v_blocks_image_block" USING btree ("_path");
  CREATE INDEX "_events_v_blocks_image_block_image_idx" ON "_events_v_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "_events_v_version_program_order_idx" ON "_events_v_version_program" USING btree ("_order");
  CREATE INDEX "_events_v_version_program_parent_id_idx" ON "_events_v_version_program" USING btree ("_parent_id");
  CREATE INDEX "_events_v_version_tickets_order_idx" ON "_events_v_version_tickets" USING btree ("_order");
  CREATE INDEX "_events_v_version_tickets_parent_id_idx" ON "_events_v_version_tickets" USING btree ("_parent_id");
  CREATE INDEX "_events_v_version_sections_order_idx" ON "_events_v_version_sections" USING btree ("_order");
  CREATE INDEX "_events_v_version_sections_parent_id_idx" ON "_events_v_version_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_events_v_version_sections_locales_locale_parent_id_unique" ON "_events_v_version_sections_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_events_v_parent_idx" ON "_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_craft_id_idx" ON "_events_v" USING btree ("version_craft_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_version_event_featured_photo_idx" ON "_events_v" USING btree ("version_event_featured_photo_id");
  CREATE INDEX "_events_v_version_version_organizer_idx" ON "_events_v" USING btree ("version_organizer_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_snapshot_idx" ON "_events_v" USING btree ("snapshot");
  CREATE INDEX "_events_v_published_locale_idx" ON "_events_v" USING btree ("published_locale");
  CREATE INDEX "_events_v_latest_idx" ON "_events_v" USING btree ("latest");
  CREATE INDEX "_events_v_autosave_idx" ON "_events_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_events_v_locales_locale_parent_id_unique" ON "_events_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_events_v_rels_order_idx" ON "_events_v_rels" USING btree ("order");
  CREATE INDEX "_events_v_rels_parent_idx" ON "_events_v_rels" USING btree ("parent_id");
  CREATE INDEX "_events_v_rels_path_idx" ON "_events_v_rels" USING btree ("path");
  CREATE INDEX "_events_v_rels_categories_id_idx" ON "_events_v_rels" USING btree ("categories_id");
  CREATE INDEX "_events_v_rels_performance_id_idx" ON "_events_v_rels" USING btree ("performance_id");
  CREATE INDEX "_events_v_rels_events_id_idx" ON "_events_v_rels" USING btree ("events_id");
  CREATE INDEX "_events_v_rels_media_id_idx" ON "_events_v_rels" USING btree ("media_id");
  CREATE INDEX "_events_v_rels_news_id_idx" ON "_events_v_rels" USING btree ("news_id");
  CREATE INDEX "_news_v_blocks_text2_order_idx" ON "_news_v_blocks_text2" USING btree ("_order");
  CREATE INDEX "_news_v_blocks_text2_parent_id_idx" ON "_news_v_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "_news_v_blocks_text2_path_idx" ON "_news_v_blocks_text2" USING btree ("_path");
  CREATE INDEX "_news_v_blocks_video_order_idx" ON "_news_v_blocks_video" USING btree ("_order");
  CREATE INDEX "_news_v_blocks_video_parent_id_idx" ON "_news_v_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "_news_v_blocks_video_path_idx" ON "_news_v_blocks_video" USING btree ("_path");
  CREATE INDEX "_news_v_blocks_embed_order_idx" ON "_news_v_blocks_embed" USING btree ("_order");
  CREATE INDEX "_news_v_blocks_embed_parent_id_idx" ON "_news_v_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "_news_v_blocks_embed_path_idx" ON "_news_v_blocks_embed" USING btree ("_path");
  CREATE INDEX "_news_v_blocks_image_block_order_idx" ON "_news_v_blocks_image_block" USING btree ("_order");
  CREATE INDEX "_news_v_blocks_image_block_parent_id_idx" ON "_news_v_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "_news_v_blocks_image_block_path_idx" ON "_news_v_blocks_image_block" USING btree ("_path");
  CREATE INDEX "_news_v_blocks_image_block_image_idx" ON "_news_v_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "_news_v_parent_idx" ON "_news_v" USING btree ("parent_id");
  CREATE INDEX "_news_v_version_version_craft_id_idx" ON "_news_v" USING btree ("version_craft_id");
  CREATE INDEX "_news_v_version_version_slug_idx" ON "_news_v" USING btree ("version_slug");
  CREATE INDEX "_news_v_version_version_news_photo_idx" ON "_news_v" USING btree ("version_news_photo_id");
  CREATE INDEX "_news_v_version_version_page_photo_idx" ON "_news_v" USING btree ("version_page_photo_id");
  CREATE INDEX "_news_v_version_version_updated_at_idx" ON "_news_v" USING btree ("version_updated_at");
  CREATE INDEX "_news_v_version_version_created_at_idx" ON "_news_v" USING btree ("version_created_at");
  CREATE INDEX "_news_v_version_version__status_idx" ON "_news_v" USING btree ("version__status");
  CREATE INDEX "_news_v_created_at_idx" ON "_news_v" USING btree ("created_at");
  CREATE INDEX "_news_v_updated_at_idx" ON "_news_v" USING btree ("updated_at");
  CREATE INDEX "_news_v_snapshot_idx" ON "_news_v" USING btree ("snapshot");
  CREATE INDEX "_news_v_published_locale_idx" ON "_news_v" USING btree ("published_locale");
  CREATE INDEX "_news_v_latest_idx" ON "_news_v" USING btree ("latest");
  CREATE INDEX "_news_v_autosave_idx" ON "_news_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_news_v_locales_locale_parent_id_unique" ON "_news_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_arena_v_blocks_text2_order_idx" ON "_arena_v_blocks_text2" USING btree ("_order");
  CREATE INDEX "_arena_v_blocks_text2_parent_id_idx" ON "_arena_v_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "_arena_v_blocks_text2_path_idx" ON "_arena_v_blocks_text2" USING btree ("_path");
  CREATE INDEX "_arena_v_blocks_video_order_idx" ON "_arena_v_blocks_video" USING btree ("_order");
  CREATE INDEX "_arena_v_blocks_video_parent_id_idx" ON "_arena_v_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "_arena_v_blocks_video_path_idx" ON "_arena_v_blocks_video" USING btree ("_path");
  CREATE INDEX "_arena_v_blocks_embed_order_idx" ON "_arena_v_blocks_embed" USING btree ("_order");
  CREATE INDEX "_arena_v_blocks_embed_parent_id_idx" ON "_arena_v_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "_arena_v_blocks_embed_path_idx" ON "_arena_v_blocks_embed" USING btree ("_path");
  CREATE INDEX "_arena_v_blocks_image_block_order_idx" ON "_arena_v_blocks_image_block" USING btree ("_order");
  CREATE INDEX "_arena_v_blocks_image_block_parent_id_idx" ON "_arena_v_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "_arena_v_blocks_image_block_path_idx" ON "_arena_v_blocks_image_block" USING btree ("_path");
  CREATE INDEX "_arena_v_blocks_image_block_image_idx" ON "_arena_v_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "_arena_v_parent_idx" ON "_arena_v" USING btree ("parent_id");
  CREATE INDEX "_arena_v_version_version_craft_id_idx" ON "_arena_v" USING btree ("version_craft_id");
  CREATE INDEX "_arena_v_version_version_slug_idx" ON "_arena_v" USING btree ("version_slug");
  CREATE INDEX "_arena_v_version_version_updated_at_idx" ON "_arena_v" USING btree ("version_updated_at");
  CREATE INDEX "_arena_v_version_version_created_at_idx" ON "_arena_v" USING btree ("version_created_at");
  CREATE INDEX "_arena_v_version_version__status_idx" ON "_arena_v" USING btree ("version__status");
  CREATE INDEX "_arena_v_created_at_idx" ON "_arena_v" USING btree ("created_at");
  CREATE INDEX "_arena_v_updated_at_idx" ON "_arena_v" USING btree ("updated_at");
  CREATE INDEX "_arena_v_snapshot_idx" ON "_arena_v" USING btree ("snapshot");
  CREATE INDEX "_arena_v_published_locale_idx" ON "_arena_v" USING btree ("published_locale");
  CREATE INDEX "_arena_v_latest_idx" ON "_arena_v" USING btree ("latest");
  CREATE INDEX "_arena_v_autosave_idx" ON "_arena_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_arena_v_locales_locale_parent_id_unique" ON "_arena_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_arena_v_rels_order_idx" ON "_arena_v_rels" USING btree ("order");
  CREATE INDEX "_arena_v_rels_parent_idx" ON "_arena_v_rels" USING btree ("parent_id");
  CREATE INDEX "_arena_v_rels_path_idx" ON "_arena_v_rels" USING btree ("path");
  CREATE INDEX "_arena_v_rels_artists_id_idx" ON "_arena_v_rels" USING btree ("artists_id");
  CREATE INDEX "_artists_v_blocks_text2_order_idx" ON "_artists_v_blocks_text2" USING btree ("_order");
  CREATE INDEX "_artists_v_blocks_text2_parent_id_idx" ON "_artists_v_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "_artists_v_blocks_text2_path_idx" ON "_artists_v_blocks_text2" USING btree ("_path");
  CREATE INDEX "_artists_v_blocks_video_order_idx" ON "_artists_v_blocks_video" USING btree ("_order");
  CREATE INDEX "_artists_v_blocks_video_parent_id_idx" ON "_artists_v_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "_artists_v_blocks_video_path_idx" ON "_artists_v_blocks_video" USING btree ("_path");
  CREATE INDEX "_artists_v_blocks_embed_order_idx" ON "_artists_v_blocks_embed" USING btree ("_order");
  CREATE INDEX "_artists_v_blocks_embed_parent_id_idx" ON "_artists_v_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "_artists_v_blocks_embed_path_idx" ON "_artists_v_blocks_embed" USING btree ("_path");
  CREATE INDEX "_artists_v_blocks_image_block_order_idx" ON "_artists_v_blocks_image_block" USING btree ("_order");
  CREATE INDEX "_artists_v_blocks_image_block_parent_id_idx" ON "_artists_v_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "_artists_v_blocks_image_block_path_idx" ON "_artists_v_blocks_image_block" USING btree ("_path");
  CREATE INDEX "_artists_v_blocks_image_block_image_idx" ON "_artists_v_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "_artists_v_parent_idx" ON "_artists_v" USING btree ("parent_id");
  CREATE INDEX "_artists_v_version_version_craft_id_idx" ON "_artists_v" USING btree ("version_craft_id");
  CREATE INDEX "_artists_v_version_version_slug_idx" ON "_artists_v" USING btree ("version_slug");
  CREATE INDEX "_artists_v_version_version_artist_featured_photo_idx" ON "_artists_v" USING btree ("version_artist_featured_photo_id");
  CREATE INDEX "_artists_v_version_version_parent_idx" ON "_artists_v" USING btree ("version_parent_id");
  CREATE INDEX "_artists_v_version_version_updated_at_idx" ON "_artists_v" USING btree ("version_updated_at");
  CREATE INDEX "_artists_v_version_version_created_at_idx" ON "_artists_v" USING btree ("version_created_at");
  CREATE INDEX "_artists_v_version_version__status_idx" ON "_artists_v" USING btree ("version__status");
  CREATE INDEX "_artists_v_created_at_idx" ON "_artists_v" USING btree ("created_at");
  CREATE INDEX "_artists_v_updated_at_idx" ON "_artists_v" USING btree ("updated_at");
  CREATE INDEX "_artists_v_snapshot_idx" ON "_artists_v" USING btree ("snapshot");
  CREATE INDEX "_artists_v_published_locale_idx" ON "_artists_v" USING btree ("published_locale");
  CREATE INDEX "_artists_v_latest_idx" ON "_artists_v" USING btree ("latest");
  CREATE INDEX "_artists_v_autosave_idx" ON "_artists_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_artists_v_locales_locale_parent_id_unique" ON "_artists_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_artists_v_rels_order_idx" ON "_artists_v_rels" USING btree ("order");
  CREATE INDEX "_artists_v_rels_parent_idx" ON "_artists_v_rels" USING btree ("parent_id");
  CREATE INDEX "_artists_v_rels_path_idx" ON "_artists_v_rels" USING btree ("path");
  CREATE INDEX "_artists_v_rels_media_id_idx" ON "_artists_v_rels" USING btree ("media_id");
  CREATE INDEX "_artists_v_rels_performance_id_idx" ON "_artists_v_rels" USING btree ("performance_id");
  CREATE INDEX "_performance_v_parent_idx" ON "_performance_v" USING btree ("parent_id");
  CREATE INDEX "_performance_v_version_version_craft_id_idx" ON "_performance_v" USING btree ("version_craft_id");
  CREATE INDEX "_performance_v_version_version_slug_idx" ON "_performance_v" USING btree ("version_slug");
  CREATE INDEX "_performance_v_version_version_parent_idx" ON "_performance_v" USING btree ("version_parent_id");
  CREATE INDEX "_performance_v_version_version_updated_at_idx" ON "_performance_v" USING btree ("version_updated_at");
  CREATE INDEX "_performance_v_version_version_created_at_idx" ON "_performance_v" USING btree ("version_created_at");
  CREATE INDEX "_performance_v_version_version__status_idx" ON "_performance_v" USING btree ("version__status");
  CREATE INDEX "_performance_v_created_at_idx" ON "_performance_v" USING btree ("created_at");
  CREATE INDEX "_performance_v_updated_at_idx" ON "_performance_v" USING btree ("updated_at");
  CREATE INDEX "_performance_v_snapshot_idx" ON "_performance_v" USING btree ("snapshot");
  CREATE INDEX "_performance_v_published_locale_idx" ON "_performance_v" USING btree ("published_locale");
  CREATE INDEX "_performance_v_latest_idx" ON "_performance_v" USING btree ("latest");
  CREATE INDEX "_performance_v_autosave_idx" ON "_performance_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_performance_v_locales_locale_parent_id_unique" ON "_performance_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_performance_v_rels_order_idx" ON "_performance_v_rels" USING btree ("order");
  CREATE INDEX "_performance_v_rels_parent_idx" ON "_performance_v_rels" USING btree ("parent_id");
  CREATE INDEX "_performance_v_rels_path_idx" ON "_performance_v_rels" USING btree ("path");
  CREATE INDEX "_performance_v_rels_categories_id_idx" ON "_performance_v_rels" USING btree ("categories_id");
  CREATE INDEX "_performance_v_rels_artists_id_idx" ON "_performance_v_rels" USING btree ("artists_id");
  CREATE INDEX "events__status_idx" ON "events" USING btree ("_status");
  CREATE INDEX "news__status_idx" ON "news" USING btree ("_status");
  CREATE INDEX "arena__status_idx" ON "arena" USING btree ("_status");
  CREATE INDEX "artists__status_idx" ON "artists" USING btree ("_status");
  CREATE INDEX "performance__status_idx" ON "performance" USING btree ("_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_events_v_blocks_text2" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_blocks_video" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_blocks_embed" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_blocks_image_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_program" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_tickets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_sections_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_blocks_text2" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_blocks_video" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_blocks_embed" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_blocks_image_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_arena_v_blocks_text2" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_arena_v_blocks_video" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_arena_v_blocks_embed" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_arena_v_blocks_image_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_arena_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_arena_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_arena_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_artists_v_blocks_text2" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_artists_v_blocks_video" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_artists_v_blocks_embed" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_artists_v_blocks_image_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_artists_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_artists_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_artists_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_performance_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_performance_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_performance_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_events_v_blocks_text2" CASCADE;
  DROP TABLE "_events_v_blocks_video" CASCADE;
  DROP TABLE "_events_v_blocks_embed" CASCADE;
  DROP TABLE "_events_v_blocks_image_block" CASCADE;
  DROP TABLE "_events_v_version_program" CASCADE;
  DROP TABLE "_events_v_version_tickets" CASCADE;
  DROP TABLE "_events_v_version_sections" CASCADE;
  DROP TABLE "_events_v_version_sections_locales" CASCADE;
  DROP TABLE "_events_v" CASCADE;
  DROP TABLE "_events_v_locales" CASCADE;
  DROP TABLE "_events_v_rels" CASCADE;
  DROP TABLE "_news_v_blocks_text2" CASCADE;
  DROP TABLE "_news_v_blocks_video" CASCADE;
  DROP TABLE "_news_v_blocks_embed" CASCADE;
  DROP TABLE "_news_v_blocks_image_block" CASCADE;
  DROP TABLE "_news_v" CASCADE;
  DROP TABLE "_news_v_locales" CASCADE;
  DROP TABLE "_arena_v_blocks_text2" CASCADE;
  DROP TABLE "_arena_v_blocks_video" CASCADE;
  DROP TABLE "_arena_v_blocks_embed" CASCADE;
  DROP TABLE "_arena_v_blocks_image_block" CASCADE;
  DROP TABLE "_arena_v" CASCADE;
  DROP TABLE "_arena_v_locales" CASCADE;
  DROP TABLE "_arena_v_rels" CASCADE;
  DROP TABLE "_artists_v_blocks_text2" CASCADE;
  DROP TABLE "_artists_v_blocks_video" CASCADE;
  DROP TABLE "_artists_v_blocks_embed" CASCADE;
  DROP TABLE "_artists_v_blocks_image_block" CASCADE;
  DROP TABLE "_artists_v" CASCADE;
  DROP TABLE "_artists_v_locales" CASCADE;
  DROP TABLE "_artists_v_rels" CASCADE;
  DROP TABLE "_performance_v" CASCADE;
  DROP TABLE "_performance_v_locales" CASCADE;
  DROP TABLE "_performance_v_rels" CASCADE;
  DROP INDEX "events__status_idx";
  DROP INDEX "news__status_idx";
  DROP INDEX "arena__status_idx";
  DROP INDEX "artists__status_idx";
  DROP INDEX "performance__status_idx";
  ALTER TABLE "events" ALTER COLUMN "entry_type" SET NOT NULL;
  ALTER TABLE "events" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "events_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "news_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "arena" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "arena_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "artists" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "artists_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "performance" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "performance_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "events" DROP COLUMN "_status";
  ALTER TABLE "news" DROP COLUMN "_status";
  ALTER TABLE "arena" DROP COLUMN "_status";
  ALTER TABLE "artists" DROP COLUMN "_status";
  ALTER TABLE "performance" DROP COLUMN "_status";
  DROP TYPE "public"."enum_events_status";
  DROP TYPE "public"."enum__events_v_version_entry_type";
  DROP TYPE "public"."enum__events_v_version_status";
  DROP TYPE "public"."enum__events_v_published_locale";
  DROP TYPE "public"."enum_news_status";
  DROP TYPE "public"."enum__news_v_version_status";
  DROP TYPE "public"."enum__news_v_published_locale";
  DROP TYPE "public"."enum_arena_status";
  DROP TYPE "public"."enum__arena_v_version_status";
  DROP TYPE "public"."enum__arena_v_published_locale";
  DROP TYPE "public"."enum_artists_status";
  DROP TYPE "public"."enum__artists_v_version_status";
  DROP TYPE "public"."enum__artists_v_published_locale";
  DROP TYPE "public"."enum_performance_status";
  DROP TYPE "public"."enum__performance_v_version_status";
  DROP TYPE "public"."enum__performance_v_published_locale";`)
}
