CREATE TYPE "public"."ann_deployment_status" AS ENUM('pending', 'deploying', 'running', 'stopped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ann_license_grant_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ann_license_kind" AS ENUM('open', 'commercial', 'restricted', 'custom');--> statement-breakpoint
CREATE TYPE "public"."ann_status" AS ENUM('draft', 'published', 'deprecated', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."ann_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TABLE "ann_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"version_id" uuid,
	"benchmark_name" text NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"dataset_hash" text,
	"runner" text DEFAULT 'internal' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ann_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"region_id" uuid,
	"cluster_id" uuid,
	"compute_job_id" uuid,
	"status" "ann_deployment_status" DEFAULT 'pending' NOT NULL,
	"endpoint_url" text,
	"replicas" integer DEFAULT 1 NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"owner_org_id" uuid,
	"cost_per_call_qubic" bigint NOT NULL,
	"deployed_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ann_licenses_granted" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"license_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"status" "ann_license_grant_status" DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"call_count" bigint NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ann_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"verified_use" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ann_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"version" text NOT NULL,
	"changelog" text,
	"artifact_url" text,
	"artifact_size_bytes" bigint,
	"artifact_hash" text,
	"training_compute_job_id" uuid,
	"training_dataset_hash" text,
	"hyperparameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signature" text,
	"is_latest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"icon" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_id" uuid,
	"license_id" uuid,
	"creator_user_id" uuid NOT NULL,
	"creator_org_id" uuid,
	"creator_name" text NOT NULL,
	"visibility" "ann_visibility" DEFAULT 'public' NOT NULL,
	"status" "ann_status" DEFAULT 'draft' NOT NULL,
	"creator_wallet_address" text,
	"signature" text,
	"accuracy" numeric(5, 2),
	"latency_p50_ms" integer,
	"latency_p99_ms" integer,
	"total_calls" bigint NOT NULL,
	"total_revenue_qubic" bigint NOT NULL,
	"monthly_calls" bigint NOT NULL,
	"downloads" bigint NOT NULL,
	"rating_average" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"current_version_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ann_audit_logs" (
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
CREATE TABLE "ann_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ann_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" "ann_license_kind" NOT NULL,
	"terms" text,
	"price_per_call_qubic" bigint NOT NULL,
	"revenue_share_bps" integer DEFAULT 0 NOT NULL,
	"allows_modification" boolean DEFAULT false NOT NULL,
	"allows_commercial_use" boolean DEFAULT false NOT NULL,
	"allows_redistribution" boolean DEFAULT false NOT NULL,
	"requires_attribution" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ann_benchmarks" ADD CONSTRAINT "ann_benchmarks_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_benchmarks" ADD CONSTRAINT "ann_benchmarks_version_id_ann_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."ann_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_deployments" ADD CONSTRAINT "ann_deployments_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_deployments" ADD CONSTRAINT "ann_deployments_version_id_ann_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."ann_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_licenses_granted" ADD CONSTRAINT "ann_licenses_granted_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_licenses_granted" ADD CONSTRAINT "ann_licenses_granted_license_id_ann_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."ann_licenses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_ratings" ADD CONSTRAINT "ann_ratings_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_versions" ADD CONSTRAINT "ann_versions_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anns" ADD CONSTRAINT "anns_category_id_ann_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ann_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anns" ADD CONSTRAINT "anns_license_id_ann_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."ann_licenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ann_benchmarks_ann_idx" ON "ann_benchmarks" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_benchmarks_name_idx" ON "ann_benchmarks" USING btree ("benchmark_name");--> statement-breakpoint
CREATE INDEX "ann_deployments_ann_idx" ON "ann_deployments" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_deployments_version_idx" ON "ann_deployments" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "ann_deployments_status_idx" ON "ann_deployments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ann_deployments_owner_idx" ON "ann_deployments" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "ann_licenses_granted_ann_idx" ON "ann_licenses_granted" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_licenses_granted_user_idx" ON "ann_licenses_granted" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ann_licenses_granted_ann_user_idx" ON "ann_licenses_granted" USING btree ("ann_id","user_id");--> statement-breakpoint
CREATE INDEX "ann_licenses_granted_status_idx" ON "ann_licenses_granted" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ann_ratings_ann_user_idx" ON "ann_ratings" USING btree ("ann_id","user_id");--> statement-breakpoint
CREATE INDEX "ann_ratings_ann_idx" ON "ann_ratings" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_versions_ann_idx" ON "ann_versions" USING btree ("ann_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ann_versions_ann_version_idx" ON "ann_versions" USING btree ("ann_id","version");--> statement-breakpoint
CREATE INDEX "ann_versions_latest_idx" ON "ann_versions" USING btree ("ann_id","is_latest");--> statement-breakpoint
CREATE UNIQUE INDEX "anns_slug_idx" ON "anns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "anns_status_idx" ON "anns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "anns_visibility_idx" ON "anns" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "anns_category_idx" ON "anns" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "anns_license_idx" ON "anns" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "anns_creator_idx" ON "anns" USING btree ("creator_user_id");--> statement-breakpoint
CREATE INDEX "ann_audit_logs_actor_idx" ON "ann_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "ann_audit_logs_action_idx" ON "ann_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "ann_audit_logs_created_idx" ON "ann_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ann_categories_slug_idx" ON "ann_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "ann_licenses_slug_idx" ON "ann_licenses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ann_licenses_kind_idx" ON "ann_licenses" USING btree ("kind");