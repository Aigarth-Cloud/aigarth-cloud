/**
 * Qubic service — Drizzle schema.
 *
 * Owns:
 *   qubic_wallets          — internal cache of user → Qubic address (mirrors identity.wallet_links)
 *   qubic_balances         — most recent known balance per wallet (refreshed on reads)
 *   stakes                 — staking positions (intent → broadcast → confirmed → released)
 *   transactions           — on-chain transactions we know about (broadcast or observed)
 *   rewards                — per-epoch reward accruals and claims
 *   validators             — known Qubic computors (validators)
 *   treasury_movements     — append-only log of treasury inflows/outflows
 *   epoch_snapshots        — point-in-time totals per epoch
 *
 * Notes:
 *   - All amounts are stored in **QUBIC** (the smallest unit, 1 QUBIC = 1).
 *     For display, divide by 1e6 to get "Qu" (the conventional unit).
 *   - `tick_number` is Qubic's logical clock (per network tick, ~1s on mainnet).
 *   - Signatures are stored as base64url-encoded bytes.
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

export const network = pgEnum("network", ["mainnet", "testnet"]);

export const stakeStatus = pgEnum("stake_status", [
  "pending_signature", // user signed the intent, not yet broadcast
  "pending_broadcast", // queued for broadcast
  "broadcast",        // sent to the network
  "confirming",       // included in a tick but not yet final
  "active",           // confirmed and earning
  "unstaking",        // cool-down in progress
  "released",         // principal returned to wallet
  "failed",           // broadcast or confirm failed
  "cancelled",        // user cancelled before broadcast
]);

export const transactionStatus = pgEnum("transaction_status", [
  "queued",
  "broadcast",
  "confirmed",
  "finalized",
  "failed",
  "dropped",
]);

export const transactionDirection = pgEnum("transaction_direction", [
  "inbound",
  "outbound",
  "internal",
]);

export const rewardStatus = pgEnum("reward_status", [
  "accruing", // epoch not yet ended
  "claimable", // epoch ended, user can claim
  "claimed", // user has withdrawn
  "forfeited", // stake was released before epoch end
]);

export const treasuryMovementKind = pgEnum("treasury_movement_kind", [
  "stake_fee", // platform fee from a stake
  "unstake_payout", // returning principal to user
  "reward_payout", // paying rewards
  "deposit", // top-up
  "withdrawal", // platform withdrawal
]);

// ---------- Wallets & balances ----------

/**
 * Mirror of identity.wallet_links — the (user, Qubic address) link.
 * Cached here so we don't make a network call to identity for every read.
 */
export const qubicWallets = pgTable(
  "qubic_wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    qubicAddress: text("qubic_address").notNull(),
    /** Identity-side link id (foreign key in spirit, not enforced). */
    identityLinkId: uuid("identity_link_id").notNull(),
    network: network("network").notNull().default("testnet"),
    /** When the user explicitly gave permission to stake with this wallet. */
    stakeAuthorized: boolean("stake_authorized").notNull().default(false),
    /** When stake authorization expires. */
    stakeAuthorizationExpiresAt: timestamp("stake_authorization_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userAddrIdx: uniqueIndex("qubic_wallets_user_addr_idx").on(t.userId, t.qubicAddress),
    addrIdx: index("qubic_wallets_addr_idx").on(t.qubicAddress),
  }),
);

export const qubicBalances = pgTable(
  "qubic_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => qubicWallets.id, { onDelete: "cascade" }),
    /** Balance in QUBIC (smallest unit). */
    balanceQubic: bigint("balance_qubic", { mode: "bigint" }).notNull(),
    /** Last seen tick number. */
    tickNumber: integer("tick_number").notNull().default(0),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: uniqueIndex("qubic_balances_wallet_idx").on(t.walletId),
  }),
);

// ---------- Stakes ----------

