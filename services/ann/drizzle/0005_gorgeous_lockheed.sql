CREATE TYPE "public"."ann_deploy_mode" AS ENUM('active', 'canary', 'shadow', 'deprecated');--> statement-breakpoint
ALTER TABLE "ann_decisions" ADD COLUMN "shadow_version" text;--> statement-breakpoint
ALTER TABLE "ann_decisions" ADD COLUMN "shadow_envelope" jsonb;--> statement-breakpoint
ALTER TABLE "ann_deployments" ADD COLUMN "deploy_mode" "ann_deploy_mode" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "ann_deployments" ADD COLUMN "traffic_weight" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
CREATE INDEX "ann_deployments_mode_idx" ON "ann_deployments" USING btree ("deploy_mode");