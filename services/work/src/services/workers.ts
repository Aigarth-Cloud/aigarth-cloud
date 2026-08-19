/**
 * Workers — registry + heartbeat + lifecycle (Task 7).
 *
 * Per ADR 006 §4 and PEP v0.2 §12
 * (aigarth-cloud-evolution-pep-v0.2.md:395-425).
 *
 * v1: only `kind = "local"` is accepted; the other four
 * (`remote | oc-processor | neuraxon | human-via-oracle`) are
 * rejected at registration with a 400 "tier not yet available".
 */

import { eq, and, desc, lt, sql, count } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  workers,
  workItems,
  workResults,
  type Worker,
  type WorkItem,
} from "../db/schema.js";
import { workerId as newWorkerId, uid } from "../lib/ids.js";
import { logActivity, auditAction } from "../lib/audit.js";
import {
  RegisterWorkerSchema,
  type RegisterWorkerInput,
  type ListWorkersQuery,
} from "../types/worker.js";
import { loadConfig } from "../config/index.js";

// ---------- Errors ----------

export class WorkerNotFoundError extends Error {
  constructor(workerIdValue: string) {
    super(`Worker '${workerIdValue}' not found.`);
    this.name = "WorkerNotFoundError";
  }
}

export class WorkerSuspendedError extends Error {
  constructor(workerIdValue: string) {
    super(`Worker '${workerIdValue}' is suspended and cannot heartbeat.`);
    this.name = "WorkerSuspendedError";
  }
}

// ---------- Register ----------

export interface RegisterWorkerOptions {
  /** Container signature, supplied by the worker (HMAC-SHA-256 keyed on WORK_SIGNING_KEY). */
  containerSignature?: string;
}

export async function registerWorker(
  input: RegisterWorkerInput,
  opts: RegisterWorkerOptions = {},
): Promise<Worker> {
  // Re-parse to apply the route-level rejection (only `local` allowed).
  // This double-parses, but the Zod refine above already runs on the
  // body in routes/workers.ts, so by the time we get here the kind is
  // already "local". Defensive parse to surface a clear error if a
  // direct service call bypasses the route layer.
  const parsed = RegisterWorkerSchema.parse(input);

  const db = getDb();
  const wid = newWorkerId();
  const id = uid();

  // ADR 006 §4 invariant 3: server-computes reputation, not client.
  // The client may pass `reputation` for informational purposes (e.g.
  // a federated worker carrying reputation from another deployment)
  // but the server overwrites it for new workers.
  const initialReputation = "0.5";

  const [row] = await db
    .insert(workers)
    .values({
      id,
      workerId: wid,
      kind: parsed.kind,
      status: "active",
      cpuCores: parsed.capabilities.cpu_cores,
      memoryGb: parsed.capabilities.memory_gb,
      gpu: parsed.capabilities.gpu,
      gpuKind: "any", // v1: gpu_kind is on capabilities but the column is denormalized as "any" for local; not used in scheduling yet
      algorithms: parsed.capabilities.algorithms,
      runtime: parsed.capabilities.runtime,
      location: parsed.capabilities.location,
      reputation: initialReputation,
      disputes: 0,
    })
    .returning();

  await logActivity(db, {
    workerId: wid,
    action: auditAction.workerRegistered,
    metadata: {
      kind: parsed.kind,
      cpuCores: parsed.capabilities.cpu_cores,
      memoryGb: parsed.capabilities.memory_gb,
      algorithms: parsed.capabilities.algorithms,
      containerSignature: opts.containerSignature ?? null,
      // Log the client's claimed reputation for audit; the
      // server-applied value is in `reputation`.
      claimedReputation: parsed.capabilities.reputation,
    },
  });

  return row!;
}

// ---------- Heartbeat ----------

