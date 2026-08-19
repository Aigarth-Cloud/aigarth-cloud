-- Phase 27 — Work Service initial schema.
--
-- Tables:
--   work_status          — enum: queued / running / verified / failed / disputed
--   worker_kind          — enum: local / remote / oc-processor / neuraxon / human-via-oracle
--   worker_status        — enum: active / suspended / offline
--   verification_method  — enum: replication / challenge / deterministic / tee / zk
--   work_algorithms      — registered algorithm registry (Task 10 — awork_1)
--   work_items           — canonical work item record (Task 7)
--   workers              — worker registry (Task 7)
--   work_results         — per-replica submission rows (Task 7)
--   worker_challenges    — per-challenge audit + outcome (Task 9)
--   work_audit           — append-only state-transition log (Task 7)
--
-- See ADR 006 — Work Runtime — for the design rationale.

CREATE TYPE "public"."work_status" AS ENUM('queued', 'running', 'verified', 'failed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."worker_kind" AS ENUM('local', 'remote', 'oc-processor', 'neuraxon', 'human-via-oracle');--> statement-breakpoint
CREATE TYPE "public"."worker_status" AS ENUM('active', 'suspended', 'offline');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('replication', 'challenge', 'deterministic', 'tee', 'zk');--> statement-breakpoint

CREATE TABLE "work_algorithms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"container" text NOT NULL,
	"deterministic" boolean DEFAULT false NOT NULL,
	"signature" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "work_algorithms_name_version_idx" ON "work_algorithms" USING btree ("name","version");--> statement-breakpoint
CREATE INDEX "work_algorithms_name_idx" ON "work_algorithms" USING btree ("name");--> statement-breakpoint

CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" text NOT NULL,
	"type" text NOT NULL,
	"spec_version" integer DEFAULT 1 NOT NULL,
	"status" "work_status" DEFAULT 'queued' NOT NULL,
	"input_hash" text NOT NULL,
	"input_uri" text NOT NULL,
	"input_size_bytes" bigint NOT NULL,
	"algorithm_name" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"algorithm_container" text NOT NULL,
	"algorithm_deterministic" boolean DEFAULT false NOT NULL,
	"algorithm_container_hash" text,
	"req_cpu_cores" integer DEFAULT 1 NOT NULL,
	"req_memory_gb" integer DEFAULT 1 NOT NULL,
	"req_gpu" text DEFAULT 'none' NOT NULL,
	"req_gpu_kind" text DEFAULT 'any' NOT NULL,
	"req_estimated_runtime_s" integer DEFAULT 60 NOT NULL,
	"verification_method" "verification_method" NOT NULL,
	"replicas" integer DEFAULT 3 NOT NULL,
	"challenge_work_id" text,
	"reward_currency" text DEFAULT 'QUBIC' NOT NULL,
	"reward_amount" bigint DEFAULT 0 NOT NULL,
	"reward_payer" text NOT NULL,
	"result_payload_hash" text,
	"result_completed_by" text,
	"result_completed_at" timestamp with time zone,
	"result_replicas_agreed" text,
	"created_by" text NOT NULL,
	"settlement_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "work_items_work_id_idx" ON "work_items" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "work_items_status_idx" ON "work_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_items_type_idx" ON "work_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "work_items_payer_idx" ON "work_items" USING btree ("reward_payer");--> statement-breakpoint
CREATE INDEX "work_items_algorithm_idx" ON "work_items" USING btree ("algorithm_name","algorithm_version");--> statement-breakpoint
CREATE INDEX "work_items_created_at_idx" ON "work_items" USING btree ("created_at");--> statement-breakpoint

CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" text NOT NULL,
	"kind" "worker_kind" NOT NULL,
	"status" "worker_status" DEFAULT 'active' NOT NULL,
	"cpu_cores" integer DEFAULT 1 NOT NULL,
	"memory_gb" integer DEFAULT 1 NOT NULL,
	"gpu" text DEFAULT 'none' NOT NULL,
	"gpu_kind" text DEFAULT 'any' NOT NULL,
	"algorithms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"runtime" text DEFAULT 'docker' NOT NULL,
	"location" text DEFAULT 'local' NOT NULL,
	"reputation" numeric(4, 3) DEFAULT 0.5 NOT NULL,
	"disputes" integer DEFAULT 0 NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workers_worker_id_idx" ON "workers" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "workers_status_idx" ON "workers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workers_kind_idx" ON "workers" USING btree ("kind");--> statement-breakpoint

CREATE TABLE "work_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" text NOT NULL,
	"claimed_by" text,
	"status" text DEFAULT 'claimed' NOT NULL,
	"payload_hash" text,
	"signature" text,
	"lease_expires_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "work_results_work_claim_idx" ON "work_results" USING btree ("work_id","claimed_by");--> statement-breakpoint
CREATE INDEX "work_results_status_idx" ON "work_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_results_lease_idx" ON "work_results" USING btree ("lease_expires_at");--> statement-breakpoint

CREATE TABLE "worker_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" text NOT NULL,
	"work_id" text NOT NULL,
	"known_answer_hash" text NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "worker_challenges_worker_idx" ON "worker_challenges" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "worker_challenges_work_idx" ON "worker_challenges" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "worker_challenges_passed_idx" ON "worker_challenges" USING btree ("passed");--> statement-breakpoint

CREATE TABLE "work_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" text,
	"worker_id" text,
	"actor_user_id" text,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "work_audit_work_idx" ON "work_audit" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "work_audit_worker_idx" ON "work_audit" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "work_audit_action_idx" ON "work_audit" USING btree ("action");--> statement-breakpoint
CREATE INDEX "work_audit_created_idx" ON "work_audit" USING btree ("created_at");
