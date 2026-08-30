CREATE TYPE "public"."articulation_input_mode" AS ENUM('text', 'audio');--> statement-breakpoint
CREATE TYPE "public"."articulation_session_type" AS ENUM('speech', 'pitch', 'presentation', 'deal_close');--> statement-breakpoint
CREATE TYPE "public"."personal_dev_recommendation_status" AS ENUM('suggested', 'in_progress', 'completed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."personal_dev_recommendation_type" AS ENUM('book', 'podcast', 'publication');--> statement-breakpoint
CREATE TABLE "articulation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"session_type" "articulation_session_type" NOT NULL,
	"input_mode" "articulation_input_mode" NOT NULL,
	"input_text" text NOT NULL,
	"audio_storage_path" text,
	"audio_duration_seconds" integer,
	"feedback_json" jsonb NOT NULL,
	"clarity_score" integer NOT NULL,
	"structure_score" integer NOT NULL,
	"persuasiveness_score" integer NOT NULL,
	"tone_score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_development_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"type" "personal_dev_recommendation_type" NOT NULL,
	"title" text NOT NULL,
	"creator" text,
	"rationale" text NOT NULL,
	"status" "personal_dev_recommendation_status" DEFAULT 'suggested' NOT NULL,
	"recommended_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "articulation_sessions" ADD CONSTRAINT "articulation_sessions_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_development_recommendations" ADD CONSTRAINT "personal_development_recommendations_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;