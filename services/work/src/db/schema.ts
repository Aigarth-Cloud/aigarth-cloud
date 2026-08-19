/**
 * Work service — Drizzle schema (Phase 27 / ADR 006).
 *
 *   work_status          — enum: queued / running / verified / failed / disputed
 *   worker_kind          — enum: local / remote / oc-processor / neuraxon / human-via-oracle
 *   worker_status        — enum: active / suspended / offline
 *   verification_method  — enum: replication / challenge / deterministic / tee / zk
 *   work_algorithms      — registered algorithm registry (Task 10 / awork_1)
 *   work_items           — the canonical work item record (Task 7)
 *   workers              — the worker registry (Task 7)
 *   work_results         — per-replica submission rows (Task 7)
 *   worker_challenges    — per-challenge audit + outcome (Task 9)
 *   work_audit           — append-only state-transition log (Task 7)
 *
 * See ADR 006 — Work Runtime — for the full contract.
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

// ---------- Enums ----------

export const workStatus = pgEnum("work_status", [
  "queued",
  "running",
  "verified",
  "failed",
  "disputed",
]);

export const workerKind = pgEnum("worker_kind", [
  "local",
  "remote",
  "oc-processor",
  "neuraxon",
  "human-via-oracle",
]);

export const workerStatus = pgEnum("worker_status", [
  "active",
  "suspended",
  "offline",
]);

export const verificationMethod = pgEnum("verification_method", [
  "replication",
  "challenge",
  "deterministic",
  "tee",
  "zk",
]);

// ---------- work_algorithms (Task 10 — registry) ----------

export const workAlgorithms = pgTable(
  "work_algorithms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    container: text("container").notNull(),
    deterministic: boolean("deterministic").notNull().default(false),
    /**
     * HMAC-SHA-256 signature of `name|version|container` keyed on
     * `WORK_SIGNING_KEY`. Verified at job-assignment time and at
     * result-submission time (ADR 006 §12 OQ 4).
     */
    signature: text("signature").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameVersionIdx: uniqueIndex("work_algorithms_name_version_idx").on(t.name, t.version),
    nameIdx: index("work_algorithms_name_idx").on(t.name),
  }),
);

// ---------- work_items (Task 7) ----------

export const workItems = pgTable(
  "work_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Service-issued ULID; never user-supplied. Format: wki_<ulid>. */
    workId: text("work_id").notNull(),
    type: text("type").notNull(),
    specVersion: integer("spec_version").notNull().default(1),
    status: workStatus("status").notNull().default("queued"),

    // ---------- Envelope payload (denormalized) ----------
    inputHash: text("input_hash").notNull(),
    inputUri: text("input_uri").notNull(),
    inputSizeBytes: bigint("input_size_bytes", { mode: "bigint" }).notNull(),

    algorithmName: text("algorithm_name").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    algorithmContainer: text("algorithm_container").notNull(),
    algorithmDeterministic: boolean("algorithm_deterministic").notNull().default(false),
    algorithmContainerHash: text("algorithm_container_hash"),

    // Requirements
    reqCpuCores: integer("req_cpu_cores").notNull().default(1),
    reqMemoryGb: integer("req_memory_gb").notNull().default(1),
    reqGpu: text("req_gpu").notNull().default("none"),
    reqGpuKind: text("req_gpu_kind").notNull().default("any"),
    reqEstimatedRuntimeS: integer("req_estimated_runtime_s").notNull().default(60),

    // Verification
    verificationMethod: verificationMethod("verification_method").notNull(),
    replicas: integer("replicas").notNull().default(3),
    challengeWorkId: text("challenge_work_id"),

    // Reward
    rewardCurrency: text("reward_currency").notNull().default("QUBIC"),
    rewardAmount: bigint("reward_amount", { mode: "bigint" }).notNull().default(BigInt(0)),
    rewardPayer: text("reward_payer").notNull(),

    // Result (populated on verified)
    resultPayloadHash: text("result_payload_hash"),
    resultCompletedBy: text("result_completed_by"),
    resultCompletedAt: timestamp("result_completed_at", { withTimezone: true }),
    resultReplicasAgreed: text("result_replicas_agreed"),

    // Audit
    createdBy: text("created_by").notNull(),
    settlementTx: text("settlement_tx"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workIdIdx: uniqueIndex("work_items_work_id_idx").on(t.workId),
    statusIdx: index("work_items_status_idx").on(t.status),
    typeIdx: index("work_items_type_idx").on(t.type),
    payerIdx: index("work_items_payer_idx").on(t.rewardPayer),
    algorithmIdx: index("work_items_algorithm_idx").on(t.algorithmName, t.algorithmVersion),
    createdAtIdx: index("work_items_created_at_idx").on(t.createdAt),
  }),
);

