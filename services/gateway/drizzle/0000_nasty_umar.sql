CREATE TYPE "public"."gateway_api_key_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('active', 'draining', 'offline');--> statement-breakpoint
CREATE TYPE "public"."model_status" AS ENUM('active', 'deprecated', 'preview', 'offline');--> statement-breakpoint
CREATE TYPE "public"."model_type" AS ENUM('chat', 'embedding', 'image', 'audio', 'video');--> statement-breakpoint
CREATE TABLE "gateway_audit_logs" (
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
CREATE TABLE "gateway_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"secret_hash" text NOT NULL,
	"secret_last4" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "gateway_api_key_status" DEFAULT 'active' NOT NULL,
	"rate_limit_rpm" integer,
	"rate_limit_tpm" integer,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" text NOT NULL,
	"region" text DEFAULT 'global' NOT NULL,
	"cluster_hint" text,
	"status" "deployment_status" DEFAULT 'active' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"type" "model_type" NOT NULL,
	"description" text,
	"context_window" integer DEFAULT 8192 NOT NULL,
	"max_output_tokens" integer DEFAULT 4096 NOT NULL,
	"input_cost_qubic" bigint NOT NULL,
	"output_cost_qubic" bigint NOT NULL,
	"status" "model_status" DEFAULT 'active' NOT NULL,
	"owned_by" text DEFAULT 'aigarth' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"window" text NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"api_key_id" uuid,
	"model" text NOT NULL,
	"endpoint" text NOT NULL,
	"status_code" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_qubic" bigint NOT NULL,
	"ip" text,
	"user_agent" text,
	"request_body" jsonb,
	"response_body" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gateway_deployments" ADD CONSTRAINT "gateway_deployments_model_id_gateway_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."gateway_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_rate_limits" ADD CONSTRAINT "gateway_rate_limits_api_key_id_gateway_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."gateway_api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests" ADD CONSTRAINT "gateway_requests_api_key_id_gateway_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."gateway_api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gateway_audit_logs_actor_idx" ON "gateway_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "gateway_audit_logs_action_idx" ON "gateway_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "gateway_audit_logs_created_idx" ON "gateway_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_api_keys_prefix_idx" ON "gateway_api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "gateway_api_keys_user_idx" ON "gateway_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gateway_api_keys_status_idx" ON "gateway_api_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gateway_deployments_model_idx" ON "gateway_deployments" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "gateway_deployments_region_idx" ON "gateway_deployments" USING btree ("region");--> statement-breakpoint
CREATE INDEX "gateway_models_type_idx" ON "gateway_models" USING btree ("type");--> statement-breakpoint
CREATE INDEX "gateway_models_status_idx" ON "gateway_models" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_rate_limits_key_window_idx" ON "gateway_rate_limits" USING btree ("api_key_id","window");--> statement-breakpoint
CREATE INDEX "gateway_requests_user_idx" ON "gateway_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gateway_requests_key_idx" ON "gateway_requests" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "gateway_requests_model_idx" ON "gateway_requests" USING btree ("model");--> statement-breakpoint
CREATE INDEX "gateway_requests_endpoint_idx" ON "gateway_requests" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "gateway_requests_created_idx" ON "gateway_requests" USING btree ("created_at");