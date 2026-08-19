CREATE TABLE "billing_organism_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"organism_slug" text NOT NULL,
	"organism_listing_id" uuid,
	"child_organism_slug" text,
	"parent_generation" integer DEFAULT 0 NOT NULL,
	"cost_qubic" bigint NOT NULL,
	"request_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "billing_organism_usage_user_idx" ON "billing_organism_usage_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_organism_usage_user_time_idx" ON "billing_organism_usage_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "billing_organism_usage_request_idx" ON "billing_organism_usage_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "billing_organism_usage_organism_slug_idx" ON "billing_organism_usage_events" USING btree ("organism_slug");--> statement-breakpoint
CREATE INDEX "billing_organism_usage_listing_idx" ON "billing_organism_usage_events" USING btree ("organism_listing_id");