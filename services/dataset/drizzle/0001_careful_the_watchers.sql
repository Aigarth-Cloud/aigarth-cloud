CREATE TYPE "public"."dataset_connector_kind" AS ENUM('http_api');--> statement-breakpoint
CREATE TYPE "public"."dataset_connector_status" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TABLE "dataset_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"kind" "dataset_connector_kind" NOT NULL,
	"name" text NOT NULL,
	"config_json" jsonb NOT NULL,
	"status" "dataset_connector_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"last_sync_at" timestamp with time zone,
	"last_sync_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dataset_connectors" ADD CONSTRAINT "dataset_connectors_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dataset_connectors_dataset_idx" ON "dataset_connectors" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "dataset_connectors_status_idx" ON "dataset_connectors" USING btree ("status");