CREATE TYPE "public"."mkt_auction_kind" AS ENUM('dutch', 'english', 'sealed_bid');--> statement-breakpoint
CREATE TYPE "public"."mkt_auction_status" AS ENUM('scheduled', 'live', 'ended', 'settled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mkt_bid_status" AS ENUM('active', 'winning', 'outbid', 'won', 'lost', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."mkt_capacity_kind" AS ENUM('spot', 'reserved', 'futures');--> statement-breakpoint
CREATE TYPE "public"."mkt_listing_status" AS ENUM('draft', 'active', 'paused', 'sold_out', 'closed');--> statement-breakpoint
CREATE TYPE "public"."mkt_listing_visibility" AS ENUM('public', 'unlisted');--> statement-breakpoint
CREATE TYPE "public"."mkt_offer_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."mkt_purchase_status" AS ENUM('pending', 'completed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mkt_review_target" AS ENUM('listing', 'auction', 'user');--> statement-breakpoint
CREATE TABLE "mkt_auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"seller_org_id" uuid,
	"seller_name" text NOT NULL,
	"region_id" uuid,
	"cluster_id" uuid,
	"kind" "mkt_auction_kind" NOT NULL,
	"capacity_amount_qubic" bigint NOT NULL,
	"start_price_qubic" bigint NOT NULL,
	"min_price_qubic" bigint NOT NULL,
	"decrement_per_tick_qubic" bigint,
	"tick_interval_seconds" integer,
	"reserve_price_qubic" bigint,
	"current_price_qubic" bigint,
	"current_winning_bid_qubic" bigint,
	"status" "mkt_auction_status" DEFAULT 'scheduled' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"winner_user_id" uuid,
	"winning_bid_qubic" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"org_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"bidder_user_id" uuid NOT NULL,
	"bidder_org_id" uuid,
	"bidder_name" text NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"status" "mkt_bid_status" DEFAULT 'active' NOT NULL,
	"is_winning" boolean DEFAULT false NOT NULL,
	"sealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"seller_org_id" uuid,
	"seller_name" text NOT NULL,
	"region_id" uuid,
	"cluster_id" uuid,
	"kind" "mkt_capacity_kind" NOT NULL,
	"capacity_amount_qubic" bigint NOT NULL,
	"capacity_remaining_qubic" bigint NOT NULL,
	"price_per_unit_qubic" bigint NOT NULL,
	"duration_seconds" bigint NOT NULL,
	"min_purchase_qubic" bigint NOT NULL,
	"status" "mkt_listing_status" DEFAULT 'draft' NOT NULL,
	"visibility" "mkt_listing_visibility" DEFAULT 'public' NOT NULL,
	"total_offers" integer DEFAULT 0 NOT NULL,
	"total_purchases" integer DEFAULT 0 NOT NULL,
	"total_revenue_qubic" bigint NOT NULL,
	"rating_average" text,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"unlocks_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"buyer_org_id" uuid,
	"buyer_name" text NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"total_price_qubic" bigint NOT NULL,
	"status" "mkt_offer_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"expires_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"offer_id" uuid,
	"buyer_user_id" uuid NOT NULL,
	"buyer_org_id" uuid,
	"seller_user_id" uuid NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"total_price_qubic" bigint NOT NULL,
	"platform_fee_qubic" bigint NOT NULL,
	"status" "mkt_purchase_status" DEFAULT 'pending' NOT NULL,
	"invoice_id" uuid,
	"compute_job_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "mkt_review_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"reviewer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"verified_purchase" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mkt_bids" ADD CONSTRAINT "mkt_bids_auction_id_mkt_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."mkt_auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkt_offers" ADD CONSTRAINT "mkt_offers_listing_id_mkt_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."mkt_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkt_purchases" ADD CONSTRAINT "mkt_purchases_listing_id_mkt_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."mkt_listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkt_purchases" ADD CONSTRAINT "mkt_purchases_offer_id_mkt_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."mkt_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mkt_auctions_slug_idx" ON "mkt_auctions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "mkt_auctions_status_idx" ON "mkt_auctions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mkt_auctions_kind_idx" ON "mkt_auctions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "mkt_auctions_seller_idx" ON "mkt_auctions" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "mkt_auctions_ends_idx" ON "mkt_auctions" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "mkt_audit_logs_actor_idx" ON "mkt_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "mkt_audit_logs_action_idx" ON "mkt_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "mkt_audit_logs_created_idx" ON "mkt_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mkt_bids_auction_idx" ON "mkt_bids" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "mkt_bids_bidder_idx" ON "mkt_bids" USING btree ("bidder_user_id");--> statement-breakpoint
CREATE INDEX "mkt_bids_winning_idx" ON "mkt_bids" USING btree ("auction_id","is_winning");--> statement-breakpoint
CREATE UNIQUE INDEX "mkt_listings_slug_idx" ON "mkt_listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "mkt_listings_status_idx" ON "mkt_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mkt_listings_visibility_idx" ON "mkt_listings" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "mkt_listings_kind_idx" ON "mkt_listings" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "mkt_listings_seller_idx" ON "mkt_listings" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "mkt_offers_listing_idx" ON "mkt_offers" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "mkt_offers_buyer_idx" ON "mkt_offers" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "mkt_offers_status_idx" ON "mkt_offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mkt_purchases_listing_idx" ON "mkt_purchases" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "mkt_purchases_buyer_idx" ON "mkt_purchases" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "mkt_purchases_seller_idx" ON "mkt_purchases" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "mkt_purchases_status_idx" ON "mkt_purchases" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "mkt_reviews_target_user_idx" ON "mkt_reviews" USING btree ("target_type","target_id","reviewer_user_id");--> statement-breakpoint
CREATE INDEX "mkt_reviews_target_idx" ON "mkt_reviews" USING btree ("target_type","target_id");