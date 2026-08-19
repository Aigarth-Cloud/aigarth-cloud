/**
 * Work scheduler (Task 8).
 *
 * Per ADR 006 §5 and PEP v0.2 §14
 * (aigarth-cloud-evolution-pep-v0.2.md:451-473).
 *
 * v1 scoring function:
 *
 *   π(T, W) = capability_match(T, W)
 *           + FIFO_age_bonus(T)
 *           - per_worker_concurrency_load(W)
 *           - worker_reputation_floor(W)
 *           - locality_penalty(W)
 *
 * Five hard filters (a worker that fails any is ineligible):
 *   1. capability match (algorithm + gpu)
 *   2. resource fit (cpu + memory)
 *   3. status = "active"
 *   4. reputation >= REPUTATION_FLOOR
 *   5. concurrency cap not exceeded
 *
 * Lease semantics:
 *   - assignment inserts work_results with status="claimed",
 *     lease_expires_at = now + WORK_LEASE_DURATION_MS.
 *   - work_items.status flips to "running".
 *   - heartbeat extends lease in place.
 *   - expiry returns work item to queue and decays reputation.
 */

import { and, eq, sql, lt, count, asc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  workItems,
  workers,
  workResults,
  type WorkItem,
  type Worker,
} from "../db/schema.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";

export interface ScoredWorker {
  worker: Worker;
  score: number;
  claimed: number;
}

export interface SchedulerStats {
  scanned: number;
  assigned: number;
  expired: number;
  eligibleWorkers: number;
  queuedItems: number;
  runningItems: number;
}

/**
 * Compute the scheduler score for a (work item, worker) pair.
 * Pure function — no I/O — so it's trivial to unit test.
 */
export function scoreCandidate(
  item: Pick<WorkItem, "algorithmName" | "reqCpuCores" | "reqMemoryGb" | "reqGpu" | "createdAt">,
  worker: Pick<Worker, "workerId" | "status" | "reputation" | "algorithms" | "cpuCores" | "memoryGb" | "location" | "gpu">,
  claimed: number,
  cfg: { WORKER_DEFAULT_CONCURRENCY_CAP: number; REPUTATION_FLOOR: number },
): number {
  if (worker.status !== "active") return Number.NEGATIVE_INFINITY;
  const reputation = Number(worker.reputation);
  if (reputation < cfg.REPUTATION_FLOOR) return Number.NEGATIVE_INFINITY;
  if (claimed >= cfg.WORKER_DEFAULT_CONCURRENCY_CAP) return Number.NEGATIVE_INFINITY;
  if (!worker.algorithms.includes(item.algorithmName)) return Number.NEGATIVE_INFINITY;
  if (worker.cpuCores < item.reqCpuCores) return Number.NEGATIVE_INFINITY;
  if (worker.memoryGb < item.reqMemoryGb) return Number.NEGATIVE_INFINITY;
  if (item.reqGpu === "required" && (worker.gpu === "none" || !worker.gpu)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  // FIFO age bonus: up to +5 for items older than 5 minutes.
  const ageSec = Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / 1000);
  score += Math.min(5, ageSec / 60);

  // Reputation: up to +10 for reputation 1.0.
  score += reputation * 10;

  // Concurrency load penalty: up to -5.
  score -= claimed * 2.5;

  // Locality penalty: +0 for "local", -1 for anything else.
  if (worker.location !== "local") score -= 1;

  return score;
}

/** Pick the best eligible worker for a single work item. */
export async function pickWorkerFor(item: WorkItem): Promise<Worker | null> {
  const db = getDb();
  const cfg = loadConfig();
  const all = await db
    .select()
    .from(workers)
    .where(eq(workers.status, "active"));

  // For each candidate, count current claims.
  const counts = await db
    .select({ claimedBy: workResults.claimedBy, value: count() })
    .from(workResults)
    .where(
      and(
        eq(workResults.status, "claimed"),
        sql`${workResults.claimedBy} IS NOT NULL`,
      ),
    )
    .groupBy(workResults.claimedBy);

  const claimMap = new Map<string, number>();
  for (const c of counts) {
    if (c.claimedBy) claimMap.set(c.claimedBy, Number(c.value));
  }

  let best: ScoredWorker | null = null;
  for (const w of all) {
    const claimed = claimMap.get(w.workerId) ?? 0;
    const score = scoreCandidate(item, w, claimed, {
      WORKER_DEFAULT_CONCURRENCY_CAP: cfg.WORKER_DEFAULT_CONCURRENCY_CAP,
      REPUTATION_FLOOR: cfg.REPUTATION_FLOOR,
    });
    if (score === Number.NEGATIVE_INFINITY) continue;
    if (!best || score > best.score) {
      best = { worker: w, score, claimed };
    }
  }
  return best?.worker ?? null;
}

