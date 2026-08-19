CREATE TYPE "public"."ann_decision_outcome" AS ENUM('success', 'failure', 'reverted', 'unknown');--> statement-breakpoint
CREATE TABLE "ann_decision_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"ann_id" uuid NOT NULL,
	"ann_version_id" uuid,
	"outcome" "ann_decision_outcome" NOT NULL,
	"confidence_in_label" numeric(4, 3),
	"notes" text,
	"recorded_by" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"outcome_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ann_decision_outcomes_decision_id_unique" UNIQUE("decision_id")
);
--> statement-breakpoint
ALTER TABLE "ann_decision_outcomes" ADD CONSTRAINT "ann_decision_outcomes_decision_id_ann_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."ann_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_decision_outcomes" ADD CONSTRAINT "ann_decision_outcomes_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_decision_outcomes" ADD CONSTRAINT "ann_decision_outcomes_ann_version_id_ann_versions_id_fk" FOREIGN KEY ("ann_version_id") REFERENCES "public"."ann_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ann_decision_outcomes_ann_idx" ON "ann_decision_outcomes" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_decision_outcomes_ann_outcome_idx" ON "ann_decision_outcomes" USING btree ("ann_id","outcome");--> statement-breakpoint
CREATE INDEX "ann_decision_outcomes_recorded_at_idx" ON "ann_decision_outcomes" USING btree ("recorded_at");