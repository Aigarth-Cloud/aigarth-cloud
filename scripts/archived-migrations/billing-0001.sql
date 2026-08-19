-- Phase 18E — Tissue usage events.
--
--   Append-only log of every tissue /decide. Rolled into the
--   per-period invoice as an overage line item.

CREATE TABLE "billing_tissue_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "org_id" uuid,
  "tissue_slug" text NOT NULL,
  "tissue_version" text NOT NULL,
  "tissue_listing_id" uuid,
  "state" integer NOT NULL,
  "cost_qubic" bigint NOT NULL,
  "request_id" text NOT NULL,
  "occurred_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "billing_tissue_usage_user_idx" ON "billing_tissue_usage_events" ("user_id");
CREATE INDEX "billing_tissue_usage_user_time_idx" ON "billing_tissue_usage_events" ("user_id", "occurred_at");
CREATE INDEX "billing_tissue_usage_request_idx" ON "billing_tissue_usage_events" ("request_id");
CREATE INDEX "billing_tissue_usage_tissue_slug_idx" ON "billing_tissue_usage_events" ("tissue_slug");
