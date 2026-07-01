import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'nb');
  CREATE TYPE "public"."enum_events_entry_type" AS ENUM('event', 'festival');
  CREATE TYPE "public"."enum_categories_group" AS ENUM('locations', 'organizers');
  CREATE TYPE "public"."enum_media_source" AS ENUM('artistPhotos', 'eventPhoto', 'mixtapes', 'userPhotos');
  CREATE TYPE "public"."enum_navigation_nodes_nav" AS ENUM('main', 'festival', 'ostre', 'footer');
  CREATE TYPE "public"."enum_navigation_nodes_node_type" AS ENUM('default', 'festival', 'ostre', 'about', 'toggle');
  CREATE TABLE "events_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "events_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "events_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "events_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "events_program" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"start_time" varchar,
  	"end_time" varchar,
  	"ticket_information" varchar
  );
  
  CREATE TABLE "events_tickets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar,
  	"subdescription" varchar,
  	"price" varchar,
  	"ticket_link" varchar,
  	"text_content" varchar
  );
  
  CREATE TABLE "events_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"section_body" jsonb
  );
  
  CREATE TABLE "events_sections_locales" (
  	"section_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"entry_type" "enum_events_entry_type" DEFAULT 'event' NOT NULL,
  	"slug" varchar NOT NULL,
  	"event_featured_photo_id" integer,
  	"date" timestamp(3) with time zone,
  	"date_end" timestamp(3) with time zone,
  	"is_multi_day" boolean,
  	"single_page" boolean,
  	"show_artist_info" boolean,
  	"opening_time" varchar,
  	"closing_time" varchar,
  	"organizer_id" integer,
  	"layout" varchar,
  	"intro" jsonb,
  	"description" jsonb,
  	"ticket_link" varchar,
  	"ticket_description" jsonb,
  	"festival_color" varchar,
  	"festival_section_bg_color" varchar,
  	"festival_section_text_color" varchar,
  	"dark_mode" boolean,
  	"festival_link_invert" boolean,
  	"lineup" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "events_locales" (
  	"title" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "events_rels" (
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
  
  CREATE TABLE "news_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "news_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "news_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "news_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "news" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"slug" varchar NOT NULL,
  	"post_date" timestamp(3) with time zone,
  	"news_photo_id" integer,
  	"page_photo_id" integer,
  	"intro" jsonb,
  	"news_content" jsonb,
  	"news_media_position" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "news_locales" (
  	"title" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "arena_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "arena_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "arena_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "arena_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "arena" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"slug" varchar NOT NULL,
  	"artist_name" varchar,
  	"video_url" varchar,
  	"page_content" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "arena_locales" (
  	"title" varchar NOT NULL,
  	"project_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "arena_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"artists_id" integer
  );
  
  CREATE TABLE "artists_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "artists_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "artists_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "artists_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "artists" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"slug" varchar NOT NULL,
  	"artist_name" varchar,
  	"artist_meta" varchar,
  	"artist_featured_photo_id" integer,
  	"bio" jsonb,
  	"opening_times" varchar,
  	"is_featured" boolean,
  	"is_visible" boolean DEFAULT true,
  	"hide_more_link" boolean,
  	"order" numeric,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "artists_locales" (
  	"title" varchar NOT NULL,
  	"short_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "artists_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"performance_id" integer
  );
  
  CREATE TABLE "performance" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"slug" varchar NOT NULL,
  	"date" timestamp(3) with time zone,
  	"time" varchar,
  	"time_end" varchar,
  	"order" numeric,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "performance_locales" (
  	"title" varchar NOT NULL,
  	"full_title" varchar,
  	"ekstra_info" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "performance_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"artists_id" integer
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"slug" varchar NOT NULL,
  	"group" "enum_categories_group" NOT NULL,
  	"venue" varchar,
  	"room" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_locales" (
  	"title" varchar NOT NULL,
  	"full_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags_locales" (
  	"title" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"alt" varchar,
  	"artist_name" varchar,
  	"ekstra_info" varchar,
  	"source" "enum_media_source",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_optimised_url" varchar,
  	"sizes_optimised_width" numeric,
  	"sizes_optimised_height" numeric,
  	"sizes_optimised_mime_type" varchar,
  	"sizes_optimised_filesize" numeric,
  	"sizes_optimised_filename" varchar,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar
  );
  
  CREATE TABLE "navigation_nodes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nav" "enum_navigation_nodes_nav" DEFAULT 'main' NOT NULL,
  	"order" numeric DEFAULT 0,
  	"parent_id" integer,
  	"url" varchar,
  	"new_window" boolean DEFAULT false,
  	"node_type" "enum_navigation_nodes_node_type" DEFAULT 'default',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "navigation_nodes_locales" (
  	"title" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "navigation_nodes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"events_id" integer,
  	"news_id" integer,
  	"artists_id" integer,
  	"arena_id" integer
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
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
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"events_id" integer,
  	"news_id" integer,
  	"arena_id" integer,
  	"artists_id" integer,
  	"performance_id" integer,
  	"categories_id" integer,
  	"tags_id" integer,
  	"media_id" integer,
  	"navigation_nodes_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_entry" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_entry_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"page_content" jsonb,
  	"contact" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "homepage_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "homepage_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"events_id" integer
  );
  
  CREATE TABLE "oestre_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "oestre_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "oestre_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "oestre_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "oestre_blocks_entry" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "oestre_blocks_entry_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "oestre" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"page_content" jsonb,
  	"contact" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "oestre_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "oestre_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"events_id" integer
  );
  
  CREATE TABLE "ekko_festival_info_blocks_text2" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "ekko_festival_info_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "ekko_festival_info_blocks_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "ekko_festival_info_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "ekko_festival_info_blocks_entry" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "ekko_festival_info_blocks_entry_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "ekko_festival_info" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"page_content" jsonb,
  	"contact" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "ekko_festival_info_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "ekko_festival_info_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"events_id" integer
  );
  
  CREATE TABLE "about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"page_content" jsonb,
  	"page_photo_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "about_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "legal" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"page_content" jsonb,
  	"page_photo_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "legal_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "archive" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"craft_id" numeric,
  	"page_content" jsonb,
  	"page_photo_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "archive_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "global_info" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contact" jsonb,
  	"footer" jsonb,
  	"social_facebook" varchar,
  	"social_instagram" varchar,
  	"social_twitter" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "global_info_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "events_blocks_text2" ADD CONSTRAINT "events_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_blocks_video" ADD CONSTRAINT "events_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_blocks_embed" ADD CONSTRAINT "events_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_blocks_image_block" ADD CONSTRAINT "events_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_blocks_image_block" ADD CONSTRAINT "events_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_program" ADD CONSTRAINT "events_program_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_tickets" ADD CONSTRAINT "events_tickets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_sections" ADD CONSTRAINT "events_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_sections_locales" ADD CONSTRAINT "events_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_event_featured_photo_id_media_id_fk" FOREIGN KEY ("event_featured_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_categories_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_locales" ADD CONSTRAINT "events_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_performance_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_blocks_text2" ADD CONSTRAINT "news_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_blocks_video" ADD CONSTRAINT "news_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_blocks_embed" ADD CONSTRAINT "news_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_blocks_image_block" ADD CONSTRAINT "news_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news_blocks_image_block" ADD CONSTRAINT "news_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_news_photo_id_media_id_fk" FOREIGN KEY ("news_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_page_photo_id_media_id_fk" FOREIGN KEY ("page_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news_locales" ADD CONSTRAINT "news_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arena_blocks_text2" ADD CONSTRAINT "arena_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."arena"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arena_blocks_video" ADD CONSTRAINT "arena_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."arena"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arena_blocks_embed" ADD CONSTRAINT "arena_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."arena"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arena_blocks_image_block" ADD CONSTRAINT "arena_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "arena_blocks_image_block" ADD CONSTRAINT "arena_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."arena"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arena_locales" ADD CONSTRAINT "arena_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."arena"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arena_rels" ADD CONSTRAINT "arena_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."arena"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arena_rels" ADD CONSTRAINT "arena_rels_artists_fk" FOREIGN KEY ("artists_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "artists_blocks_text2" ADD CONSTRAINT "artists_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "artists_blocks_video" ADD CONSTRAINT "artists_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "artists_blocks_embed" ADD CONSTRAINT "artists_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "artists_blocks_image_block" ADD CONSTRAINT "artists_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "artists_blocks_image_block" ADD CONSTRAINT "artists_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "artists" ADD CONSTRAINT "artists_artist_featured_photo_id_media_id_fk" FOREIGN KEY ("artist_featured_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "artists" ADD CONSTRAINT "artists_parent_id_artists_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "artists_locales" ADD CONSTRAINT "artists_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "artists_rels" ADD CONSTRAINT "artists_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "artists_rels" ADD CONSTRAINT "artists_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "artists_rels" ADD CONSTRAINT "artists_rels_performance_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "performance" ADD CONSTRAINT "performance_parent_id_performance_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."performance"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "performance_locales" ADD CONSTRAINT "performance_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "performance_rels" ADD CONSTRAINT "performance_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "performance_rels" ADD CONSTRAINT "performance_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "performance_rels" ADD CONSTRAINT "performance_rels_artists_fk" FOREIGN KEY ("artists_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_locales" ADD CONSTRAINT "tags_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_nodes" ADD CONSTRAINT "navigation_nodes_parent_id_navigation_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."navigation_nodes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navigation_nodes_locales" ADD CONSTRAINT "navigation_nodes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_nodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_nodes_rels" ADD CONSTRAINT "navigation_nodes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."navigation_nodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_nodes_rels" ADD CONSTRAINT "navigation_nodes_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_nodes_rels" ADD CONSTRAINT "navigation_nodes_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_nodes_rels" ADD CONSTRAINT "navigation_nodes_rels_artists_fk" FOREIGN KEY ("artists_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_nodes_rels" ADD CONSTRAINT "navigation_nodes_rels_arena_fk" FOREIGN KEY ("arena_id") REFERENCES "public"."arena"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_arena_fk" FOREIGN KEY ("arena_id") REFERENCES "public"."arena"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_artists_fk" FOREIGN KEY ("artists_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_performance_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_navigation_nodes_fk" FOREIGN KEY ("navigation_nodes_id") REFERENCES "public"."navigation_nodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_text2" ADD CONSTRAINT "homepage_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_video" ADD CONSTRAINT "homepage_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_embed" ADD CONSTRAINT "homepage_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_image_block" ADD CONSTRAINT "homepage_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_blocks_image_block" ADD CONSTRAINT "homepage_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_entry" ADD CONSTRAINT "homepage_blocks_entry_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_entry_locales" ADD CONSTRAINT "homepage_blocks_entry_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_entry"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_locales" ADD CONSTRAINT "homepage_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_rels" ADD CONSTRAINT "homepage_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_rels" ADD CONSTRAINT "homepage_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_rels" ADD CONSTRAINT "homepage_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_blocks_text2" ADD CONSTRAINT "oestre_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."oestre"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_blocks_video" ADD CONSTRAINT "oestre_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."oestre"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_blocks_embed" ADD CONSTRAINT "oestre_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."oestre"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_blocks_image_block" ADD CONSTRAINT "oestre_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oestre_blocks_image_block" ADD CONSTRAINT "oestre_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."oestre"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_blocks_entry" ADD CONSTRAINT "oestre_blocks_entry_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."oestre"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_blocks_entry_locales" ADD CONSTRAINT "oestre_blocks_entry_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."oestre_blocks_entry"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_locales" ADD CONSTRAINT "oestre_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."oestre"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_rels" ADD CONSTRAINT "oestre_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."oestre"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_rels" ADD CONSTRAINT "oestre_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oestre_rels" ADD CONSTRAINT "oestre_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_blocks_text2" ADD CONSTRAINT "ekko_festival_info_blocks_text2_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ekko_festival_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_blocks_video" ADD CONSTRAINT "ekko_festival_info_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ekko_festival_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_blocks_embed" ADD CONSTRAINT "ekko_festival_info_blocks_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ekko_festival_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_blocks_image_block" ADD CONSTRAINT "ekko_festival_info_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_blocks_image_block" ADD CONSTRAINT "ekko_festival_info_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ekko_festival_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_blocks_entry" ADD CONSTRAINT "ekko_festival_info_blocks_entry_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ekko_festival_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_blocks_entry_locales" ADD CONSTRAINT "ekko_festival_info_blocks_entry_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ekko_festival_info_blocks_entry"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_locales" ADD CONSTRAINT "ekko_festival_info_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ekko_festival_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_rels" ADD CONSTRAINT "ekko_festival_info_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ekko_festival_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_rels" ADD CONSTRAINT "ekko_festival_info_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ekko_festival_info_rels" ADD CONSTRAINT "ekko_festival_info_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_page_photo_id_media_id_fk" FOREIGN KEY ("page_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_locales" ADD CONSTRAINT "about_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal" ADD CONSTRAINT "legal_page_photo_id_media_id_fk" FOREIGN KEY ("page_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_locales" ADD CONSTRAINT "legal_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "archive" ADD CONSTRAINT "archive_page_photo_id_media_id_fk" FOREIGN KEY ("page_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "archive_locales" ADD CONSTRAINT "archive_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."archive"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "global_info_locales" ADD CONSTRAINT "global_info_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."global_info"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "events_blocks_text2_order_idx" ON "events_blocks_text2" USING btree ("_order");
  CREATE INDEX "events_blocks_text2_parent_id_idx" ON "events_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "events_blocks_text2_path_idx" ON "events_blocks_text2" USING btree ("_path");
  CREATE INDEX "events_blocks_video_order_idx" ON "events_blocks_video" USING btree ("_order");
  CREATE INDEX "events_blocks_video_parent_id_idx" ON "events_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "events_blocks_video_path_idx" ON "events_blocks_video" USING btree ("_path");
  CREATE INDEX "events_blocks_embed_order_idx" ON "events_blocks_embed" USING btree ("_order");
  CREATE INDEX "events_blocks_embed_parent_id_idx" ON "events_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "events_blocks_embed_path_idx" ON "events_blocks_embed" USING btree ("_path");
  CREATE INDEX "events_blocks_image_block_order_idx" ON "events_blocks_image_block" USING btree ("_order");
  CREATE INDEX "events_blocks_image_block_parent_id_idx" ON "events_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "events_blocks_image_block_path_idx" ON "events_blocks_image_block" USING btree ("_path");
  CREATE INDEX "events_blocks_image_block_image_idx" ON "events_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "events_program_order_idx" ON "events_program" USING btree ("_order");
  CREATE INDEX "events_program_parent_id_idx" ON "events_program" USING btree ("_parent_id");
  CREATE INDEX "events_tickets_order_idx" ON "events_tickets" USING btree ("_order");
  CREATE INDEX "events_tickets_parent_id_idx" ON "events_tickets" USING btree ("_parent_id");
  CREATE INDEX "events_sections_order_idx" ON "events_sections" USING btree ("_order");
  CREATE INDEX "events_sections_parent_id_idx" ON "events_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "events_sections_locales_locale_parent_id_unique" ON "events_sections_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_craft_id_idx" ON "events" USING btree ("craft_id");
  CREATE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX "events_event_featured_photo_idx" ON "events" USING btree ("event_featured_photo_id");
  CREATE INDEX "events_organizer_idx" ON "events" USING btree ("organizer_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE UNIQUE INDEX "events_locales_locale_parent_id_unique" ON "events_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_rels_order_idx" ON "events_rels" USING btree ("order");
  CREATE INDEX "events_rels_parent_idx" ON "events_rels" USING btree ("parent_id");
  CREATE INDEX "events_rels_path_idx" ON "events_rels" USING btree ("path");
  CREATE INDEX "events_rels_categories_id_idx" ON "events_rels" USING btree ("categories_id");
  CREATE INDEX "events_rels_performance_id_idx" ON "events_rels" USING btree ("performance_id");
  CREATE INDEX "events_rels_events_id_idx" ON "events_rels" USING btree ("events_id");
  CREATE INDEX "events_rels_media_id_idx" ON "events_rels" USING btree ("media_id");
  CREATE INDEX "events_rels_news_id_idx" ON "events_rels" USING btree ("news_id");
  CREATE INDEX "news_blocks_text2_order_idx" ON "news_blocks_text2" USING btree ("_order");
  CREATE INDEX "news_blocks_text2_parent_id_idx" ON "news_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "news_blocks_text2_path_idx" ON "news_blocks_text2" USING btree ("_path");
  CREATE INDEX "news_blocks_video_order_idx" ON "news_blocks_video" USING btree ("_order");
  CREATE INDEX "news_blocks_video_parent_id_idx" ON "news_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "news_blocks_video_path_idx" ON "news_blocks_video" USING btree ("_path");
  CREATE INDEX "news_blocks_embed_order_idx" ON "news_blocks_embed" USING btree ("_order");
  CREATE INDEX "news_blocks_embed_parent_id_idx" ON "news_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "news_blocks_embed_path_idx" ON "news_blocks_embed" USING btree ("_path");
  CREATE INDEX "news_blocks_image_block_order_idx" ON "news_blocks_image_block" USING btree ("_order");
  CREATE INDEX "news_blocks_image_block_parent_id_idx" ON "news_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "news_blocks_image_block_path_idx" ON "news_blocks_image_block" USING btree ("_path");
  CREATE INDEX "news_blocks_image_block_image_idx" ON "news_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "news_craft_id_idx" ON "news" USING btree ("craft_id");
  CREATE INDEX "news_slug_idx" ON "news" USING btree ("slug");
  CREATE INDEX "news_news_photo_idx" ON "news" USING btree ("news_photo_id");
  CREATE INDEX "news_page_photo_idx" ON "news" USING btree ("page_photo_id");
  CREATE INDEX "news_updated_at_idx" ON "news" USING btree ("updated_at");
  CREATE INDEX "news_created_at_idx" ON "news" USING btree ("created_at");
  CREATE UNIQUE INDEX "news_locales_locale_parent_id_unique" ON "news_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "arena_blocks_text2_order_idx" ON "arena_blocks_text2" USING btree ("_order");
  CREATE INDEX "arena_blocks_text2_parent_id_idx" ON "arena_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "arena_blocks_text2_path_idx" ON "arena_blocks_text2" USING btree ("_path");
  CREATE INDEX "arena_blocks_video_order_idx" ON "arena_blocks_video" USING btree ("_order");
  CREATE INDEX "arena_blocks_video_parent_id_idx" ON "arena_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "arena_blocks_video_path_idx" ON "arena_blocks_video" USING btree ("_path");
  CREATE INDEX "arena_blocks_embed_order_idx" ON "arena_blocks_embed" USING btree ("_order");
  CREATE INDEX "arena_blocks_embed_parent_id_idx" ON "arena_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "arena_blocks_embed_path_idx" ON "arena_blocks_embed" USING btree ("_path");
  CREATE INDEX "arena_blocks_image_block_order_idx" ON "arena_blocks_image_block" USING btree ("_order");
  CREATE INDEX "arena_blocks_image_block_parent_id_idx" ON "arena_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "arena_blocks_image_block_path_idx" ON "arena_blocks_image_block" USING btree ("_path");
  CREATE INDEX "arena_blocks_image_block_image_idx" ON "arena_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "arena_craft_id_idx" ON "arena" USING btree ("craft_id");
  CREATE INDEX "arena_slug_idx" ON "arena" USING btree ("slug");
  CREATE INDEX "arena_updated_at_idx" ON "arena" USING btree ("updated_at");
  CREATE INDEX "arena_created_at_idx" ON "arena" USING btree ("created_at");
  CREATE UNIQUE INDEX "arena_locales_locale_parent_id_unique" ON "arena_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "arena_rels_order_idx" ON "arena_rels" USING btree ("order");
  CREATE INDEX "arena_rels_parent_idx" ON "arena_rels" USING btree ("parent_id");
  CREATE INDEX "arena_rels_path_idx" ON "arena_rels" USING btree ("path");
  CREATE INDEX "arena_rels_artists_id_idx" ON "arena_rels" USING btree ("artists_id");
  CREATE INDEX "artists_blocks_text2_order_idx" ON "artists_blocks_text2" USING btree ("_order");
  CREATE INDEX "artists_blocks_text2_parent_id_idx" ON "artists_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "artists_blocks_text2_path_idx" ON "artists_blocks_text2" USING btree ("_path");
  CREATE INDEX "artists_blocks_video_order_idx" ON "artists_blocks_video" USING btree ("_order");
  CREATE INDEX "artists_blocks_video_parent_id_idx" ON "artists_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "artists_blocks_video_path_idx" ON "artists_blocks_video" USING btree ("_path");
  CREATE INDEX "artists_blocks_embed_order_idx" ON "artists_blocks_embed" USING btree ("_order");
  CREATE INDEX "artists_blocks_embed_parent_id_idx" ON "artists_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "artists_blocks_embed_path_idx" ON "artists_blocks_embed" USING btree ("_path");
  CREATE INDEX "artists_blocks_image_block_order_idx" ON "artists_blocks_image_block" USING btree ("_order");
  CREATE INDEX "artists_blocks_image_block_parent_id_idx" ON "artists_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "artists_blocks_image_block_path_idx" ON "artists_blocks_image_block" USING btree ("_path");
  CREATE INDEX "artists_blocks_image_block_image_idx" ON "artists_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "artists_craft_id_idx" ON "artists" USING btree ("craft_id");
  CREATE INDEX "artists_slug_idx" ON "artists" USING btree ("slug");
  CREATE INDEX "artists_artist_featured_photo_idx" ON "artists" USING btree ("artist_featured_photo_id");
  CREATE INDEX "artists_parent_idx" ON "artists" USING btree ("parent_id");
  CREATE INDEX "artists_updated_at_idx" ON "artists" USING btree ("updated_at");
  CREATE INDEX "artists_created_at_idx" ON "artists" USING btree ("created_at");
  CREATE UNIQUE INDEX "artists_locales_locale_parent_id_unique" ON "artists_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "artists_rels_order_idx" ON "artists_rels" USING btree ("order");
  CREATE INDEX "artists_rels_parent_idx" ON "artists_rels" USING btree ("parent_id");
  CREATE INDEX "artists_rels_path_idx" ON "artists_rels" USING btree ("path");
  CREATE INDEX "artists_rels_media_id_idx" ON "artists_rels" USING btree ("media_id");
  CREATE INDEX "artists_rels_performance_id_idx" ON "artists_rels" USING btree ("performance_id");
  CREATE INDEX "performance_craft_id_idx" ON "performance" USING btree ("craft_id");
  CREATE INDEX "performance_slug_idx" ON "performance" USING btree ("slug");
  CREATE INDEX "performance_parent_idx" ON "performance" USING btree ("parent_id");
  CREATE INDEX "performance_updated_at_idx" ON "performance" USING btree ("updated_at");
  CREATE INDEX "performance_created_at_idx" ON "performance" USING btree ("created_at");
  CREATE UNIQUE INDEX "performance_locales_locale_parent_id_unique" ON "performance_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "performance_rels_order_idx" ON "performance_rels" USING btree ("order");
  CREATE INDEX "performance_rels_parent_idx" ON "performance_rels" USING btree ("parent_id");
  CREATE INDEX "performance_rels_path_idx" ON "performance_rels" USING btree ("path");
  CREATE INDEX "performance_rels_categories_id_idx" ON "performance_rels" USING btree ("categories_id");
  CREATE INDEX "performance_rels_artists_id_idx" ON "performance_rels" USING btree ("artists_id");
  CREATE INDEX "categories_craft_id_idx" ON "categories" USING btree ("craft_id");
  CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "categories_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "tags_craft_id_idx" ON "tags" USING btree ("craft_id");
  CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE UNIQUE INDEX "tags_locales_locale_parent_id_unique" ON "tags_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_craft_id_idx" ON "media" USING btree ("craft_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_optimised_sizes_optimised_filename_idx" ON "media" USING btree ("sizes_optimised_filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "navigation_nodes_parent_idx" ON "navigation_nodes" USING btree ("parent_id");
  CREATE INDEX "navigation_nodes_updated_at_idx" ON "navigation_nodes" USING btree ("updated_at");
  CREATE INDEX "navigation_nodes_created_at_idx" ON "navigation_nodes" USING btree ("created_at");
  CREATE UNIQUE INDEX "navigation_nodes_locales_locale_parent_id_unique" ON "navigation_nodes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "navigation_nodes_rels_order_idx" ON "navigation_nodes_rels" USING btree ("order");
  CREATE INDEX "navigation_nodes_rels_parent_idx" ON "navigation_nodes_rels" USING btree ("parent_id");
  CREATE INDEX "navigation_nodes_rels_path_idx" ON "navigation_nodes_rels" USING btree ("path");
  CREATE INDEX "navigation_nodes_rels_events_id_idx" ON "navigation_nodes_rels" USING btree ("events_id");
  CREATE INDEX "navigation_nodes_rels_news_id_idx" ON "navigation_nodes_rels" USING btree ("news_id");
  CREATE INDEX "navigation_nodes_rels_artists_id_idx" ON "navigation_nodes_rels" USING btree ("artists_id");
  CREATE INDEX "navigation_nodes_rels_arena_id_idx" ON "navigation_nodes_rels" USING btree ("arena_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_news_id_idx" ON "payload_locked_documents_rels" USING btree ("news_id");
  CREATE INDEX "payload_locked_documents_rels_arena_id_idx" ON "payload_locked_documents_rels" USING btree ("arena_id");
  CREATE INDEX "payload_locked_documents_rels_artists_id_idx" ON "payload_locked_documents_rels" USING btree ("artists_id");
  CREATE INDEX "payload_locked_documents_rels_performance_id_idx" ON "payload_locked_documents_rels" USING btree ("performance_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_navigation_nodes_id_idx" ON "payload_locked_documents_rels" USING btree ("navigation_nodes_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "homepage_blocks_text2_order_idx" ON "homepage_blocks_text2" USING btree ("_order");
  CREATE INDEX "homepage_blocks_text2_parent_id_idx" ON "homepage_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_text2_path_idx" ON "homepage_blocks_text2" USING btree ("_path");
  CREATE INDEX "homepage_blocks_video_order_idx" ON "homepage_blocks_video" USING btree ("_order");
  CREATE INDEX "homepage_blocks_video_parent_id_idx" ON "homepage_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_video_path_idx" ON "homepage_blocks_video" USING btree ("_path");
  CREATE INDEX "homepage_blocks_embed_order_idx" ON "homepage_blocks_embed" USING btree ("_order");
  CREATE INDEX "homepage_blocks_embed_parent_id_idx" ON "homepage_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_embed_path_idx" ON "homepage_blocks_embed" USING btree ("_path");
  CREATE INDEX "homepage_blocks_image_block_order_idx" ON "homepage_blocks_image_block" USING btree ("_order");
  CREATE INDEX "homepage_blocks_image_block_parent_id_idx" ON "homepage_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_image_block_path_idx" ON "homepage_blocks_image_block" USING btree ("_path");
  CREATE INDEX "homepage_blocks_image_block_image_idx" ON "homepage_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "homepage_blocks_entry_order_idx" ON "homepage_blocks_entry" USING btree ("_order");
  CREATE INDEX "homepage_blocks_entry_parent_id_idx" ON "homepage_blocks_entry" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_entry_path_idx" ON "homepage_blocks_entry" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_entry_locales_locale_parent_id_unique" ON "homepage_blocks_entry_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "homepage_locales_locale_parent_id_unique" ON "homepage_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_rels_order_idx" ON "homepage_rels" USING btree ("order");
  CREATE INDEX "homepage_rels_parent_idx" ON "homepage_rels" USING btree ("parent_id");
  CREATE INDEX "homepage_rels_path_idx" ON "homepage_rels" USING btree ("path");
  CREATE INDEX "homepage_rels_media_id_idx" ON "homepage_rels" USING btree ("media_id");
  CREATE INDEX "homepage_rels_events_id_idx" ON "homepage_rels" USING btree ("events_id");
  CREATE INDEX "oestre_blocks_text2_order_idx" ON "oestre_blocks_text2" USING btree ("_order");
  CREATE INDEX "oestre_blocks_text2_parent_id_idx" ON "oestre_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "oestre_blocks_text2_path_idx" ON "oestre_blocks_text2" USING btree ("_path");
  CREATE INDEX "oestre_blocks_video_order_idx" ON "oestre_blocks_video" USING btree ("_order");
  CREATE INDEX "oestre_blocks_video_parent_id_idx" ON "oestre_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "oestre_blocks_video_path_idx" ON "oestre_blocks_video" USING btree ("_path");
  CREATE INDEX "oestre_blocks_embed_order_idx" ON "oestre_blocks_embed" USING btree ("_order");
  CREATE INDEX "oestre_blocks_embed_parent_id_idx" ON "oestre_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "oestre_blocks_embed_path_idx" ON "oestre_blocks_embed" USING btree ("_path");
  CREATE INDEX "oestre_blocks_image_block_order_idx" ON "oestre_blocks_image_block" USING btree ("_order");
  CREATE INDEX "oestre_blocks_image_block_parent_id_idx" ON "oestre_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "oestre_blocks_image_block_path_idx" ON "oestre_blocks_image_block" USING btree ("_path");
  CREATE INDEX "oestre_blocks_image_block_image_idx" ON "oestre_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "oestre_blocks_entry_order_idx" ON "oestre_blocks_entry" USING btree ("_order");
  CREATE INDEX "oestre_blocks_entry_parent_id_idx" ON "oestre_blocks_entry" USING btree ("_parent_id");
  CREATE INDEX "oestre_blocks_entry_path_idx" ON "oestre_blocks_entry" USING btree ("_path");
  CREATE UNIQUE INDEX "oestre_blocks_entry_locales_locale_parent_id_unique" ON "oestre_blocks_entry_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "oestre_locales_locale_parent_id_unique" ON "oestre_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "oestre_rels_order_idx" ON "oestre_rels" USING btree ("order");
  CREATE INDEX "oestre_rels_parent_idx" ON "oestre_rels" USING btree ("parent_id");
  CREATE INDEX "oestre_rels_path_idx" ON "oestre_rels" USING btree ("path");
  CREATE INDEX "oestre_rels_media_id_idx" ON "oestre_rels" USING btree ("media_id");
  CREATE INDEX "oestre_rels_events_id_idx" ON "oestre_rels" USING btree ("events_id");
  CREATE INDEX "ekko_festival_info_blocks_text2_order_idx" ON "ekko_festival_info_blocks_text2" USING btree ("_order");
  CREATE INDEX "ekko_festival_info_blocks_text2_parent_id_idx" ON "ekko_festival_info_blocks_text2" USING btree ("_parent_id");
  CREATE INDEX "ekko_festival_info_blocks_text2_path_idx" ON "ekko_festival_info_blocks_text2" USING btree ("_path");
  CREATE INDEX "ekko_festival_info_blocks_video_order_idx" ON "ekko_festival_info_blocks_video" USING btree ("_order");
  CREATE INDEX "ekko_festival_info_blocks_video_parent_id_idx" ON "ekko_festival_info_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "ekko_festival_info_blocks_video_path_idx" ON "ekko_festival_info_blocks_video" USING btree ("_path");
  CREATE INDEX "ekko_festival_info_blocks_embed_order_idx" ON "ekko_festival_info_blocks_embed" USING btree ("_order");
  CREATE INDEX "ekko_festival_info_blocks_embed_parent_id_idx" ON "ekko_festival_info_blocks_embed" USING btree ("_parent_id");
  CREATE INDEX "ekko_festival_info_blocks_embed_path_idx" ON "ekko_festival_info_blocks_embed" USING btree ("_path");
  CREATE INDEX "ekko_festival_info_blocks_image_block_order_idx" ON "ekko_festival_info_blocks_image_block" USING btree ("_order");
  CREATE INDEX "ekko_festival_info_blocks_image_block_parent_id_idx" ON "ekko_festival_info_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "ekko_festival_info_blocks_image_block_path_idx" ON "ekko_festival_info_blocks_image_block" USING btree ("_path");
  CREATE INDEX "ekko_festival_info_blocks_image_block_image_idx" ON "ekko_festival_info_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "ekko_festival_info_blocks_entry_order_idx" ON "ekko_festival_info_blocks_entry" USING btree ("_order");
  CREATE INDEX "ekko_festival_info_blocks_entry_parent_id_idx" ON "ekko_festival_info_blocks_entry" USING btree ("_parent_id");
  CREATE INDEX "ekko_festival_info_blocks_entry_path_idx" ON "ekko_festival_info_blocks_entry" USING btree ("_path");
  CREATE UNIQUE INDEX "ekko_festival_info_blocks_entry_locales_locale_parent_id_uni" ON "ekko_festival_info_blocks_entry_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "ekko_festival_info_locales_locale_parent_id_unique" ON "ekko_festival_info_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "ekko_festival_info_rels_order_idx" ON "ekko_festival_info_rels" USING btree ("order");
  CREATE INDEX "ekko_festival_info_rels_parent_idx" ON "ekko_festival_info_rels" USING btree ("parent_id");
  CREATE INDEX "ekko_festival_info_rels_path_idx" ON "ekko_festival_info_rels" USING btree ("path");
  CREATE INDEX "ekko_festival_info_rels_media_id_idx" ON "ekko_festival_info_rels" USING btree ("media_id");
  CREATE INDEX "ekko_festival_info_rels_events_id_idx" ON "ekko_festival_info_rels" USING btree ("events_id");
  CREATE INDEX "about_page_photo_idx" ON "about" USING btree ("page_photo_id");
  CREATE UNIQUE INDEX "about_locales_locale_parent_id_unique" ON "about_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "legal_page_photo_idx" ON "legal" USING btree ("page_photo_id");
  CREATE UNIQUE INDEX "legal_locales_locale_parent_id_unique" ON "legal_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "archive_page_photo_idx" ON "archive" USING btree ("page_photo_id");
  CREATE UNIQUE INDEX "archive_locales_locale_parent_id_unique" ON "archive_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "global_info_locales_locale_parent_id_unique" ON "global_info_locales" USING btree ("_locale","_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "events_blocks_text2" CASCADE;
  DROP TABLE "events_blocks_video" CASCADE;
  DROP TABLE "events_blocks_embed" CASCADE;
  DROP TABLE "events_blocks_image_block" CASCADE;
  DROP TABLE "events_program" CASCADE;
  DROP TABLE "events_tickets" CASCADE;
  DROP TABLE "events_sections" CASCADE;
  DROP TABLE "events_sections_locales" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "events_locales" CASCADE;
  DROP TABLE "events_rels" CASCADE;
  DROP TABLE "news_blocks_text2" CASCADE;
  DROP TABLE "news_blocks_video" CASCADE;
  DROP TABLE "news_blocks_embed" CASCADE;
  DROP TABLE "news_blocks_image_block" CASCADE;
  DROP TABLE "news" CASCADE;
  DROP TABLE "news_locales" CASCADE;
  DROP TABLE "arena_blocks_text2" CASCADE;
  DROP TABLE "arena_blocks_video" CASCADE;
  DROP TABLE "arena_blocks_embed" CASCADE;
  DROP TABLE "arena_blocks_image_block" CASCADE;
  DROP TABLE "arena" CASCADE;
  DROP TABLE "arena_locales" CASCADE;
  DROP TABLE "arena_rels" CASCADE;
  DROP TABLE "artists_blocks_text2" CASCADE;
  DROP TABLE "artists_blocks_video" CASCADE;
  DROP TABLE "artists_blocks_embed" CASCADE;
  DROP TABLE "artists_blocks_image_block" CASCADE;
  DROP TABLE "artists" CASCADE;
  DROP TABLE "artists_locales" CASCADE;
  DROP TABLE "artists_rels" CASCADE;
  DROP TABLE "performance" CASCADE;
  DROP TABLE "performance_locales" CASCADE;
  DROP TABLE "performance_rels" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_locales" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "tags_locales" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "navigation_nodes" CASCADE;
  DROP TABLE "navigation_nodes_locales" CASCADE;
  DROP TABLE "navigation_nodes_rels" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "homepage_blocks_text2" CASCADE;
  DROP TABLE "homepage_blocks_video" CASCADE;
  DROP TABLE "homepage_blocks_embed" CASCADE;
  DROP TABLE "homepage_blocks_image_block" CASCADE;
  DROP TABLE "homepage_blocks_entry" CASCADE;
  DROP TABLE "homepage_blocks_entry_locales" CASCADE;
  DROP TABLE "homepage" CASCADE;
  DROP TABLE "homepage_locales" CASCADE;
  DROP TABLE "homepage_rels" CASCADE;
  DROP TABLE "oestre_blocks_text2" CASCADE;
  DROP TABLE "oestre_blocks_video" CASCADE;
  DROP TABLE "oestre_blocks_embed" CASCADE;
  DROP TABLE "oestre_blocks_image_block" CASCADE;
  DROP TABLE "oestre_blocks_entry" CASCADE;
  DROP TABLE "oestre_blocks_entry_locales" CASCADE;
  DROP TABLE "oestre" CASCADE;
  DROP TABLE "oestre_locales" CASCADE;
  DROP TABLE "oestre_rels" CASCADE;
  DROP TABLE "ekko_festival_info_blocks_text2" CASCADE;
  DROP TABLE "ekko_festival_info_blocks_video" CASCADE;
  DROP TABLE "ekko_festival_info_blocks_embed" CASCADE;
  DROP TABLE "ekko_festival_info_blocks_image_block" CASCADE;
  DROP TABLE "ekko_festival_info_blocks_entry" CASCADE;
  DROP TABLE "ekko_festival_info_blocks_entry_locales" CASCADE;
  DROP TABLE "ekko_festival_info" CASCADE;
  DROP TABLE "ekko_festival_info_locales" CASCADE;
  DROP TABLE "ekko_festival_info_rels" CASCADE;
  DROP TABLE "about" CASCADE;
  DROP TABLE "about_locales" CASCADE;
  DROP TABLE "legal" CASCADE;
  DROP TABLE "legal_locales" CASCADE;
  DROP TABLE "archive" CASCADE;
  DROP TABLE "archive_locales" CASCADE;
  DROP TABLE "global_info" CASCADE;
  DROP TABLE "global_info_locales" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_events_entry_type";
  DROP TYPE "public"."enum_categories_group";
  DROP TYPE "public"."enum_media_source";
  DROP TYPE "public"."enum_navigation_nodes_nav";
  DROP TYPE "public"."enum_navigation_nodes_node_type";`)
}
