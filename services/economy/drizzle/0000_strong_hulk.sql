CREATE TYPE "public"."economy_bundle_listing_kind" AS ENUM('collection', 'starter_pack', 'curated');--> statement-breakpoint
CREATE TYPE "public"."economy_contributor_role" AS ENUM('creator', 'co_creator', 'data_provider', 'curator', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."economy_lock_status" AS ENUM('observed', 'active', 'unlocking', 'ended', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."economy_payout_recipient_status" AS ENUM('pending', 'broadcast', 'confirmed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."economy_payout_run_status" AS ENUM('draft', 'pending', 'settling', 'settled', 'partial', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "economy_aigarth_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_address" text NOT NULL,
	"qearn_lock_id" text NOT NULL,
	"lock_tx_hash" text NOT NULL,
	"unlock_tx_hash" text,
	"amount_qubic" bigint NOT NULL,
	"total_weeks" integer NOT NULL,
	"start_epoch" integer NOT NULL,
	"start_tick" integer NOT NULL,
	"end_tick" integer,
	"net_reward_qubic" bigint NOT NULL,
	"penalty_burned_qubic" bigint NOT NULL,
	"status" "economy_lock_status" DEFAULT 'observed' NOT NULL,
	"compute_grant_units" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "economy_bundle_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"kind" "economy_bundle_listing_kind" DEFAULT 'collection' NOT NULL,
	"ann_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bundle_price_qubic" bigint NOT NULL,
	"discount_bps" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economy_contributor_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"bps" integer NOT NULL,
	"role" "economy_contributor_role" DEFAULT 'co_creator' NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economy_audit_logs" (
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
CREATE TABLE "economy_payout_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_address" text NOT NULL,
	"bps" integer NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"status" "economy_payout_recipient_status" DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "economy_payout_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"total_revenue_qubic" bigint NOT NULL,
	"platform_fee_qubic" bigint NOT NULL,
	"net_to_contributors_qubic" bigint NOT NULL,
	"platform_fee_bps" integer NOT NULL,
	"status" "economy_payout_run_status" DEFAULT 'draft' NOT NULL,
	"source_usage_record_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"failure_reason" text
);
--> statement-breakpoint
ALTER TABLE "economy_payout_recipients" ADD CONSTRAINT "economy_payout_recipients_payout_run_id_economy_payout_runs_id_fk" FOREIGN KEY ("payout_run_id") REFERENCES "public"."economy_payout_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "economy_aigarth_locks_user_idx" ON "economy_aigarth_locks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "economy_aigarth_locks_status_idx" ON "economy_aigarth_locks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "economy_aigarth_locks_qearn_lock_idx" ON "economy_aigarth_locks" USING btree ("qearn_lock_id");--> statement-breakpoint
CREATE UNIQUE INDEX "economy_bundle_listings_listing_idx" ON "economy_bundle_listings" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "economy_contributor_shares_ann_user_idx" ON "economy_contributor_shares" USING btree ("ann_id","user_id");--> statement-breakpoint
CREATE INDEX "economy_contributor_shares_ann_idx" ON "economy_contributor_shares" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "economy_contributor_shares_user_idx" ON "economy_contributor_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "economy_audit_logs_actor_idx" ON "economy_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "economy_audit_logs_action_idx" ON "economy_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "economy_audit_logs_created_idx" ON "economy_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "economy_payout_recipients_run_idx" ON "economy_payout_recipients" USING btree ("payout_run_id");--> statement-breakpoint
CREATE INDEX "economy_payout_recipients_status_idx" ON "economy_payout_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "economy_payout_runs_ann_idx" ON "economy_payout_runs" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "economy_payout_runs_status_idx" ON "economy_payout_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "economy_payout_runs_period_idx" ON "economy_payout_runs" USING btree ("period_start","period_end");