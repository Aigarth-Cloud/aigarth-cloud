-- Phase 18E — Tissue licensing.
--
--   Adds:
--     - `tissues.access` column (open | licensed)
--     - `tissue_licenses` table for per-grantee grants

CREATE TYPE "tissue_access" AS ENUM ('open', 'licensed');

ALTER TABLE "tissues" ADD COLUMN "access" "tissue_access" NOT NULL DEFAULT 'open';

CREATE TABLE "tissue_licenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tissue_id" uuid NOT NULL REFERENCES "tissues"("id") ON DELETE CASCADE,
  "grantee_user_id" uuid,
  "grantee_org_id" uuid,
  "source" text NOT NULL DEFAULT 'owner_grant',
  "expires_at" timestamptz,
  "max_decisions" bigint,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "tissue_licenses_tissue_idx" ON "tissue_licenses" ("tissue_id");
CREATE INDEX "tissue_licenses_grantee_user_idx" ON "tissue_licenses" ("grantee_user_id");
CREATE INDEX "tissue_licenses_grantee_org_idx" ON "tissue_licenses" ("grantee_org_id");
