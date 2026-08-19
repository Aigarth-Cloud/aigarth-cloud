CREATE TABLE "billing_tissue_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"tissue_slug" text NOT NULL,
	"tissue_version" text NOT NULL,
	"tissue_listing_id" uuid,
	"state" integer NOT NULL,
	"cost_qubic" bigint NOT NULL,
	"request_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "billing_tissue_usage_user_idx" ON "billing_tissue_usage_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_tissue_usage_user_time_idx" ON "billing_tissue_usage_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "billing_tissue_usage_request_idx" ON "billing_tissue_usage_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "billing_tissue_usage_tissue_slug_idx" ON "billing_tissue_usage_events" USING btree ("tissue_slug");