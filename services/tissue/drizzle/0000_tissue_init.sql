-- Phase 18D — Tissue Service initial schema.
--
-- Tables:
--   tissue_status         — enum: draft / active / paused / deprecated
--   tissue_visibility     — enum: public / unlisted / private
--   tissue_member_role    — enum: voting / veto / advisory
--   tissues               — the canonical tissue record
--   tissue_members        — per-tissue ANN membership with role + authority
--   tissue_decisions      — append-only log of every tissue-level decision
--   tissue_audit_logs     — service-local audit log
--
-- See ADR 003 — Trinary Protocol v1 — for the design rationale.

CREATE TYPE "public"."tissue_status" AS ENUM('draft', 'active', 'paused', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."tissue_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TYPE "public"."tissue_member_role" AS ENUM('voting', 'veto', 'advisory');--> statement-breakpoint

CREATE TABLE "tissues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"owner_user_id" uuid NOT NULL,
	"owner_org_id" uuid,
	"visibility" "tissue_visibility" DEFAULT 'public' NOT NULL,
	"status" "tissue_status" DEFAULT 'draft' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"policy" jsonb NOT NULL,
	"policy_kind" text NOT NULL,
	"total_decisions" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tissues_slug_idx" ON "tissues" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tissues_status_idx" ON "tissues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tissues_visibility_idx" ON "tissues" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "tissues_owner_idx" ON "tissues" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "tissues_policy_kind_idx" ON "tissues" USING btree ("policy_kind");--> statement-breakpoint

CREATE TABLE "tissue_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tissue_id" uuid NOT NULL,
	"ann_slug" text NOT NULL,
	"ann_id" uuid,
	"role" "tissue_member_role" DEFAULT 'voting' NOT NULL,
	"authority_weight" numeric(4, 3) DEFAULT 0.5 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tissue_members" ADD CONSTRAINT "tissue_members_tissue_id_tissues_id_fk" FOREIGN KEY ("tissue_id") REFERENCES "public"."tissues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tissue_members_tissue_ann_idx" ON "tissue_members" USING btree ("tissue_id","ann_slug");--> statement-breakpoint
CREATE INDEX "tissue_members_tissue_idx" ON "tissue_members" USING btree ("tissue_id");--> statement-breakpoint
CREATE INDEX "tissue_members_ann_slug_idx" ON "tissue_members" USING btree ("ann_slug");--> statement-breakpoint

CREATE TABLE "tissue_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tissue_id" uuid NOT NULL,
	"tissue_version" text NOT NULL,
	"request_id" text NOT NULL,
	"caller_user_id" uuid,
	"caller_org_id" uuid,
	"state" integer NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"authority" numeric(4, 3) NOT NULL,
	"reasoning" text NOT NULL,
	"reversibility" text NOT NULL,
	"time_horizon" text NOT NULL,
	"contributors" jsonb NOT NULL,
	"ignored" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"envelope" jsonb NOT NULL,
	"signature" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tissue_decisions" ADD CONSTRAINT "tissue_decisions_tissue_id_tissues_id_fk" FOREIGN KEY ("tissue_id") REFERENCES "public"."tissues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tissue_decisions_tissue_idx" ON "tissue_decisions" USING btree ("tissue_id");--> statement-breakpoint
CREATE INDEX "tissue_decisions_tissue_issued_idx" ON "tissue_decisions" USING btree ("tissue_id","issued_at" DESC);--> statement-breakpoint
CREATE INDEX "tissue_decisions_request_idx" ON "tissue_decisions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "tissue_decisions_state_idx" ON "tissue_decisions" USING btree ("tissue_id","state");--> statement-breakpoint

CREATE TABLE "tissue_audit_logs" (
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
CREATE INDEX "tissue_audit_logs_actor_idx" ON "tissue_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "tissue_audit_logs_action_idx" ON "tissue_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "tissue_audit_logs_created_idx" ON "tissue_audit_logs" USING btree ("created_at");