export async function heartbeat(workerIdValue: string): Promise<Worker> {
  const db = getDb();
  const [w] = await db
    .select()
    .from(workers)
    .where(eq(workers.workerId, workerIdValue))
    .limit(1);
  if (!w) throw new WorkerNotFoundError(workerIdValue);
  if (w.status === "suspended") {
    throw new WorkerSuspendedError(workerIdValue);
  }
  const cfg = loadConfig();
  const now = new Date();
  const [updated] = await db
    .update(workers)
    .set({
      status: "active",
      lastHeartbeatAt: now,
      updatedAt: now,
    })
    .where(eq(workers.workerId, workerIdValue))
    .returning();

  await logActivity(db, {
    workerId: workerIdValue,
    action: auditAction.workerHeartbeat,
    metadata: { lastHeartbeatAt: now.toISOString() },
  });

  // ADR 006 §5: heartbeat extends the lease on all claimed items.
  // We extend in-place: lease_expires_at = now + WORK_LEASE_DURATION_MS.
  // (Drizzle's `set` with `sql` for the new value.)
  await db
    .update(workResults)
    .set({
      leaseExpiresAt: new Date(now.getTime() + cfg.WORK_LEASE_DURATION_MS),
    })
    .where(
      and(
        eq(workResults.claimedBy, workerIdValue),
        eq(workResults.status, "claimed"),
      ),
    );

  return updated!;
}

// ---------- List ----------

export interface ListWorkersResult {
  data: Worker[];
  total: number;
  limit: number;
  offset: number;
}

export async function listWorkers(
  filter: ListWorkersQuery,
): Promise<ListWorkersResult> {
  const db = getDb();
  const conditions = [];
  if (filter.status) conditions.push(eq(workers.status, filter.status));
  if (filter.kind) conditions.push(eq(workers.kind, filter.kind));
  if (filter.location) conditions.push(eq(workers.location, filter.location));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalRow] = await Promise.all([
    db
      .select()
      .from(workers)
      .where(where)
      .orderBy(desc(workers.createdAt))
      .limit(filter.limit)
      .offset(filter.offset),
    db.select({ value: count() }).from(workers).where(where),
  ]);
  return {
    data,
    total: Number(totalRow[0]?.value ?? 0),
    limit: filter.limit,
    offset: filter.offset,
  };
}

// ---------- Get ----------

export async function getWorker(workerIdValue: string): Promise<Worker | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(workers)
    .where(eq(workers.workerId, workerIdValue))
    .limit(1);
  return row ?? null;
}

export async function getWorkerOrThrow(workerIdValue: string): Promise<Worker> {
  const w = await getWorker(workerIdValue);
  if (!w) throw new WorkerNotFoundError(workerIdValue);
  return w;
}

// ---------- Mark offline (background scan) ----------

export async function markStaleWorkersOffline(): Promise<number> {
  const cfg = loadConfig();
  const db = getDb();
  const threshold = new Date(Date.now() - cfg.WORK_OFFLINE_AFTER_MS);
  const updated = await db
    .update(workers)
    .set({ status: "offline", updatedAt: new Date() })
    .where(
      and(
        eq(workers.status, "active"),
        lt(workers.lastHeartbeatAt, threshold),
      ),
    )
    .returning();
  for (const w of updated) {
    await logActivity(db, {
      workerId: w.workerId,
      action: auditAction.workerOffline,
      metadata: { lastHeartbeatAt: w.lastHeartbeatAt?.toISOString() ?? null },
    });
  }
  return updated.length;
}

// ---------- List worker jobs (claimed work items) ----------

export async function listWorkerJobs(workerIdValue: string): Promise<WorkItem[]> {
  const db = getDb();
  // The claimed work items are those with status=running and a
  // matching work_results row.
  const rows = await db
    .select({ workItem: workItems })
    .from(workResults)
    .innerJoin(workItems, eq(workItems.workId, workResults.workId))
    .where(
      and(
        eq(workResults.claimedBy, workerIdValue),
        eq(workResults.status, "claimed"),
        eq(workItems.status, "running"),
      ),
    );
  return rows.map((r) => r.workItem);
}