export const stakes = pgTable(
  "stakes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => qubicWallets.id),
    /** Principal in QUBIC. */
    principalQubic: bigint("principal_qubic", { mode: "bigint" }).notNull(),
    /** The receiver (validator / treasury) address. */
    receiverAddress: text("receiver_address").notNull(),
    /** Epoch the stake starts earning. */
    startEpoch: integer("start_epoch").notNull(),
    /** Number of epochs locked. */
    epochsLocked: integer("epochs_locked").notNull().default(1),
    status: stakeStatus("status").notNull().default("pending_signature"),
    /** Tick the intent was signed. */
    signedTick: integer("signed_tick"),
    /** Tick the transaction was included. */
    confirmedTick: integer("confirmed_tick"),
    /** Hash of the signed intent. */
    intentHash: text("intent_hash"),
    /** Transaction hash once broadcast. */
    txHash: text("tx_hash"),
    /** Failure reason if status is `failed`. */
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("stakes_user_idx").on(t.userId),
    statusIdx: index("stakes_status_idx").on(t.status),
    walletIdx: index("stakes_wallet_idx").on(t.walletId),
  }),
);

// ---------- Transactions ----------

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Internal reference (stake id, treasury id, etc.) */
    refType: text("ref_type"),
    refId: text("ref_id"),
    /** On-chain tx hash (Qubic uses 60-char base-26). */
    txHash: text("tx_hash"),
    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    direction: transactionDirection("direction").notNull(),
    status: transactionStatus("status").notNull().default("queued"),
    tickNumber: integer("tick_number"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => ({
    txHashIdx: uniqueIndex("transactions_tx_hash_idx").on(t.txHash),
    statusIdx: index("transactions_status_idx").on(t.status),
    fromIdx: index("transactions_from_idx").on(t.fromAddress),
    toIdx: index("transactions_to_idx").on(t.toAddress),
  }),
);

// ---------- Rewards ----------

export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stakeId: uuid("stake_id")
      .notNull()
      .references(() => stakes.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    epoch: integer("epoch").notNull(),
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    status: rewardStatus("status").notNull().default("accruing"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimTxHash: text("claim_tx_hash"),
  },
  (t) => ({
    stakeEpochIdx: uniqueIndex("rewards_stake_epoch_idx").on(t.stakeId, t.epoch),
    userIdx: index("rewards_user_idx").on(t.userId),
  }),
);

// ---------- Validators (computors) ----------

export const validators = pgTable(
  "validators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Computor index (0..675). */
    computorIndex: integer("computor_index").notNull(),
    qubicAddress: text("qubic_address").notNull(),
    alias: text("alias"),
    isActive: boolean("is_active").notNull().default(true),
    /** Latest known performance score. */
    performanceScore: integer("performance_score"),
    /** Stake the computor has committed. */
    stakeQubic: bigint("stake_qubic", { mode: "bigint" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    addrIdx: uniqueIndex("validators_addr_idx").on(t.qubicAddress),
    computorIdx: uniqueIndex("validators_computor_idx").on(t.computorIndex),
  }),
);

// ---------- Treasury ----------

export const treasuryMovements = pgTable(
  "treasury_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: treasuryMovementKind("kind").notNull(),
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    /** Counterparty (user, address, etc.). */
    counterparty: text("counterparty"),
    /** Number of signers who approved. */
    signersApproved: integer("signers_approved").notNull().default(0),
    signersRequired: integer("signers_required").notNull().default(1),
    /** Final tx hash once broadcast. */
    txHash: text("tx_hash"),
    /** Multisig payload (signed intents, etc). */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
  },
  (t) => ({
    kindIdx: index("treasury_movements_kind_idx").on(t.kind),
  }),
);

// ---------- Epoch snapshots ----------

export const epochSnapshots = pgTable(
  "epoch_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    epoch: integer("epoch").notNull(),
    network: network("network").notNull(),
    totalStakedQubic: bigint("total_staked_qubic", { mode: "bigint" }).notNull(),
    totalRewardsQubic: bigint("total_rewards_qubic", { mode: "bigint" }).notNull(),
    activeStakers: integer("active_stakers").notNull().default(0),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    epochIdx: uniqueIndex("epoch_snapshots_epoch_idx").on(t.epoch, t.network),
  }),
);

// ---------- Relations ----------

export const qubicWalletsRelations = relations(qubicWallets, ({ many, one }) => ({
  balance: one(qubicBalances, {
    fields: [qubicWallets.id],
    references: [qubicBalances.walletId],
  }),
  stakes: many(stakes),
}));

