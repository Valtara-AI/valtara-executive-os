CREATE TYPE "public"."delegate_invitation_status" AS ENUM('pending', 'accepted', 'declined', 'revoked');--> statement-breakpoint
CREATE TABLE "delegate_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"delegate_email" text NOT NULL,
	"status" "delegate_invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "delegate_links_executive_id_delegate_email_unique" UNIQUE("executive_id","delegate_email")
);
--> statement-breakpoint
ALTER TABLE "delegate_links" ADD CONSTRAINT "delegate_links_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;