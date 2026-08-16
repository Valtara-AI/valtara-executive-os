CREATE TYPE "public"."agent_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."hitl_mode" AS ENUM('auto_draft_review', 'checkpoint', 'autonomous_report');--> statement-breakpoint
CREATE TYPE "public"."hitl_status" AS ENUM('pending', 'approved', 'edited', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."onboarding_session_status" AS ENUM('in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('not_started', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('queued', 'in_progress', 'at_checkpoint', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hitl_mode" "hitl_mode" DEFAULT 'auto_draft_review' NOT NULL,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"input_hash" text,
	"output_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prev_hash" text,
	"record_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"organization" text,
	"title" text,
	"domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"onboarding_status" "onboarding_status" DEFAULT 'not_started' NOT NULL,
	"voice_profile_id" uuid,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "executives_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "external_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"hitl_queue_item_id" uuid NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hitl_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_output_id" uuid,
	"executive_id" uuid NOT NULL,
	"status" "hitl_status" DEFAULT 'pending' NOT NULL,
	"original_output" text NOT NULL,
	"final_output" text,
	"rejection_reason" text,
	"actioned_at" timestamp with time zone,
	"actioned_by" uuid
);
--> statement-breakpoint
CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"tone" text,
	"formality" text,
	"sentence_length" text,
	"vocabulary_level" text,
	"salutations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"structural_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executive_intelligence_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"time_drains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delegation_candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"communication_style" text,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"executive_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"status" "task_status" DEFAULT 'queued' NOT NULL,
	"context_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"model_provider" text NOT NULL,
	"model_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"output_text" text NOT NULL,
	"tokens_input" integer NOT NULL,
	"tokens_output" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"hitl_status" "hitl_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "morning_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"date" date NOT NULL,
	"content" text NOT NULL,
	"sections_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integration_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"status" "onboarding_session_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_token_revocations" (
	"token_id" uuid PRIMARY KEY NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_actions" ADD CONSTRAINT "external_actions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_actions" ADD CONSTRAINT "external_actions_hitl_queue_item_id_hitl_queue_items_id_fk" FOREIGN KEY ("hitl_queue_item_id") REFERENCES "public"."hitl_queue_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_queue_items" ADD CONSTRAINT "hitl_queue_items_task_output_id_task_outputs_id_fk" FOREIGN KEY ("task_output_id") REFERENCES "public"."task_outputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_queue_items" ADD CONSTRAINT "hitl_queue_items_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_queue_items" ADD CONSTRAINT "hitl_queue_items_actioned_by_executives_id_fk" FOREIGN KEY ("actioned_by") REFERENCES "public"."executives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_intelligence_profiles" ADD CONSTRAINT "executive_intelligence_profiles_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_outputs" ADD CONSTRAINT "task_outputs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morning_briefs" ADD CONSTRAINT "morning_briefs_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_tokens" ADD CONSTRAINT "integration_tokens_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;