// ---------- workers (Task 7) ----------

export const workers = pgTable(
  "workers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Service-issued ULID; format: wrk_<ulid>. */
    workerId: text("worker_id").notNull(),
    kind: workerKind("kind").notNull(),
    status: workerStatus("status").notNull().default("active"),

    // Capabilities (denormalized JSONB for forward-compat)
    cpuCores: integer("cpu_cores").notNull().default(1),
    memoryGb: integer("memory_gb").notNull().default(1),
    gpu: text("gpu").notNull().default("none"),
    gpuKind: text("gpu_kind").notNull().default("any"),
    algorithms: jsonb("algorithms").$type<string[]>().notNull().default([]),
    runtime: text("runtime").notNull().default("docker"),
    location: text("location").notNull().default("local"),
    reputation: numeric("reputation", { precision: 4, scale: 3 }).notNull().default("0.5"),
    disputes: integer("disputes").notNull().default(0),

    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdIdx: uniqueIndex("workers_worker_id_idx").on(t.workerId),
    statusIdx: index("workers_status_idx").on(t.status),
    kindIdx: index("workers_kind_idx").on(t.kind),
  }),
);

// ---------- work_results (Task 7 — per-replica submission) ----------

export const workResults = pgTable(
  "work_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workId: text("work_id").notNull(),
    claimedBy: text("claimed_by"),
    /** One of: claimed / submitted / expired / failed. */
    status: text("status").notNull().default("claimed"),
    payloadHash: text("payload_hash"),
    signature: text("signature"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workClaimIdx: index("work_results_work_claim_idx").on(t.workId, t.claimedBy),
    statusIdx: index("work_results_status_idx").on(t.status),
    leaseIdx: index("work_results_lease_idx").on(t.leaseExpiresAt),
  }),
);

// ---------- worker_challenges (Task 9 — challenger audit) ----------

export const workerChallenges = pgTable(
  "worker_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workerId: text("worker_id").notNull(),
    workId: text("work_id").notNull(),
    /** known-answer payload hash. */
    knownAnswerHash: text("known_answer_hash").notNull(),
    passed: boolean("passed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index("worker_challenges_worker_idx").on(t.workerId),
    workIdx: index("worker_challenges_work_idx").on(t.workId),
    passedIdx: index("worker_challenges_passed_idx").on(t.passed),
  }),
);

// ---------- work_audit (Task 7 — append-only state log) ----------

export const workAudit = pgTable(
  "work_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workId: text("work_id"),
    workerId: text("worker_id"),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workIdx: index("work_audit_work_idx").on(t.workId),
    workerIdx: index("work_audit_worker_idx").on(t.workerId),
    actionIdx: index("work_audit_action_idx").on(t.action),
    createdIdx: index("work_audit_created_idx").on(t.createdAt),
  }),
);

// ---------- Type exports ----------

export type WorkItem = typeof workItems.$inferSelect;
export type NewWorkItem = typeof workItems.$inferInsert;
export type Worker = typeof workers.$inferSelect;
export type NewWorker = typeof workers.$inferInsert;
export type WorkResult = typeof workResults.$inferSelect;
export type NewWorkResult = typeof workResults.$inferInsert;
export type WorkerChallenge = typeof workerChallenges.$inferSelect;
export type WorkAudit = typeof workAudit.$inferSelect;
export type WorkAlgorithm = typeof workAlgorithms.$inferSelect;
export type NewWorkAlgorithm = typeof workAlgorithms.$inferInsert;

export type WorkStatus = (typeof workStatus.enumValues)[number];
export type WorkerKind = (typeof workerKind.enumValues)[number];
export type WorkerStatus = (typeof workerStatus.enumValues)[number];
export type VerificationMethod = (typeof verificationMethod.enumValues)[number];
