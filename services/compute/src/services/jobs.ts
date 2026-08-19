/**
 * Job service.
 *
 * A job is a user-submitted compute task. Lifecycle:
 *   queued -> submitted -> running -> completed | failed | cancelled
 *
 * Cost model (illustrative):
 *   fee = JOB_BASE_FEE_QUBIC + (duration_ms * JOB_COST_PER_MS_QUBIC)
 *
 * The user must have a `compute_credit` (derived from active reservations)
 * covering the estimated cost. We hold a small reservation of credits
 * at submit time and settle the final amount on completion.
 *
 * In Phase 2, broadcasting is a no-op against services/qubic — we
 * update the status to "submitted" with a synthetic tx hash. Phase 3
 * (already shipped) and Phase 7 (next) will wire real broadcasts.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  jobs,
  clusters,
  regions,
  reservations,
  type Job,
  type JobStatus,
  type JobType,
} from "../db/schema.js";
export type { JobStatus, JobType };
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";

// ---------- Schemas ----------

export const SubmitJobSchema = z.object({
  type: z.enum(["contract_call", "training", "inference", "general"]).default("general"),
  clusterId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  contractIndex: z.number().int().min(0).max(255).optional(),
  functionIndex: z.number().int().min(0).max(255).optional(),
  payload: z.record(z.unknown()).default({}),
  priority: z.number().int().min(0).max(10).default(5),
  /** Optional reservation id to charge against. */
  reservationId: z.string().uuid().optional(),
  /** Estimated duration; used for credit pre-authorization. */
  estimatedDurationMs: z.number().int().min(1).max(600_000).default(1000),
});

export type SubmitJobInput = z.infer<typeof SubmitJobSchema>;

// ---------- Cost calculation ----------

export function estimateJobCost(estimatedDurationMs: number): bigint {
  const cfg = loadConfig();
  return cfg.JOB_BASE_FEE_QUBIC + BigInt(estimatedDurationMs) * cfg.JOB_COST_PER_MS_QUBIC;
}

// ---------- Capacity credit (derived) ----------

export interface CapacityCredit {
  userId: string;
  totalCreditQubic: bigint;
  usedQubic: bigint;
  remainingQubic: bigint;
  activeReservationCount: number;
}

export async function getUserCapacity(userId: string): Promise<CapacityCredit> {
  const db = getDb();
  const rows = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.userId, userId), eq(reservations.status, "active")));
  let total = 0n;
  let used = 0n;
  for (const r of rows) {
    total += r.creditQubic;
    used += r.usedQubic;
  }
  return {
    userId,
    totalCreditQubic: total,
    usedQubic: used,
    remainingQubic: total - used,
    activeReservationCount: rows.length,
  };
}

// ---------- Submit job ----------

export interface SubmitResult {
  job: Job;
  estimatedCostQubic: bigint;
  remainingCreditQubic: bigint;
}

export async function submitJob(userId: string, input: SubmitJobInput): Promise<SubmitResult> {
  const db = getDb();
  const cfg = loadConfig();

  // Validate cluster if provided
  if (input.clusterId) {
    const cluster = await db.select().from(clusters).where(eq(clusters.id, input.clusterId)).limit(1);
    if (!cluster[0]) throw new Error("Cluster not found.");
    if (!cluster[0].isActive) throw new Error("Cluster is not active.");
  }
  if (input.regionId) {
    const region = await db.select().from(regions).where(eq(regions.id, input.regionId)).limit(1);
    if (!region[0]) throw new Error("Region not found.");
    if (!region[0].isActive) throw new Error("Region is not active.");
  }

  // Validate reservation if provided
  if (input.reservationId) {
    const resv = await db
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, input.reservationId), eq(reservations.userId, userId)))
      .limit(1);
    if (!resv[0]) throw new Error("Reservation not found or not owned by user.");
    if (resv[0].status !== "active") throw new Error("Reservation is not active.");
  }

  // Check user's job count
  const activeCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        sql`${jobs.status} in ('queued', 'submitted', 'running')`,
      ),
    );
  if ((activeCount[0]?.n ?? 0) >= cfg.MAX_JOBS_PER_USER) {
    throw new Error(
      `Maximum ${cfg.MAX_JOBS_PER_USER} active jobs per user. Cancel or complete existing jobs first.`,
    );
  }

  // Check capacity credit
  const cost = estimateJobCost(input.estimatedDurationMs);
  if (input.reservationId) {
    const credit = await getUserCapacity(userId);
    if (credit.remainingQubic < cost) {
      throw new Error(
        `Insufficient credit. Need ${cost}, have ${credit.remainingQubic}. Top up your reservations.`,
      );
    }
  }

  // Create the job
  const id = uid();
  const now = new Date();
  const deadline = new Date(now.getTime() + cfg.DEFAULT_JOB_TIMEOUT_MS);

  const inserted = await db
    .insert(jobs)
    .values({
      id,
      userId,
      clusterId: input.clusterId ?? null,
      regionId: input.regionId ?? null,
      type: input.type as JobType,
      contractIndex: input.contractIndex ?? null,
      functionIndex: input.functionIndex ?? null,
      payload: input.payload,
      priority: input.priority,
      status: "queued",
      creditUsedQubic: cost,
      reservationId: input.reservationId ?? null,
      deadlineAt: deadline,
    })
    .returning();

  // Increment the reservation's used amount
  if (input.reservationId) {
    await db
      .update(reservations)
      .set({
        usedQubic: sql`${reservations.usedQubic} + ${cost.toString()}::bigint`,
        updatedAt: now,
      })
      .where(eq(reservations.id, input.reservationId));
  }

  logActivity(db, {
    action: "job.submitted",
    actorUserId: userId,
    targetType: "job",
    targetId: id,
    metadata: {
      type: input.type,
      priority: input.priority,
      costQubic: cost.toString(),
    },
  });

  // For Phase 2, we don't actually broadcast to Qubic yet — the worker
  // (or a real impl) will. The "queued" -> "submitted" transition is
  // driven by either a Qubic RPC success or a manual test shortcut.
  // We leave the job in "queued" and return; the test or worker will
  // transition it.

  const job = inserted[0]!;
  const credit = await getUserCapacity(userId);
  return {
    job,
    estimatedCostQubic: cost,
    remainingCreditQubic: credit.remainingQubic,
  };
}

