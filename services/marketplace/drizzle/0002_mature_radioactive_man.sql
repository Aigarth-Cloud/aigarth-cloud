CREATE TYPE "public"."mkt_tissue_access" AS ENUM('open', 'licensed');--> statement-breakpoint
CREATE TABLE "mkt_tissue_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"seller_org_id" uuid,
	"seller_name" text NOT NULL,
	"tissue_slug" text NOT NULL,
	"tissue_id" uuid,
	"tissue_version" text NOT NULL,
	"tissue_name" text NOT NULL,
	"price_per_decision_qubic" bigint NOT NULL,
	"access" "mkt_tissue_access" DEFAULT 'open' NOT NULL,
	"status" "mkt_listing_status" DEFAULT 'draft' NOT NULL,
	"visibility" "mkt_listing_visibility" DEFAULT 'public' NOT NULL,
	"total_decisions" bigint DEFAULT 0 NOT NULL,
	"total_revenue_qubic" bigint DEFAULT 0 NOT NULL,
	"rating_average" text,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mkt_tissue_listings_slug_idx" ON "mkt_tissue_listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "mkt_tissue_listings_status_idx" ON "mkt_tissue_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mkt_tissue_listings_visibility_idx" ON "mkt_tissue_listings" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "mkt_tissue_listings_seller_idx" ON "mkt_tissue_listings" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "mkt_tissue_listings_tissue_slug_idx" ON "mkt_tissue_listings" USING btree ("tissue_slug");--> statement-breakpoint
CREATE INDEX "mkt_tissue_listings_access_idx" ON "mkt_tissue_listings" USING btree ("access");