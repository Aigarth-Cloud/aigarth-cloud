/**
 * Economy service — Drizzle schema.
 *
 * Per ADR 001 §4.1 and ADR 002 §7, the economy module owns the off-chain
 * mirror of:
 *
 *   contributor_shares     — multi-creator revenue share on an ANN
 *   payout_runs            — a single scheduled payout for an ANN over a window
 *   payout_recipients      — one row per recipient in a payout_run
 *   bundle_listings        — a marketplace listing that bundles N ANNs (the
 *                            "intelligence index" use case, properly framed
 *                            as a marketplace construct, not a financial product)
 *   aigarth_economy_locks  — off-chain mirror of observed Qearn locks; the
 *                            Qearn watcher writes here, the compute grant reads
 *                            from here
 *   economy_audit_logs     — service-local audit log
 *
 * Design notes (mirror the other services):
 *   - Bigint columns omit defaults (drizzle-kit can't serialize BigInt literals).
 *   - All enum columns are prefixed with `economy_` to avoid collision.
 *   - Cross-service refs (user_id, ann_id) are stored as uuid without FK
 *     to avoid coupling schema across services.
 *   - All amounts are in QUBIC (smallest unit). For display, divide by 1e6.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------

export const contributorRole = pgEnum("economy_contributor_role", [
  "creator",
  "co_creator",
  "data_provider",
  "curator",
  "reviewer",
]);

export const payoutRunStatus = pgEnum("economy_payout_run_status", [
  "draft",         // being assembled
  "pending",       // ready to settle
  "settling",      // settlement in progress (NATS ack pending)
  "settled",       // all recipients paid
  "partial",       // some recipients failed; needs retry
  "failed",        // settlement fully failed
  "cancelled",     // manual cancel before settle
]);

export const payoutRecipientStatus = pgEnum("economy_payout_recipient_status", [
  "pending",
  "broadcast",
  "confirmed",
  "failed",
  "skipped",       // recipient wallet unreachable; will be retried next run
]);

export const bundleListingKind = pgEnum("economy_bundle_listing_kind", [
  "collection",   // free grouping (the "Caribbean Intelligence Index" example)
  "starter_pack", // onboarding bundle
  "curated",      // hand-picked
]);

export const economyLockStatus = pgEnum("economy_lock_status", [
  "observed",     // tx seen, lock details not yet confirmed
  "active",       // lock confirmed, grant in effect
  "unlocking",    // early/full unlock intent broadcast, awaiting finality
  "ended",        // unlock finalized; grant revoked
  "expired",      // lock duration elapsed without explicit unlock
  "failed",       // observed tx could not be parsed as a valid Qearn lock
]);

// ---------- Contributor shares ----------

/**
 * One row per (ann_id, user_id) with the user's basis-point share of
 * revenue for that ANN. The sum of bps for a given ann_id must be
 * 10000 (100%); this is enforced at write time, not by DB constraint
 * (Postgres deferrable constraints add complexity for little benefit).
 */
export const contributorShares = pgTable(
  "economy_contributor_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    annId: uuid("ann_id").notNull(),
    userId: uuid("user_id").notNull(),
    /** Basis points of the ANN's net revenue (0–10000). */
    bps: integer("bps").notNull(),
    role: contributorRole("role").notNull().default("co_creator"),
    /** Optional human-readable label, e.g. "Dataset curator" or "Reviewer". */
    label: text("label"),
    /** Whether this row is currently active. Inactive rows are kept for audit. */
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    annUserIdx: uniqueIndex("economy_contributor_shares_ann_user_idx").on(t.annId, t.userId),
    annIdx: index("economy_contributor_shares_ann_idx").on(t.annId),
    userIdx: index("economy_contributor_shares_user_idx").on(t.userId),
  }),
);

// ---------- Payout runs ----------

/**
 * A payout_run is the canonical record of "we paid out revenue for
 * ANN X over the period Y to Z". It has many payout_recipients.
 */
