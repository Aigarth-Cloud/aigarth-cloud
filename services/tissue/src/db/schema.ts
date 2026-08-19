/**
 * Tissue service — Drizzle schema.
 *
 *   tissues               — the canonical tissue record
 *   tissue_members        — per-tissue ANN membership with role + authority
 *   tissue_decisions      — append-only log of every tissue-level decision
 *   tissue_audit_logs     — service-local audit log
 *
 * See ADR 003 — Trinary Protocol v1 — for the design rationale.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  numeric,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tissueStatus = pgEnum("tissue_status", [
  "draft",
  "active",
  "paused",
  "deprecated",
]);

export const tissueVisibility = pgEnum("tissue_visibility", [
  "public",
  "unlisted",
  "private",
]);

export const tissueMemberRole = pgEnum("tissue_member_role", [
  "voting",
  "veto",
  "advisory",
]);

/** Phase 18E — per-tissue access model. */
export const tissueAccess = pgEnum("tissue_access", ["open", "licensed"]);

// ---------- Tissues ----------

export const tissues = pgTable(
  "tissues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** URL-friendly unique identifier (kebab-case, derived from name). */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    ownerUserId: uuid("owner_user_id").notNull(),
    ownerOrgId: uuid("owner_org_id"),
    visibility: tissueVisibility("visibility").notNull().default("public"),
    status: tissueStatus("status").notNull().default("draft"),
    /** Semver; bumped on breaking changes to the policy or member list. */
    version: text("version").notNull().default("1.0.0"),
    /**
     * The consensus policy. JSONB so v2 can introduce richer
     * policy shapes (e.g. weighted-by-context) without a schema
     * migration. Must round-trip through `ConsensusPolicySchema`
     * from `@aigarth/trinary`.
     */
    policy: jsonb("policy").$type<Record<string, unknown>>().notNull(),
    /** Denormalized policy kind for indexed queries. */
    policyKind: text("policy_kind").notNull(),

    /**
     * Phase 18E — per-tissue access model.
     *   `open`     — anyone can call (default).
     *   `licensed` — caller must have an explicit grant
     *                in `tissue_licenses`.
     */
    access: tissueAccess("access").notNull().default("open"),
    /** Denormalized call counter. */
    totalDecisions: bigint("total_decisions", { mode: "bigint" }).notNull().default(sql`0`),
    /** Free-form metadata. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    slugIdx: uniqueIndex("tissues_slug_idx").on(t.slug),
    statusIdx: index("tissues_status_idx").on(t.status),
    visibilityIdx: index("tissues_visibility_idx").on(t.visibility),
    ownerIdx: index("tissues_owner_idx").on(t.ownerUserId),
    policyKindIdx: index("tissues_policy_kind_idx").on(t.policyKind),
  }),
);

// ---------- Members ----------

export const tissueMembers = pgTable(
  "tissue_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tissueId: uuid("tissue_id")
      .notNull()
      .references(() => tissues.id, { onDelete: "cascade" }),
    /**
     * The ANN's slug in the ANN service. We do NOT store a hard
     * FK because tissues and ANNs live in different services (and
     * different DB connections in the future). The slug is the
     * join key.
     */
    annSlug: text("ann_slug").notNull(),
    /**
     * Optional. The ANN's uuid. Populated when the tissue is
     * seeded against a known ANN, or resolved lazily on /decide
     * by the ANN client. Never required.
     */
    annId: uuid("ann_id"),
    role: tissueMemberRole("role").notNull().default("voting"),
    /** Per-call authority override; falls back to envelope.authority. */
    authorityWeight: numeric("authority_weight", { precision: 4, scale: 3 })
      .notNull()
      .default("0.5"),
    /**
     * Priority order. For `short_circuit` policy, the lowest
     * position wins. For all other policies, ignored.
     */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tissueAnnIdx: uniqueIndex("tissue_members_tissue_ann_idx").on(t.tissueId, t.annSlug),
    tissueIdx: index("tissue_members_tissue_idx").on(t.tissueId),
    annSlugIdx: index("tissue_members_ann_slug_idx").on(t.annSlug),
  }),
);

// ---------- Licenses (Phase 18E) ----------
//
//   A `tissue_licenses` row grants a specific grantee (user or
//   org) the right to call a `licensed`-mode tissue. The grant
//   can be time-bound (`expires_at`) and tagged (`source`:
//   "owner_grant" | "marketplace_purchase" | "trial" | "voucher").
//
//   Owner and admin always have implicit access — no row needed.