export const stakesRelations = relations(stakes, ({ one, many }) => ({
  wallet: one(qubicWallets, { fields: [stakes.walletId], references: [qubicWallets.id] }),
  rewards: many(rewards),
}));

export const rewardsRelations = relations(rewards, ({ one }) => ({
  stake: one(stakes, { fields: [rewards.stakeId], references: [stakes.id] }),
}));

// ---------- Type exports ----------

export type QubicWallet = typeof qubicWallets.$inferSelect;
export type NewQubicWallet = typeof qubicWallets.$inferInsert;
export type QubicBalance = typeof qubicBalances.$inferSelect;
export type Stake = typeof stakes.$inferSelect;
export type NewStake = typeof stakes.$inferInsert;
export type StakeStatus = (typeof stakeStatus.enumValues)[number];
export type Transaction = typeof transactions.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Validator = typeof validators.$inferSelect;
export type TreasuryMovement = typeof treasuryMovements.$inferSelect;
export type EpochSnapshot = typeof epochSnapshots.$inferSelect;

// ---------- Audit log ----------

// Inlined here so drizzle-kit's bundler resolves it without an extra file.
// Mirrors the shape of identity.audit_logs but uses a free-form text
// `action` column (no pgEnum) so this service stays decoupled from
// identity. Consumers can still `import { auditLogs } from "../db/schema.js"`.
import { pgTable as _pgTable, uuid as _uuid, text as _text, timestamp as _ts, jsonb as _jsonb, index as _index } from "drizzle-orm/pg-core";

export const auditLogs = _pgTable(
  "qubic_audit_logs",
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
    actorIdx: _index("qubic_audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: _index("qubic_audit_logs_action_idx").on(t.action),
    createdIdx: _index("qubic_audit_logs_created_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;

// ---------- Phase 23.3 (p3) — Qearn events mirror ----------
//
// The qearn-watcher worker (services/qubic/src/workers/qearn-watcher.ts)
// polls the Qearn contract address for transactions, classifies each one
// (lock / unlock / yield), and persists a row here. services/economy
// subscribes to the same events via NATS and uses them to drive
// compute-grant allocations. Idempotent on tx_hash (uniqueness).

export const qearnEventKind = pgEnum("qearn_event_kind", [
  "lock",    // user locked QUBIC into Qearn
  "unlock",  // user requested unlock of a Qearn lock
  "yield",   // reward distribution event
  "other",   // catch-all for unknown Qearn contract calls
]);

export const qubicQearnEvents = _pgTable(
  "qubic_qearn_events",
  {
    id: _uuid("id").defaultRandom().primaryKey(),
    /** Unique on-chain tx hash; the watcher dedupes on this. */
    txHash: _text("tx_hash").notNull(),
    /** Payer / sender (Qubic address, 60-char A-Z). */
    fromAddress: _text("from_address").notNull(),
    /** Receiver — should be the Qearn contract address. */
    toAddress: _text("to_address").notNull(),
    /** Principal amount in QUBIC. 0 for unlock intents / yield events. */
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull().default(0n),
    /** Tick the transaction was included. */
    tickNumber: integer("tick_number").notNull(),
    /** Event kind (lock / unlock / yield / other). */
    kind: qearnEventKind("kind").notNull(),
    /** Qearn lock id (set for lock + unlock events; null for yield/other). */
    lockId: _text("lock_id"),
    /** Last-seen tick at the time of the poll. Lets the watcher skip
     *  transactions it has already processed. */
    observedAtTick: integer("observed_at_tick").notNull(),
    createdAt: _ts("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Free-form metadata (raw tx shape, classification rationale, etc). */
    metadata: _jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => ({
    txHashIdx: uniqueIndex("qubic_qearn_events_tx_hash_idx").on(t.txHash),
    kindIdx: _index("qubic_qearn_events_kind_idx").on(t.kind),
    fromIdx: _index("qubic_qearn_events_from_idx").on(t.fromAddress),
    tickIdx: _index("qubic_qearn_events_tick_idx").on(t.tickNumber),
  }),
);

export type QearnEvent = typeof qubicQearnEvents.$inferSelect;
export type NewQearnEvent = typeof qubicQearnEvents.$inferInsert;
