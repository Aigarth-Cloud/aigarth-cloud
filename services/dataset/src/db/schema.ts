/**
 * Dataset service — Drizzle schema (Phase 19B.2).
 *
 *   datasets                — the canonical dataset record
 *   dataset_versions        — content-hashed versioned payloads
 *   dataset_access          — per-grant access control (Phase 19B.2)
 *   dataset_audit_logs      — service-local audit log
 *
 * Design rationale: see ADR 004 (docs/architecture-decisions/004-dataset-licensing.md).
 *
 * Key decisions:
 *   - Trainer owns weights. Dataset is a reference, never copied.
 *   - Soft orphan: a hard dataset delete orphans the lineage, but
 *     `ann_versions.trained_on_dataset_version_id` uses
 *     `ON DELETE SET NULL` so trained versions keep working.
 *   - Content hash is on `dataset_versions` (one version = one blob).
 *     Two versions of the same dataset can share bytes only if the
 *     producer explicitly re-uploads (we don't dedupe v1; that
 *     complicates lineage).
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------

/** What kind of data the dataset contains. Used by 19C to pick a recipe. */
export const datasetKind = pgEnum("dataset_kind", [
  "tabular",
  "text",
  "image",
  "audio",
  "time_series",
  "multimodal",
  "other",
]);

/**
 * License terms the producer assigns. The platform does not enforce
 * these in v1 (except via the listing display); the producer is
 * trusted to label accurately. ADR 004 Q3.
 */
export const datasetLicense = pgEnum("dataset_license", [
  "open",
  "cc_by",
  "cc_by_sa",
  "commercial",
  "custom",
]);

/** Visibility + lifecycle. `public` appears in the catalog; `private` is owner-only. */
export const datasetStatus = pgEnum("dataset_status", [
  "draft",
  "private",
  "public",
  "deprecated",
]);

/** What the grantee can do with a granted dataset. */
export const datasetAccessMode = pgEnum("dataset_access_mode", ["read", "derive"]);

// ---------- datasets ----------

export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** URL-friendly unique identifier (kebab-case, derived from name). */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ownerUserId: uuid("owner_user_id").notNull(),
    ownerOrgId: uuid("owner_org_id"),
    kind: datasetKind("kind").notNull(),
    license: datasetLicense("license").notNull().default("open"),
    /**
     * Original source URL, paper citation, or "self-collected".
     * Surfaced on the listing detail page (19B.4) for provenance.
     */
    source: text("source"),
    status: datasetStatus("status").notNull().default("private"),
    /**
     * Optional bps (0–10000) for a future v2 revenue-share model.
     * v1 ignores this; the listing UI clearly states it's advisory.
     * ADR 004 Q1.
     */
    datasetRevenueBps: integer("dataset_revenue_bps").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("datasets_slug_idx").on(t.slug),
    ownerIdx: index("datasets_owner_idx").on(t.ownerUserId),
    statusIdx: index("datasets_status_idx").on(t.status),
    kindIdx: index("datasets_kind_idx").on(t.kind),
  }),
);

// ---------- dataset_versions ----------

export const datasetVersions = pgTable(
  "dataset_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    /** Semver. The first version is "1.0.0" (or 0.1.0 for pre-release). */
    version: text("version").notNull(),
    /**
     * Object storage key. Format: `datasets/<dataset_id>/<version>/<content_hash>`.
     * We use the content hash in the path so two identical uploads dedupe
     * at the S3 level (idempotent re-upload of the same bytes).
     */
    objectKey: text("object_key").notNull(),
    /**
     * SHA-256 of the full bytes, hex-encoded. The single source of truth
     * for "is this the same dataset as last time."
     */
    contentHash: text("content_hash").notNull(),
    /** Bytes on disk. Bigint because 64-bit overflows at 9 EiB. */
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    /** Optional row count, populated by the schema sniffer (19B.3). */
    rowCount: bigint("row_count", { mode: "number" }),
    /**
     * Inferred schema. JSONB so v2 can introduce richer types
     * (nested, polymorphic, etc.) without a migration. The shape is:
     *
     *   {
     *     kind: "tabular" | "text" | "image" | "audio" | ...,
     *     columns?: Array<{ name: string, type: "string" | "number" | "boolean" | "date" | "json", nullable?: boolean }>,
     *     sample_uri?: string,        // s3://... to a 1MB peek
     *     mime_type?: string,         // e.g. "text/csv", "application/json"
     *     encoding?: string,          // e.g. "utf-8"
     *     notes?: string,             // any inference the sniffer couldn't categorize
     *   }
     */
    schemaJson: jsonb("schema_json").$type<DatasetSchema>().notNull(),
    /** Optional human-readable changelog. */
    changelog: text("changelog"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** A dataset can't have two versions with the same semver string. */
    datasetVersionIdx: uniqueIndex("dataset_versions_dataset_version_idx").on(
      t.datasetId,
      t.version,
    ),
    datasetIdx: index("dataset_versions_dataset_idx").on(t.datasetId),
    contentHashIdx: index("dataset_versions_content_hash_idx").on(t.contentHash),
  }),
);