export const payoutRuns = pgTable(
  "economy_payout_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    annId: uuid("ann_id").notNull(),
    /** Period start (inclusive). */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    /** Period end (exclusive). */
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** Total QUBIC billed to consumers of this ANN over the period. */
    totalRevenueQubic: bigint("total_revenue_qubic", { mode: "bigint" }).notNull(),
    /** Platform fee in QUBIC (subtracted from total before split). */
    platformFeeQubic: bigint("platform_fee_qubic", { mode: "bigint" }).notNull(),
    /** Net to contributors = totalRevenue - platformFee. */
    netToContributorsQubic: bigint("net_to_contributors_qubic", { mode: "bigint" }).notNull(),
    /** Platform fee rate used (basis points, recorded for audit). */
    platformFeeBps: integer("platform_fee_bps").notNull(),
    status: payoutRunStatus("status").notNull().default("draft"),
    /** Source-of-truth billing records aggregated into this run. */
    sourceUsageRecordIds: jsonb("source_usage_record_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
  },
  (t) => ({
    annIdx: index("economy_payout_runs_ann_idx").on(t.annId),
    statusIdx: index("economy_payout_runs_status_idx").on(t.status),
    periodIdx: index("economy_payout_runs_period_idx").on(t.periodStart, t.periodEnd),
  }),
);

/**
 * One row per recipient in a payout_run. Tracks the actual Qubic tx
 * for that recipient (or the failure reason if it couldn't be sent).
 */
export const payoutRecipients = pgTable(
  "economy_payout_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payoutRunId: uuid("payout_run_id")
      .notNull()
      .references(() => payoutRuns.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    /** Recipient's Qubic address (60-char A-Z). */
    walletAddress: text("wallet_address").notNull(),
    /** Basis points of net revenue this recipient receives. */
    bps: integer("bps").notNull(),
    /** Computed amount in QUBIC (bps * netToContributors / 10000). */
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    status: payoutRecipientStatus("status").notNull().default("pending"),
    /** Tx hash once broadcast. */
    txHash: text("tx_hash"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => ({
    runIdx: index("economy_payout_recipients_run_idx").on(t.payoutRunId),
    statusIdx: index("economy_payout_recipients_status_idx").on(t.status),
  }),
);

// ---------- Bundle listings ----------

/**
 * A bundle_listing is a marketplace listing that contains N ANNs.
 * The "Caribbean Intelligence Index" / "intelligence ETF" use case
 * is a bundle_listing — a curated set, not a tradable share.
 *
 * The actual marketplace record lives in services/marketplace; this
 * table holds the bundle-specific metadata (which ANNs, in what order,
 * with what type).
 */
export const bundleListings = pgTable(
  "economy_bundle_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The marketplace listing id (foreign key in spirit, not enforced). */
    listingId: uuid("listing_id").notNull(),
    kind: bundleListingKind("kind").notNull().default("collection"),
    /** Ordered list of ann_ids in the bundle. */
    annIds: jsonb("ann_ids").$type<string[]>().notNull().default([]),
    /** Total QUBIC price for the bundle. */
    bundlePriceQubic: bigint("bundle_price_qubic", { mode: "bigint" }).notNull(),
    /** Discount vs sum-of-parts in basis points (0 = no discount, 2000 = 20% off). */
    discountBps: integer("discount_bps").notNull().default(0),
    /** Free-form curator notes. */
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    listingIdx: uniqueIndex("economy_bundle_listings_listing_idx").on(t.listingId),
  }),
);

// ---------- Aigarth economy locks (Qearn mirror) ----------

/**
 * The off-chain mirror of observed Qearn locks. Written by the
 * Qearn watcher worker (`src/workers/qearn-watcher.ts`) and read by
 * the compute-grant logic in `src/services/splits.ts` to refresh a
 * user's compute allocation.
 *
 * One row per observed lock. status transitions:
 *   observed → active → (unlocking →) ended | expired | failed
 */
