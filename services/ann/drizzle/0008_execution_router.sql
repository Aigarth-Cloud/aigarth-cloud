-- Phase 29 — Execution Router
-- Adds ann_executions, ann_repositories, ann_economic_policies, ann_epochs
-- plus the enums they depend on.

CREATE TYPE "ann_execution_target" AS ENUM('local', 'qubic_oc');--> statement-breakpoint
CREATE TYPE "ann_execution_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "ann_verification_status" AS ENUM('pending', 'local_deterministic', 'verified', 'disputed', 'failed');--> statement-breakpoint
CREATE TYPE "ann_economic_policy_kind" AS ENUM('burn', 'stream_burn', 'split');--> statement-breakpoint
CREATE TYPE "ann_epoch_status" AS ENUM('upcoming', 'voting', 'active', 'ended');--> statement-breakpoint

CREATE TABLE "ann_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "execution_id" text NOT NULL,
  "ann_id" uuid NOT NULL REFERENCES "anns"("id") ON DELETE CASCADE,
  "ann_version_id" uuid NOT NULL REFERENCES "ann_versions"("id") ON DELETE CASCADE,
  "ann_version" text NOT NULL,
  "manifest_hash" text NOT NULL,
  "request_id" text NOT NULL,
  "target" "ann_execution_target" NOT NULL,
  "status" "ann_execution_status" NOT NULL DEFAULT 'queued',
  "input_hash" text NOT NULL,
  "input_uri" text NOT NULL,
  "input_size_bytes" bigint NOT NULL,
  "output_json" jsonb,
  "result_hash" text,
  "work_id" text,
  "completed_by" text,
  "verification_status" "ann_verification_status" NOT NULL DEFAULT 'pending',
  "error" text,
  "requested_by_user_id" uuid,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ann_executions_execution_id_idx" UNIQUE("execution_id")
);--> statement-breakpoint
CREATE INDEX "ann_executions_ann_idx" ON "ann_executions" ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_executions_status_idx" ON "ann_executions" ("status");--> statement-breakpoint
CREATE INDEX "ann_executions_target_idx" ON "ann_executions" ("target");--> statement-breakpoint
CREATE INDEX "ann_executions_work_id_idx" ON "ann_executions" ("work_id");--> statement-breakpoint
CREATE INDEX "ann_executions_requested_by_idx" ON "ann_executions" ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "ann_executions_manifest_idx" ON "ann_executions" ("manifest_hash");--> statement-breakpoint

CREATE TABLE "ann_repositories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ann_id" uuid NOT NULL REFERENCES "anns"("id") ON DELETE CASCADE,
  "ann_version_id" uuid NOT NULL REFERENCES "ann_versions"("id") ON DELETE CASCADE,
  "repo_owner" text NOT NULL,
  "repo_name" text NOT NULL,
  "commit_sha" text NOT NULL,
  "manifest_hash" text NOT NULL,
  "release_tag" text,
  "release_url" text,
  "publication_kind" text NOT NULL DEFAULT 'seed',
  "published_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "ann_repositories_ann_idx" ON "ann_repositories" ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_repositories_version_idx" ON "ann_repositories" ("ann_version_id");--> statement-breakpoint
CREATE INDEX "ann_repositories_repo_idx" ON "ann_repositories" ("repo_owner","repo_name","commit_sha");--> statement-breakpoint
CREATE INDEX "ann_repositories_manifest_idx" ON "ann_repositories" ("manifest_hash");--> statement-breakpoint

CREATE TABLE "ann_economic_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "kind" "ann_economic_policy_kind" NOT NULL,
  "burn_bps" integer NOT NULL,
  "creator_bps" integer NOT NULL,
  "stakers_bps" integer NOT NULL,
  "ecosystem_bps" integer NOT NULL,
  "burn_min_bps" integer NOT NULL DEFAULT 2500,
  "burn_max_bps" integer NOT NULL DEFAULT 10000,
  "creator_max_bps" integer NOT NULL DEFAULT 4000,
  "stakers_max_bps" integer NOT NULL DEFAULT 3000,
  "ecosystem_max_bps" integer NOT NULL DEFAULT 2000,
  "is_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ann_economic_policies_slug_idx" UNIQUE("slug")
);--> statement-breakpoint
CREATE INDEX "ann_economic_policies_active_idx" ON "ann_economic_policies" ("is_active");--> statement-breakpoint

CREATE TABLE "ann_epochs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "epoch_number" integer NOT NULL UNIQUE,
  "name" text NOT NULL,
  "status" "ann_epoch_status" NOT NULL DEFAULT 'upcoming',
  "active_policy_id" uuid REFERENCES "ann_economic_policies"("id"),
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "ann_epochs_status_idx" ON "ann_epochs" ("status");