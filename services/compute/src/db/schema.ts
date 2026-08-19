/**
 * Compute service — Drizzle schema.
 *
 * Design notes:
 *   - `regions` and `clusters` describe topology: how the 676 Qubic
 *     computors are grouped for routing.
 *   - `cluster_members` is a many-to-many of computors (by their
 *     computor_index 0..675) to clusters. A computor can be in
 *     multiple clusters; a cluster spans one region.
 *   - `jobs` are user-submitted compute tasks. They start queued, get
 *     broadcast to Qubic (submitted), and progress through the Qubic
 *     tick lifecycle. Final state: completed | failed | cancelled.
 *   - `reservations` lock QUBIC for a fixed number of epochs in
 *     exchange for capacity credits. Released early = partial refund
 *     (minus a small fee).
 *   - `node_reservations` (Phase 24) are the hardware presale spot
 *     reservations. USD-anchored, two-stage payment, yield opt-in.
 *   - `qubic_usd_rates` (Phase 24) is the price oracle mirror,
 *     refreshed every 60s by the usd-price-oracle worker.
 *   - `capacity_credits` is the derived spend balance for a user.
 *     Computed on read from active reservations.
 *   - All bigint columns omit defaults (drizzle-kit can't serialize
 *     BigInt literals). All bigint amounts are inserted explicitly.
 *   - Audit log is renamed to `compute_audit_logs` to avoid collision
 *     with identity.audit_logs and qubic.qubic_audit_logs in the
 *     shared `public` schema.
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
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------

export const jobStatus = pgEnum("job_status", [
  "queued",         // accepted by API, not yet broadcast
  "submitted",      // broadcast to Qubic, awaiting inclusion in a tick
  "running",        // included in a tick, computor is executing
  "completed",      // computor returned a result
  "failed",         // broadcast, run, or compute error
  "cancelled",      // user cancelled before completion
]);

export const jobType = pgEnum("job_type", [
  "contract_call",  // invoke a specific Qubic smart contract
  "training",       // ANN training job (future)
  "inference",      // ANN inference (future)
  "general",        // free-form compute
]);

export const reservationStatus = pgEnum("reservation_status", [
  "active",         // locked, can submit jobs
  "released",       // user released early
  "expired",        // epoch ended
  "cancelled",      // user cancelled before broadcast
]);

export const clusterMemberStatus = pgEnum("cluster_member_status", [
  "active",
  "draining",       // not accepting new jobs, finishing in-flight
  "removed",        // removed from cluster
]);

export const nodeReservationStatus = pgEnum("node_reservation_status", [
  "pending_funding",   // row created, user has not yet signed the deposit tx
  "spot_held",         // deposit confirmed, awaiting mainnet activation
  "awaiting_confirm",  // mainnet activated, user has 14 days to confirm or release
  "confirmed",         // balance paid, compute allocation unlocked
  "released",          // user cancelled or auto-released
]);

export const nodeEscrowDirection = pgEnum("compute_node_escrow_direction", [
  "debit",   // user paid in: QUBIC moved from user -> escrow
  "credit",  // user paid out: QUBIC moved from escrow -> user (on release/refund)
]);

export const nodeEscrowPurpose = pgEnum("compute_node_escrow_purpose", [
  "deposit",        // initial deposit payment
  "balance",        // balance payment on confirm
  "refund",         // refund on release
  "yield_credit",   // yield credited at confirm (informational, not a fund movement)
  "penalty",        // penalty burned on post-confirm release
]);

// ---------- Regions ----------

export const regions = pgTable(
  "compute_regions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(), // "global", "eu-west", "us-east"
    slug: text("slug").notNull(), // "global", "eu-west", "us-east" (URL-safe)
    description: text("description"),
    /** Number of computors in this region. */
    computorCount: integer("computor_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("compute_regions_slug_idx").on(t.slug),
  }),
);

// ---------- Clusters ----------

export const clusters = pgTable(
  "compute_clusters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    purpose: text("purpose").notNull().default("general"), // "training" | "inference" | "general"
    minComputors: integer("min_computors").notNull().default(3), // for redundancy
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    regionSlugIdx: uniqueIndex("compute_clusters_region_slug_idx").on(t.regionId, t.slug),
    regionIdx: index("compute_clusters_region_idx").on(t.regionId),
  }),
);

export const clusterMembers = pgTable(
  "compute_cluster_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => clusters.id, { onDelete: "cascade" }),
    /** 0..675 (Qubic's computor index). */
    computorIndex: integer("computor_index").notNull(),
    status: clusterMemberStatus("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clusterComputorIdx: uniqueIndex("compute_cluster_members_cluster_computor_idx").on(
      t.clusterId,
      t.computorIndex,
    ),
    computorIdx: index("compute_cluster_members_computor_idx").on(t.computorIndex),
  }),
);