export const aigarthEconomyLocks = pgTable(
  "economy_aigarth_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Aigarth user who owns the lock (the lock's principal beneficiary). */
    userId: uuid("user_id").notNull(),
    /** Qubic address the lock is held against. */
    walletAddress: text("wallet_address").notNull(),
    /** Qearn's lock id, as observed on-chain. */
    qearnLockId: text("qearn_lock_id").notNull(),
    /** The Qearn tx hash that created the lock. */
    lockTxHash: text("lock_tx_hash").notNull(),
    /** The Qearn tx hash that ended the lock, if applicable. */
    unlockTxHash: text("unlock_tx_hash"),
    /** Locked principal in QUBIC. */
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    /** Total lock duration in weeks (1–52 per Qearn rules). */
    totalWeeks: integer("total_weeks").notNull(),
    /** Epoch the lock starts earning from. */
    startEpoch: integer("start_epoch").notNull(),
    /** Tick the lock was sealed at. */
    startTick: integer("start_tick").notNull(),
    /** Tick the lock was ended at (null if still active). */
    endTick: integer("end_tick"),
    /** Net reward paid out on unlock (after penalty). Set on unlock; 0 until then. */
    netRewardQubic: bigint("net_reward_qubic", { mode: "bigint" }).notNull(),
    /** Penalty burned on unlock. Set on unlock; 0 until then. */
    penaltyBurnedQubic: bigint("penalty_burned_qubic", { mode: "bigint" }).notNull(),
    status: economyLockStatus("status").notNull().default("observed"),
    /** The compute allocation this lock is currently granting, in compute-credit units. */
    computeGrantUnits: bigint("compute_grant_units", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("economy_aigarth_locks_user_idx").on(t.userId),
    statusIdx: index("economy_aigarth_locks_status_idx").on(t.status),
    qearnLockIdx: uniqueIndex("economy_aigarth_locks_qearn_lock_idx").on(t.qearnLockId),
  }),
);

// ---------- Relations ----------

export const payoutRunsRelations = relations(payoutRuns, ({ many }) => ({
  recipients: many(payoutRecipients),
}));

export const payoutRecipientsRelations = relations(payoutRecipients, ({ one }) => ({
  run: one(payoutRuns, { fields: [payoutRecipients.payoutRunId], references: [payoutRuns.id] }),
}));

// ---------- Type exports ----------

export type ContributorShare = typeof contributorShares.$inferSelect;
export type NewContributorShare = typeof contributorShares.$inferInsert;
export type PayoutRun = typeof payoutRuns.$inferSelect;
export type NewPayoutRun = typeof payoutRuns.$inferInsert;
export type PayoutRecipient = typeof payoutRecipients.$inferSelect;
export type NewPayoutRecipient = typeof payoutRecipients.$inferInsert;
export type BundleListing = typeof bundleListings.$inferSelect;
export type NewBundleListing = typeof bundleListings.$inferInsert;
export type AigarthEconomyLock = typeof aigarthEconomyLocks.$inferSelect;
export type NewAigarthEconomyLock = typeof aigarthEconomyLocks.$inferInsert;

// ---------- Audit log ----------

// Inlined here so drizzle-kit's bundler resolves it without an extra file.
import { pgTable as _pgTable, uuid as _uuid, text as _text, timestamp as _ts, jsonb as _jsonb, index as _index } from "drizzle-orm/pg-core";

export const economyAuditLogs = _pgTable(
  "economy_audit_logs",
  {
    id: _uuid("id").defaultRandom().primaryKey(),
    actorUserId: _uuid("actor_user_id"),
    orgId: _uuid("org_id"),
    action: _text("action").notNull(),
    targetType: _text("target_type"),
    targetId: _text("target_id"),
    metadata: _jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: _ts("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: _index("economy_audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: _index("economy_audit_logs_action_idx").on(t.action),
    createdIdx: _index("economy_audit_logs_created_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof economyAuditLogs.$inferSelect;
