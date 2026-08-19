-- Phase 18B — Trinary Intelligence Layer integration.
--
-- Adds the trinary-decision surface to the ANN service:
--  1. ann_decision_protocol enum: how the ANN communicates its output
--  2. Three new columns on `anns`:
--       - decision_protocol      (defaults to 'openai_chat', the legacy surface)
--       - trinary_prompt_template (system prompt the ANN uses to emit envelopes)
--       - authority_weight        (operator-trusted weight, [0, 1], default 0.5)
--  3. `ann_decisions` — append-only log of every IntentEnvelope an ANN emits
--     under the /v1/anns/:id/decide route. Each row stores the full envelope
--     as JSONB plus a server-issued decision id for cross-service reference.
--
-- See ADR 003 — Trinary Protocol v1 — for the schema rationale.

CREATE TYPE "public"."ann_decision_protocol" AS ENUM('openai_chat', 'trinary', 'hybrid');--> statement-breakpoint

ALTER TABLE "anns" ADD COLUMN "decision_protocol" "ann_decision_protocol" DEFAULT 'openai_chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "anns" ADD COLUMN "trinary_prompt_template" text;--> statement-breakpoint
ALTER TABLE "anns" ADD COLUMN "authority_weight" numeric(4, 3) DEFAULT 0.5 NOT NULL;--> statement-breakpoint

CREATE TABLE "ann_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ann_id" uuid NOT NULL,
	"ann_version" text NOT NULL,
	"request_id" text NOT NULL,
	"caller_user_id" uuid,
	"caller_org_id" uuid,
	"state" integer NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"authority" numeric(4, 3) NOT NULL,
	"reasoning" text NOT NULL,
	"recommended_action" text,
	"reversibility" text NOT NULL,
	"time_horizon" text NOT NULL,
	"envelope" jsonb NOT NULL,
	"signature" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ann_decisions" ADD CONSTRAINT "ann_decisions_ann_id_anns_id_fk" FOREIGN KEY ("ann_id") REFERENCES "public"."anns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ann_decisions_ann_idx" ON "ann_decisions" USING btree ("ann_id");--> statement-breakpoint
CREATE INDEX "ann_decisions_ann_issued_idx" ON "ann_decisions" USING btree ("ann_id","issued_at" DESC);--> statement-breakpoint
CREATE INDEX "ann_decisions_request_idx" ON "ann_decisions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ann_decisions_state_idx" ON "ann_decisions" USING btree ("ann_id","state");--> statement-breakpoint
CREATE INDEX "anns_decision_protocol_idx" ON "anns" USING btree ("decision_protocol");