// ---------- dataset_access ----------

export const datasetAccess = pgTable(
  "dataset_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    /**
     * User the grant is for. NULL = public grant (anyone with the
     * link can use the dataset up to the mode). Set for explicit grants.
     */
    granteeUserId: uuid("grantee_user_id"),
    mode: datasetAccessMode("mode").notNull(),
    /** Optional expiry. NULL = no expiry. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    grantedBy: uuid("granted_by").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    datasetIdx: index("dataset_access_dataset_idx").on(t.datasetId),
    granteeIdx: index("dataset_access_grantee_idx").on(t.granteeUserId),
  }),
);

// ---------- dataset_audit_logs ----------

export const datasetAuditLogs = pgTable("dataset_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  actorUserId: uuid("actor_user_id"),
  orgId: uuid("org_id"),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- dataset_connectors (Phase 19B.5) ----------
//
// A connector is a background poller that pulls data from an
// external source and writes a new dataset_version on each sync.
// v1 ships one kind: `http_api` (poll a URL with an auth header).
// v2 adds `iot_mqtt`, `huggingface_dataset`, `kaggle_dataset`.
//
// The shape of `configJson` is connector-specific. Each connector
// module under `services/dataset/src/connectors/` defines its own
// TypeScript type and the runtime that does the polling.

export const datasetConnectorKind = pgEnum("dataset_connector_kind", [
  "http_api",
  // v2 candidates — not yet implemented:
  // "iot_mqtt",
  // "huggingface_dataset",
  // "kaggle_dataset",
]);

export const datasetConnectorStatus = pgEnum("dataset_connector_status", [
  "active",
  "paused",
  "error",
]);

export const datasetConnectors = pgTable(
  "dataset_connectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    kind: datasetConnectorKind("kind").notNull(),
    /** Human-readable name. Defaults to the kind + a counter. */
    name: text("name").notNull(),
    /** Connector-specific config. JSONB so each kind defines its own
     *  shape. v1: `{ url, auth_header?, poll_interval_seconds }`. */
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull(),
    status: datasetConnectorStatus("status").notNull().default("active"),
    /** Last error message, if any. NULL = healthy. */
    lastError: text("last_error"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncVersionId: uuid("last_sync_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    datasetIdx: index("dataset_connectors_dataset_idx").on(t.datasetId),
    statusIdx: index("dataset_connectors_status_idx").on(t.status),
  }),
);

// ---------- Types ----------

/** The wire shape of an inferred dataset schema. */
export interface DatasetSchema {
  kind: "tabular" | "text" | "image" | "audio" | "time_series" | "multimodal" | "other";
  columns?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "date" | "json";
    nullable?: boolean;
  }>;
  sampleUri?: string;
  mimeType?: string;
  encoding?: string;
  notes?: string;
}

export type Dataset = typeof datasets.$inferSelect;
export type NewDataset = typeof datasets.$inferInsert;
export type DatasetVersion = typeof datasetVersions.$inferSelect;
export type NewDatasetVersion = typeof datasetVersions.$inferInsert;
export type DatasetAccess = typeof datasetAccess.$inferSelect;
export type NewDatasetAccess = typeof datasetAccess.$inferInsert;
export type DatasetAuditLog = typeof datasetAuditLogs.$inferSelect;
export type NewDatasetAuditLog = typeof datasetAuditLogs.$inferInsert;
export type DatasetConnector = typeof datasetConnectors.$inferSelect;
export type NewDatasetConnector = typeof datasetConnectors.$inferInsert;