// ---------- Broadcast (Phase 2 stub) ----------

/**
 * For Phase 2 we simulate a broadcast: flip queued -> submitted with a
 * synthetic tx hash. Phase 7 / real impl will call services/qubic.
 */
export async function broadcastJob(userId: string, jobId: string): Promise<Job> {
  const db = getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  const job = rows[0];
  if (!job) throw new Error("Job not found.");
  if (job.status !== "queued") {
    throw new Error(`Cannot broadcast a job in status '${job.status}'.`);
  }
  // Synthetic tx hash (real impl: services/qubic.broadcastStake or a new broadcastJob RPC)
  const { createHash } = await import("node:crypto");
  const txHash = createHash("sha256")
    .update(`${jobId}:${userId}:${Date.now()}`)
    .digest("hex")
    .slice(0, 60)
    .toUpperCase()
    .padEnd(60, "A");
  const tick = Math.floor(Date.now() / 1000);
  const updated = await db
    .update(jobs)
    .set({
      status: "submitted",
      txHash,
      submittedTick: tick,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
    .returning();
  logActivity(db, {
    action: "job.broadcast",
    actorUserId: userId,
    targetType: "job",
    targetId: jobId,
    metadata: { txHash, tick },
  });
  return updated[0]!;
}

// ---------- Read ----------

export async function listJobs(
  userId: string,
  options: { status?: JobStatus; limit?: number } = {},
): Promise<Job[]> {
  const db = getDb();
  const conditions = [eq(jobs.userId, userId)];
  if (options.status) conditions.push(eq(jobs.status, options.status));
  return db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
}

export async function getJob(userId: string, jobId: string): Promise<Job | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// ---------- Cancel ----------

export async function cancelJob(userId: string, jobId: string): Promise<Job> {
  const db = getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  const job = rows[0];
  if (!job) throw new Error("Job not found.");
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    throw new Error(`Cannot cancel a job in status '${job.status}'.`);
  }
  const updated = await db
    .update(jobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(jobs.id, jobId))
    .returning();
  // Refund the credit hold (best-effort: keep usedQubic as-is for completed jobs)
  if (job.reservationId && job.creditUsedQubic && job.status === "queued") {
    await db
      .update(reservations)
      .set({
        usedQubic: sql`GREATEST(${reservations.usedQubic} - ${job.creditUsedQubic.toString()}::bigint, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, job.reservationId));
  }
  logActivity(db, {
    action: "job.cancelled",
    actorUserId: userId,
    targetType: "job",
    targetId: jobId,
  });
  return updated[0]!;
}

// ---------- Worker helpers ----------

export async function transitionJob(
  jobId: string,
  toStatus: JobStatus,
  extra: Partial<Pick<Job, "startedTick" | "completedTick" | "result" | "errorMessage">> = {},
): Promise<Job | null> {
  const db = getDb();
  const set: Partial<Job> = { status: toStatus, updatedAt: new Date() };
  if (toStatus === "running") {
    set.startedAt = new Date();
    if (extra.startedTick != null) set.startedTick = extra.startedTick;
  }
  if (toStatus === "completed" || toStatus === "failed") {
    set.completedAt = new Date();
    if (extra.completedTick != null) set.completedTick = extra.completedTick;
    if (extra.result) set.result = extra.result;
    if (extra.errorMessage) set.errorMessage = extra.errorMessage;
  }
  const rows = await db.update(jobs).set(set).where(eq(jobs.id, jobId)).returning();
  return rows[0] ?? null;
}

export async function getJobById(jobId: string): Promise<Job | null> {
  const db = getDb();
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}

export async function listInFlightJobs(limit = 50): Promise<Job[]> {
  const db = getDb();
  return db
    .select()
    .from(jobs)
    .where(sql`${jobs.status} in ('submitted', 'running')`)
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}

// ---------- Stats ----------

export interface UserStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  totalSpentQubic: bigint;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const db = getDb();
  const rows = await db
    .select({ status: jobs.status, cost: jobs.creditUsedQubic })
    .from(jobs)
    .where(eq(jobs.userId, userId));
  const stats: UserStats = {
    totalJobs: rows.length,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    cancelledJobs: 0,
    totalSpentQubic: 0n,
  };
  for (const r of rows) {
    if (r.status === "queued" || r.status === "submitted" || r.status === "running") {
      stats.activeJobs++;
    } else if (r.status === "completed") stats.completedJobs++;
    else if (r.status === "failed") stats.failedJobs++;
    else if (r.status === "cancelled") stats.cancelledJobs++;
    if (r.cost) stats.totalSpentQubic += r.cost;
  }
  return stats;
}