export const tissueLicenses = pgTable(
  "tissue_licenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tissueId: uuid("tissue_id")
      .notNull()
      .references(() => tissues.id, { onDelete: "cascade" }),
    /** Either a user, an org, or both (org licenses are inherited by members in v2). */
    granteeUserId: uuid("grantee_user_id"),
    granteeOrgId: uuid("grantee_org_id"),
    /** Source: who/what issued the grant. */
    source: text("source").notNull().default("owner_grant"),
    /** Optional. If set, the grant expires at this time. NULL = perpetual. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Optional. Max number of decisions the grantee can make. NULL = unlimited. */
    maxDecisions: bigint("max_decisions", { mode: "bigint" }),
    /** Revoked grants stay in the table (audit trail). */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tissueIdx: index("tissue_licenses_tissue_idx").on(t.tissueId),
    granteeUserIdx: index("tissue_licenses_grantee_user_idx").on(t.granteeUserId),
    granteeOrgIdx: index("tissue_licenses_grantee_org_idx").on(t.granteeOrgId),
  }),
);

// ---------- Decisions (append-only) ----------

export const tissueDecisions = pgTable(
  "tissue_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tissueId: uuid("tissue_id")
      .notNull()
      .references(() => tissues.id, { onDelete: "cascade" }),
    /** Tissue version (semver) at decision time. */
    tissueVersion: text("tissue_version").notNull(),
    /** Caller-supplied request id for cross-service tracing. */
    requestId: text("request_id").notNull(),
    callerUserId: uuid("caller_user_id"),
    callerOrgId: uuid("caller_org_id"),
    /** Trinary state, denormalized. */
    state: integer("state").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    authority: numeric("authority", { precision: 4, scale: 3 }).notNull(),
    reasoning: text("reasoning").notNull(),
    reversibility: text("reversibility").notNull(),
    timeHorizon: text("time_horizon").notNull(),
    /**
     * Array of per-member contribution records, for replay:
     *   { ann_slug, ann_id?, ann_version, state, confidence,
     *     authority, signature, decision_id, latency_ms, role }
     */
    contributors: jsonb("contributors").$type<Array<Record<string, unknown>>>().notNull(),
    /**
     * Array of ignored members (ANN not found, not in trinary
     * mode, timed out, etc.):
     *   { ann_slug, reason }
     */
    ignored: jsonb("ignored").$type<Array<Record<string, unknown>>>().notNull().default([]),
    /** Full tissue envelope (signed) for replay. */
    envelope: jsonb("envelope").$type<Record<string, unknown>>().notNull(),
    signature: text("signature").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Total decision latency in ms (from request received to envelope signed). */
    latencyMs: integer("latency_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tissueIdx: index("tissue_decisions_tissue_idx").on(t.tissueId),
    tissueIssuedIdx: index("tissue_decisions_tissue_issued_idx").on(t.tissueId, t.issuedAt),
    requestIdx: index("tissue_decisions_request_idx").on(t.requestId),
    stateIdx: index("tissue_decisions_state_idx").on(t.tissueId, t.state),
  }),
);

// ---------- Audit log ----------

export const auditLogs = pgTable(
  "tissue_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id"),
    orgId: uuid("org_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index("tissue_audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: index("tissue_audit_logs_action_idx").on(t.action),
    createdIdx: index("tissue_audit_logs_created_idx").on(t.createdAt),
  }),
);

// ---------- Type exports ----------

export type Tissue = typeof tissues.$inferSelect;
export type NewTissue = typeof tissues.$inferInsert;
export type TissueMember = typeof tissueMembers.$inferSelect;
export type NewTissueMember = typeof tissueMembers.$inferInsert;
export type TissueLicense = typeof tissueLicenses.$inferSelect;
export type NewTissueLicense = typeof tissueLicenses.$inferInsert;
export type TissueDecision = typeof tissueDecisions.$inferSelect;
export type NewTissueDecision = typeof tissueDecisions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type TissueStatus = (typeof tissueStatus.enumValues)[number];
export type TissueVisibility = (typeof tissueVisibility.enumValues)[number];
export type TissueMemberRole = (typeof tissueMemberRole.enumValues)[number];
export type TissueAccess = (typeof tissueAccess.enumValues)[number];