// ---------- Jobs ----------

export const jobs = pgTable(
  "compute_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    clusterId: uuid("cluster_id").references(() => clusters.id),
    regionId: uuid("region_id").references(() => regions.id),
    type: jobType("type").notNull().default("general"),
    /** For contract_call: which contract to invoke. */
    contractIndex: integer("contract_index"),
    functionIndex: integer("function_index"),
    /** Job payload / contract args. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** 0 = lowest, 10 = highest. */
    priority: integer("priority").notNull().default(5),
    status: jobStatus("status").notNull().default("queued"),
    /** Qubic tx hash once broadcast. */
    txHash: text("tx_hash"),
    /** Tick the job was submitted at. */
    submittedTick: integer("submitted_tick"),
    /** Tick the job was included in (started running). */
    startedTick: integer("started_tick"),
    /** Tick the job completed at. */
    completedTick: integer("completed_tick"),
    /** Result from the computor (if completed). */
    result: jsonb("result").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    /** Cost in QUBIC (smallest unit). */
    creditUsedQubic: bigint("credit_used_qubic", { mode: "bigint" }),
    /** Optional pointer to the reservation that funded this job. */
    reservationId: uuid("reservation_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Deadline for completion (auto-fail if missed). */
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("compute_jobs_user_idx").on(t.userId),
    statusIdx: index("compute_jobs_status_idx").on(t.status),
    clusterIdx: index("compute_jobs_cluster_idx").on(t.clusterId),
    regionIdx: index("compute_jobs_region_idx").on(t.regionId),
    txHashIdx: index("compute_jobs_tx_hash_idx").on(t.txHash),
  }),
);

// ---------- Reservations ----------

export const reservations = pgTable(
  "compute_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    /** Optional cross-reference to a Qubic wallet id (from services/qubic). */
    qubicWalletId: uuid("qubic_wallet_id"),
    /** Principal locked in QUBIC (smallest unit). */
    principalQubic: bigint("principal_qubic", { mode: "bigint" }).notNull(),
    /** Fee in basis points (e.g. 50 = 0.5%). */
    feeBps: integer("fee_bps").notNull().default(50),
    /** Net credit = principal - fee. Stored at creation. */
    creditQubic: bigint("credit_qubic", { mode: "bigint" }).notNull(),
    /** How many QUBIC has been spent against this credit so far. */
    usedQubic: bigint("used_qubic", { mode: "bigint" }).notNull(),
    epochs: integer("epochs").notNull(),
    startEpoch: integer("start_epoch").notNull(),
    endEpoch: integer("end_epoch").notNull(),
    status: reservationStatus("status").notNull().default("active"),
    txHash: text("tx_hash"),
    /** When the user explicitly released (vs. expired). */
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("compute_reservations_user_idx").on(t.userId),
    statusIdx: index("compute_reservations_status_idx").on(t.status),
  }),
);

// ---------- Node reservations (Phase 24 — hardware presale) ----------
//
// Two-stage compute spot reservation, modelled on the Otto One presale
// mechanic and adapted to a QUBIC-native flow. The user reserves a tier 1
// (or future tier 2/3) compute spot with a small USD-denominated deposit
// paid in QUBIC. The full commitment is charged when mainnet activates and
// the user confirms. Yield on the held deposit is opt-in.
//
//   pending_funding -> spot_held -> awaiting_confirm -> (confirmed | released)
//
// USD amounts are the anchor (the user pays $X for the deposit, $Y for the
// balance). The actual QUBIC amounts are derived at each charge moment from
// the latest row in `qubic_usd_rates`. Storing the rate at the moment of
// each transition gives us an audit trail and a fair refund calc on release.

