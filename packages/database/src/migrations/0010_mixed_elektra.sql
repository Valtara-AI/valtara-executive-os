CREATE TABLE "portfolio_watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_watchlist_items" ADD CONSTRAINT "portfolio_watchlist_items_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE cascade ON UPDATE no action;