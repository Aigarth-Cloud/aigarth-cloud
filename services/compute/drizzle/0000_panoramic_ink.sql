CREATE TYPE "public"."cluster_member_status" AS ENUM('active', 'draining', 'removed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'submitted', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('contract_call', 'training', 'inference', 'general');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('active', 'released', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "compute_audit_logs" (
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
CREATE TABLE "compute_cluster_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_id" uuid NOT NULL,
	"computor_index" integer NOT NULL,
	"status" "cluster_member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compute_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"purpose" text DEFAULT 'general' NOT NULL,
	"min_computors" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compute_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"cluster_id" uuid,
	"region_id" uuid,
	"type" "job_type" DEFAULT 'general' NOT NULL,
	"contract_index" integer,
	"function_index" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"tx_hash" text,
	"submitted_tick" integer,
	"started_tick" integer,
	"completed_tick" integer,
	"result" jsonb,
	"error_message" text,
	"credit_used_qubic" bigint,
	"reservation_id" uuid,
	"submitted_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compute_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"computor_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compute_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"qubic_wallet_id" uuid,
	"principal_qubic" bigint NOT NULL,
	"fee_bps" integer DEFAULT 50 NOT NULL,
	"credit_qubic" bigint NOT NULL,
	"used_qubic" bigint NOT NULL,
	"epochs" integer NOT NULL,
	"start_epoch" integer NOT NULL,
	"end_epoch" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'active' NOT NULL,
	"tx_hash" text,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compute_cluster_members" ADD CONSTRAINT "compute_cluster_members_cluster_id_compute_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."compute_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compute_clusters" ADD CONSTRAINT "compute_clusters_region_id_compute_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."compute_regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compute_jobs" ADD CONSTRAINT "compute_jobs_cluster_id_compute_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."compute_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compute_jobs" ADD CONSTRAINT "compute_jobs_region_id_compute_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."compute_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compute_audit_logs_actor_idx" ON "compute_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "compute_audit_logs_action_idx" ON "compute_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "compute_audit_logs_created_idx" ON "compute_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "compute_cluster_members_cluster_computor_idx" ON "compute_cluster_members" USING btree ("cluster_id","computor_index");--> statement-breakpoint
CREATE INDEX "compute_cluster_members_computor_idx" ON "compute_cluster_members" USING btree ("computor_index");--> statement-breakpoint
CREATE UNIQUE INDEX "compute_clusters_region_slug_idx" ON "compute_clusters" USING btree ("region_id","slug");--> statement-breakpoint
CREATE INDEX "compute_clusters_region_idx" ON "compute_clusters" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "compute_jobs_user_idx" ON "compute_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "compute_jobs_status_idx" ON "compute_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "compute_jobs_cluster_idx" ON "compute_jobs" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "compute_jobs_region_idx" ON "compute_jobs" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "compute_jobs_tx_hash_idx" ON "compute_jobs" USING btree ("tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "compute_regions_slug_idx" ON "compute_regions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "compute_reservations_user_idx" ON "compute_reservations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "compute_reservations_status_idx" ON "compute_reservations" USING btree ("status");