export const nodeReservations = pgTable(
  "compute_node_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    /** 1 / 2 / 3. Only tier 1 is open for reservation this phase. */
    tier: integer("tier").notNull().default(1),
    status: nodeReservationStatus("status").notNull().default("pending_funding"),
    /** USD deposit in cents (e.g. 3000 = $30.00). */
    depositUsdCents: bigint("deposit_usd_cents", { mode: "bigint" }).notNull(),
    /** USD balance in cents (e.g. 56900 = $569.00). Set on confirm. */
    balanceUsdCents: bigint("balance_usd_cents", { mode: "bigint" }),
    /** Actual QUBIC amount paid for the deposit (smallest unit). */
    depositQubic: bigint("deposit_qubic", { mode: "bigint" }),
    /** Actual QUBIC amount paid for the balance (smallest unit). Set on confirm. */
    balanceQubic: bigint("balance_qubic", { mode: "bigint" }),
    /** QUBIC/USD rate (USD per 1 QUBIC) at the moment of the deposit. */
    qubicUsdRateAtReserve: bigint("qubic_usd_rate_at_reserve", { mode: "bigint" }),
    /** QUBIC/USD rate at the moment of the balance confirm. */
    qubicUsdRateAtConfirm: bigint("qubic_usd_rate_at_confirm", { mode: "bigint" }),
    /** User opted in to Qearn yield on the held deposit. Default off. */
    yieldOptIn: boolean("yield_opt_in").notNull().default(false),
    /** QUBIC yield accrued, credited on confirm. 0 unless yieldOptIn. */
    yieldCreditQubic: bigint("yield_credit_qubic", { mode: "bigint" }).notNull().default(0n),
    /** On-chain Qearn lock reference. Nullable until lock is created. */
    qearnLockId: text("qearn_lock_id"),
    /** Optional cross-reference to a Qubic wallet id (from services/qubic). */
    qubicWalletId: uuid("qubic_wallet_id"),
    /** Idempotency: the on-chain tx hash for the deposit payment. */
    txHashReserve: text("tx_hash_reserve"),
    /** Idempotency: the on-chain tx hash for the balance payment. */
    txHashConfirm: text("tx_hash_confirm"),
    /** Set by openConfirmWindow — when the 14-day window starts. */
    confirmWindowOpensAt: timestamp("confirm_window_opens_at", { withTimezone: true }),
    /** confirmWindowOpensAt + 14 days. After this, auto-release. */
    confirmWindowClosesAt: timestamp("confirm_window_closes_at", { withTimezone: true }),
    /** Set when user explicitly releases (vs auto-released at window close). */
    releasedAt: timestamp("released_at", { withTimezone: true }),
    /** Set when the auto-release fires (window closed). */
    autoReleasedAt: timestamp("auto_released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("compute_node_reservations_user_idx").on(t.userId),
    statusIdx: index("compute_node_reservations_status_idx").on(t.status),
    tierIdx: index("compute_node_reservations_tier_idx").on(t.tier),
    /** Idempotency: a given tx_hash can only fund one reservation. */
    txHashReserveIdx: uniqueIndex("compute_node_reservations_tx_hash_reserve_idx").on(
      t.txHashReserve,
    ),
    txHashConfirmIdx: uniqueIndex("compute_node_reservations_tx_hash_confirm_idx").on(
      t.txHashConfirm,
    ),
  }),
);

/** Latest QUBIC/USD rate, refreshed by the price oracle. */
export const qubicUsdRates = pgTable(
  "compute_qubic_usd_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * USD per 1 QUBIC, scaled to 10 decimals of precision (e.g. 0.0000004450
     * stored as 4450). The service computes QUBIC amounts with
     * `usdCents * 10^8 / rateScaled`; see services/node-reservations.ts
     * for the full convention. Avoids float drift on rate lookups.
     */
    rateScaled: bigint("rate_scaled", { mode: "bigint" }).notNull(),
    /** Source label (e.g. "coingecko", "coinmarketcap", "median"). */
    source: text("source").notNull().default("coingecko"),
    /** Raw USD per 1 QUBIC, for display only. */
    rateRaw: text("rate_raw").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    fetchedIdx: index("compute_qubic_usd_rates_fetched_idx").on(t.fetchedAt),
  }),
);

// ---------- Node yield locks (Phase 24.4) ----------
//
// Tracks the Qearn lock created when a node reservation's deposit is
// yield-opted-in. The lock is a stub in Phase 24 — the real Qearn
// integration lands in Phase 25+ (depends on Phase 20.6 multisig).
// The stub uses a deterministic 5% APY linear accrual so the marketing
// page's "earn yield" claim has a concrete number behind it.

export const nodeYieldLock = pgTable(
  "compute_node_yield_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => nodeReservations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    /** Principal QUBIC locked. */
    principalQubic: bigint("principal_qubic", { mode: "bigint" }).notNull(),
    /** Annual yield in basis points. Default 500 = 5% APY. */
    apyBps: integer("apy_bps").notNull().default(500),
    /** When the lock was created (UTC). */
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the lock was released (null until released). */
    releasedAt: timestamp("released_at", { withTimezone: true }),
    /** Yield at the time of release. 0 unless released. */
    yieldAtReleaseQubic: bigint("yield_at_release_qubic", { mode: "bigint" }),
    /** Qearn on-chain lock id (null in Phase 24 stub). */
    qearnLockId: text("qearn_lock_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reservationIdx: uniqueIndex("compute_node_yield_locks_reservation_idx").on(t.reservationId),
    userIdx: index("compute_node_yield_locks_user_idx").on(t.userId),
  }),
);
//
// Double-entry ledger for the QUBIC held against a node reservation.
// `debit` rows are payments in (user -> escrow). `credit` rows are
// payments out (escrow -> user, on release/refund). The escrow's
// running balance is `sum(debits) - sum(credits)` per reservation.
//
// The actual multisig hold is a stub in Phase 24.1; Phase 20.6 wires
// the real QPI multisig. This table is the off-chain audit mirror that
// the multisig will reconcile against.