/** Assign a single work item to a worker, creating the work_results row. */
export async function assignItemToWorker(
  item: WorkItem,
  worker: Worker,
): Promise<void> {
  const db = getDb();
  const cfg = loadConfig();
  const leaseExpiresAt = new Date(Date.now() + cfg.WORK_LEASE_DURATION_MS);

  await db.insert(workResults).values({
    workId: item.workId,
    claimedBy: worker.workerId,
    status: "claimed",
    leaseExpiresAt,
  });

  await db
    .update(workItems)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(workItems.workId, item.workId));

  await logActivity(db, {
    workId: item.workId,
    workerId: worker.workerId,
    action: auditAction.itemClaimed,
    metadata: { leaseExpiresAt: leaseExpiresAt.toISOString() },
  });
}

/** One scheduler tick. Picks up to N queued items and assigns them. */
export async function schedulerTick(maxAssign = 10): Promise<SchedulerStats> {
  const db = getDb();
  const cfg = loadConfig();
  const now = new Date();

  // First, expire any stale claims.
  const expired = await db
    .update(workResults)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(workResults.status, "claimed"),
        sql`${workResults.leaseExpiresAt} IS NOT NULL`,
        lt(workResults.leaseExpiresAt, now),
      ),
    )
    .returning();

  // For each expired claim, re-queue the work item + decay reputation.
  for (const exp of expired) {
    if (!exp.claimedBy) continue;
    await db
      .update(workItems)
      .set({ status: "queued", updatedAt: now })
      .where(
        and(
          eq(workItems.workId, exp.workId),
          eq(workItems.status, "running"),
        ),
      );
    // Reputation decay: lose REPUTATION_DECAY_MALICIOUS.
    const [w] = await db
      .select()
      .from(workers)
      .where(eq(workers.workerId, exp.claimedBy))
      .limit(1);
    if (w) {
      const newRep = Math.max(
        0,
        Math.min(1, Number(w.reputation) - cfg.REPUTATION_DECAY_MALICIOUS),
      );
      const newStatus = newRep < cfg.REPUTATION_FLOOR ? "suspended" : w.status;
      await db
        .update(workers)
        .set({ reputation: String(newRep), status: newStatus, updatedAt: now })
        .where(eq(workers.workerId, exp.claimedBy));
    }
    await logActivity(db, {
      workId: exp.workId,
      workerId: exp.claimedBy,
      action: auditAction.itemLeaseExpired,
      metadata: { leaseExpiresAt: exp.leaseExpiresAt?.toISOString() ?? null },
    });
  }

  // Then, pick up queued items.
  const queued = await db
    .select()
    .from(workItems)
    .where(eq(workItems.status, "queued"))
    .orderBy(asc(workItems.createdAt))
    .limit(maxAssign);

  let assigned = 0;
  for (const item of queued) {
    const w = await pickWorkerFor(item);
    if (!w) continue;
    await assignItemToWorker(item, w);
    assigned += 1;
  }

  const [runningRow] = await db
    .select({ value: count() })
    .from(workItems)
    .where(eq(workItems.status, "running"));
  const [queuedRow] = await db
    .select({ value: count() })
    .from(workItems)
    .where(eq(workItems.status, "queued"));
  const [eligibleRow] = await db
    .select({ value: count() })
    .from(workers)
    .where(eq(workers.status, "active"));

  return {
    scanned: queued.length,
    assigned,
    expired: expired.length,
    eligibleWorkers: Number(eligibleRow?.value ?? 0),
    queuedItems: Number(queuedRow?.value ?? 0),
    runningItems: Number(runningRow?.value ?? 0),
  };
}

/** Manual assignment for testing (Task 8 — `POST /v1/internal/work/items/:work_id/assign`). */
export async function manualAssign(
  workIdValue: string,
  workerIdValue: string,
): Promise<{ item: WorkItem; worker: Worker } | null> {
  const db = getDb();
  const [item] = await db
    .select()
    .from(workItems)
    .where(eq(workItems.workId, workIdValue))
    .limit(1);
  if (!item) return null;
  if (item.status !== "queued") return null;
  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.workerId, workerIdValue))
    .limit(1);
  if (!worker) return null;
  await assignItemToWorker(item, worker);
  return { item, worker };
}
