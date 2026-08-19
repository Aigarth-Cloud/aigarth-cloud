CREATE TYPE "public"."training_job_status" AS ENUM('queued', 'preparing', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."training_recipe_kind" AS ENUM('mlp_classifier', 'cnn_classifier', 'text_classifier', 'gradient_boost_tabular', 'trinary_classifier');--> statement-breakpoint
CREATE TABLE "training_audit_logs" (
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
CREATE TABLE "training_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"dataset_id" uuid NOT NULL,
	"dataset_version_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"recipe_json" jsonb NOT NULL,
	"hyperparams" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "training_job_status" DEFAULT 'queued' NOT NULL,
	"compute_job_id" uuid,
	"progress_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"artifact_url" text,
	"artifact_size_bytes" bigint,
	"artifact_hash" text,
	"auto_publish" boolean DEFAULT false NOT NULL,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "training_recipe_kind" NOT NULL,
	"description" text,
	"architecture" text NOT NULL,
	"default_hyperparams" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"supported_dataset_kinds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_artifact_kind" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_recipe_id_training_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."training_recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_jobs_ann_idx" ON "training_jobs" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "training_jobs_user_idx" ON "training_jobs" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "training_jobs_status_idx" ON "training_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "training_jobs_recipe_idx" ON "training_jobs" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "training_jobs_submitted_idx" ON "training_jobs" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "training_jobs_compute_job_idx" ON "training_jobs" USING btree ("compute_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_recipes_slug_idx" ON "training_recipes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "training_recipes_kind_idx" ON "training_recipes" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "training_recipes_active_idx" ON "training_recipes" USING btree ("is_active");