export const nodeEscrow = pgTable(
  "compute_node_escrow",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => nodeReservations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    direction: nodeEscrowDirection("direction").notNull(),
    purpose: nodeEscrowPurpose("purpose").notNull(),
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    /** Idempotency: the on-chain tx hash. */
    txHash: text("tx_hash").notNull(),
    /** QUBIC/USD rate at the moment of this entry (scaled by 10^10). */
    rateScaledAtEntry: bigint("rate_scaled_at_entry", { mode: "bigint" }),
    /** Optional: reference to a yield_credit entry (informational). */
    yieldCreditRef: text("yield_credit_ref"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reservationIdx: index("compute_node_escrow_reservation_idx").on(t.reservationId),
    userIdx: index("compute_node_escrow_user_idx").on(t.userId),
    /** Idempotency: a given tx_hash can only record one entry. */
    txHashIdx: uniqueIndex("compute_node_escrow_tx_hash_idx").on(t.txHash),
    purposeIdx: index("compute_node_escrow_purpose_idx").on(t.purpose),
  }),
);

// ---------- Audit log ----------

export const auditLogs = pgTable(
  "compute_audit_logs",
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
    actorIdx: index("compute_audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: index("compute_audit_logs_action_idx").on(t.action),
    createdIdx: index("compute_audit_logs_created_idx").on(t.createdAt),
  }),
);

// ---------- Relations ----------

export const regionsRelations = relations(regions, ({ many }) => ({
  clusters: many(clusters),
  jobs: many(jobs),
}));

export const clustersRelations = relations(clusters, ({ one, many }) => ({
  region: one(regions, { fields: [clusters.regionId], references: [regions.id] }),
  members: many(clusterMembers),
  jobs: many(jobs),
}));

export const clusterMembersRelations = relations(clusterMembers, ({ one }) => ({
  cluster: one(clusters, { fields: [clusterMembers.clusterId], references: [clusters.id] }),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  region: one(regions, { fields: [jobs.regionId], references: [regions.id] }),
  cluster: one(clusters, { fields: [jobs.clusterId], references: [clusters.id] }),
}));

export const reservationsRelations = relations(reservations, ({ many }) => ({
  // jobs: many(jobs) -- we'll skip the explicit FK here to avoid migration ordering
}));

export const nodeReservationsRelations = relations(nodeReservations, ({ many }) => ({
  escrow: many(nodeEscrow),
}));

export const nodeEscrowRelations = relations(nodeEscrow, ({ one }) => ({
  reservation: one(nodeReservations, {
    fields: [nodeEscrow.reservationId],
    references: [nodeReservations.id],
  }),
}));

// No relations on qubicUsdRates — it's a single time-series table.

// ---------- Type exports ----------

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
export type Cluster = typeof clusters.$inferSelect;
export type NewCluster = typeof clusters.$inferInsert;
export type ClusterMember = typeof clusterMembers.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobStatus = (typeof jobStatus.enumValues)[number];
export type JobType = (typeof jobType.enumValues)[number];
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type ReservationStatus = (typeof reservationStatus.enumValues)[number];
export type NodeReservation = typeof nodeReservations.$inferSelect;
export type NewNodeReservation = typeof nodeReservations.$inferInsert;
export type NodeReservationStatus = (typeof nodeReservationStatus.enumValues)[number];
export type QubicUsdRate = typeof qubicUsdRates.$inferSelect;
export type NewQubicUsdRate = typeof qubicUsdRates.$inferInsert;
export type NodeEscrow = typeof nodeEscrow.$inferSelect;
export type NewNodeEscrow = typeof nodeEscrow.$inferInsert;
export type NodeEscrowDirection = (typeof nodeEscrowDirection.enumValues)[number];
export type NodeEscrowPurpose = (typeof nodeEscrowPurpose.enumValues)[number];
export type NodeYieldLock = typeof nodeYieldLock.$inferSelect;
export type NewNodeYieldLock = typeof nodeYieldLock.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
