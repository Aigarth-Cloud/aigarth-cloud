-- Phase 5+ gap-closing migration.
--
-- 1. pg_trgm extension + GIN trigram index over a generated `search_text` column
--    for fast marketplace search (ILIKE + similarity()).
-- 2. GIN trigram index over the tags array (cast to text).
-- 3. New `ann_idempotency_keys` table for write-endpoint idempotency.

CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

ALTER TABLE "anns" ADD COLUMN "search_text" text GENERATED ALWAYS AS (
  COALESCE(name, '') || ' ' || COALESCE(tagline, '') || ' ' || COALESCE(description, '')
) STORED;--> statement-breakpoint

CREATE INDEX "anns_search_text_trgm_idx" ON "anns" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX "anns_tags_trgm_idx" ON "anns" USING gin (("tags"::text) gin_trgm_ops);--> statement-breakpoint

CREATE TABLE "ann_idempotency_keys" (
	"user_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"route" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"request_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ann_idempotency_keys_pk" ON "ann_idempotency_keys" USING btree ("user_id","idempotency_key","route");--> statement-breakpoint
CREATE INDEX "ann_idempotency_keys_expires_idx" ON "ann_idempotency_keys" USING btree ("expires_at");
