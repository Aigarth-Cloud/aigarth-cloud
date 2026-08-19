CREATE TABLE "ann_retrain_configs" (
	"ann_id" uuid PRIMARY KEY NOT NULL,
	"opt_in" boolean DEFAULT false NOT NULL,
	"baseline_success_rate" numeric(5, 4),
	"drift_threshold" numeric(5, 4) DEFAULT '0.05' NOT NULL,
	"outcome_floor" integer DEFAULT 50 NOT NULL,
	"cooldown_hours" integer DEFAULT 168 NOT NULL,
	"last_retrain_at" timestamp with time zone,
	"preferred_dataset_version_id" uuid,
	"notify_mode" text DEFAULT 'log' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ann_retrain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"training_job_id" uuid,
	"reason" text NOT NULL,
	"baseline_success_rate" numeric(5, 4),
	"current_success_rate" numeric(5, 4),
	"total_outcomes_at_trigger" integer,
	"notes" text,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ann_retrain_configs" ADD CONSTRAINT "ann_retrain_configs_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_retrain_events" ADD CONSTRAINT "ann_retrain_events_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ann_retrain_events_ann_idx" ON "ann_retrain_events" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_retrain_events_triggered_idx" ON "ann_retrain_events" USING btree ("triggered_at");