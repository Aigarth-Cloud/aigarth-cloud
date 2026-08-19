CREATE TYPE "public"."dataset_access_mode" AS ENUM('read', 'derive');--> statement-breakpoint
CREATE TYPE "public"."dataset_kind" AS ENUM('tabular', 'text', 'image', 'audio', 'time_series', 'multimodal', 'other');--> statement-breakpoint
CREATE TYPE "public"."dataset_license" AS ENUM('open', 'cc_by', 'cc_by_sa', 'commercial', 'custom');--> statement-breakpoint
CREATE TYPE "public"."dataset_status" AS ENUM('draft', 'private', 'public', 'deprecated');--> statement-breakpoint
CREATE TABLE "dataset_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"grantee_user_id" uuid,
	"mode" "dataset_access_mode" NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"granted_by" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataset_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid,
	"org_id" uuid,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataset_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"version" text NOT NULL,
	"object_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"row_count" bigint,
	"schema_json" jsonb NOT NULL,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_user_id" uuid NOT NULL,
	"owner_org_id" uuid,
	"kind" "dataset_kind" NOT NULL,
	"license" "dataset_license" DEFAULT 'open' NOT NULL,
	"source" text,
	"status" "dataset_status" DEFAULT 'private' NOT NULL,
	"dataset_revenue_bps" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dataset_access" ADD CONSTRAINT "dataset_access_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_versions" ADD CONSTRAINT "dataset_versions_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dataset_access_dataset_idx" ON "dataset_access" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "dataset_access_grantee_idx" ON "dataset_access" USING btree ("grantee_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dataset_versions_dataset_version_idx" ON "dataset_versions" USING btree ("dataset_id","version");--> statement-breakpoint
CREATE INDEX "dataset_versions_dataset_idx" ON "dataset_versions" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "dataset_versions_content_hash_idx" ON "dataset_versions" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "datasets_slug_idx" ON "datasets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "datasets_owner_idx" ON "datasets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "datasets_status_idx" ON "datasets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "datasets_kind_idx" ON "datasets" USING btree ("kind");