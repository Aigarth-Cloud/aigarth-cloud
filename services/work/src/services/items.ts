/**
 * Work items — CRUD + lifecycle (Task 7).
 *
 * Mirrors services/tissue/src/services/tissues.ts but for the
 * Work Runtime envelope. Includes:
 *   - submitWorkItem  (POST /v1/work/items)
 *   - listWorkItems   (GET /v1/work/items)
 *   - getWorkItem     (GET /v1/work/items/:work_id)
 *   - cancelWorkItem  (POST /v1/work/items/:work_id/cancel)
 */

import { eq, and, desc, sql, count } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { workItems, workAudit, type WorkItem } from "../db/schema.js";
import { workId, uid } from "../lib/ids.js";
import { logActivity, auditAction } from "../lib/audit.js";
import {
  SubmitWorkItemSchema,
  type SubmitWorkItemInput,
  type ListWorkItemsQuery,
  type DisputeWorkItemInput,
} from "../types/work-item.js";

// ---------- Errors ----------

export class WorkItemNotFoundError extends Error {
  constructor(workIdValue: string) {
    super(`Work item '${workIdValue}' not found.`);
    this.name = "WorkItemNotFoundError";
  }
}

export class WorkItemNotCancellableError extends Error {
  constructor(workIdValue: string, status: string) {
    super(`Work item '${workIdValue}' is in status '${status}', not 'queued' or 'running'. Only queued/running items can be cancelled.`);
    this.name = "WorkItemNotCancellableError";
  }
}

export class WorkItemAlreadyVerifiedError extends Error {
  constructor(workIdValue: string) {
    super(`Work item '${workIdValue}' is already verified and cannot be disputed.`);
    this.name = "WorkItemAlreadyVerifiedError";
  }
}

// ---------- Submit ----------

export interface SubmitWorkItemOptions {
  createdBy: string; // userId or organismId
}

export async function submitWorkItem(
  input: SubmitWorkItemInput,
  opts: SubmitWorkItemOptions,
): Promise<WorkItem> {
  const db = getDb();
  const id = uid();
  const wid = workId();

  const [row] = await db
    .insert(workItems)
    .values({
      id,
      workId: wid,
      type: input.type,
      specVersion: input.spec_version,
      status: "queued",
      inputHash: input.input.payload_hash,
      inputUri: input.input.payload_uri,
      inputSizeBytes: BigInt(input.input.payload_size_bytes),
      algorithmName: input.algorithm.name,
      algorithmVersion: input.algorithm.version,
      algorithmContainer: input.algorithm.container,
      algorithmDeterministic: input.algorithm.deterministic,
      reqCpuCores: input.requirements.cpu_cores,
      reqMemoryGb: input.requirements.memory_gb,
      reqGpu: input.requirements.gpu,
      reqGpuKind: input.requirements.gpu_kind,
      reqEstimatedRuntimeS: input.requirements.estimated_runtime_s,
      verificationMethod: input.verification.method,
      replicas: input.verification.replicas ?? 3,
      challengeWorkId: input.verification.challenge_work_id ?? null,
      rewardCurrency: input.reward.currency,
      rewardAmount: input.reward.amount,
      rewardPayer: input.reward.payer,
      createdBy: opts.createdBy,
    })
    .returning();

  await logActivity(db, {
    workId: wid,
    actorUserId: opts.createdBy,
    action: auditAction.itemSubmitted,
    metadata: { type: input.type, algorithm: input.algorithm.name, replicas: input.verification.replicas ?? 3 },
  });

  return row!;
}

// ---------- List ----------

export interface ListResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export async function listWorkItems(
  filter: ListWorkItemsQuery,
): Promise<ListResult<WorkItem>> {
  const db = getDb();
  const conditions = [];
  if (filter.status) conditions.push(eq(workItems.status, filter.status));
  if (filter.type) conditions.push(eq(workItems.type, filter.type));
  if (filter.payer) conditions.push(eq(workItems.rewardPayer, filter.payer));
  if (filter.since) {
    conditions.push(sql`${workItems.createdAt} >= ${filter.since.toISOString()}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalRow] = await Promise.all([
    db
      .select()
      .from(workItems)
      .where(where)
      .orderBy(desc(workItems.createdAt))
      .limit(filter.limit)
      .offset(filter.offset),
    db.select({ value: count() }).from(workItems).where(where),
  ]);

  return {
    data,
    total: Number(totalRow[0]?.value ?? 0),
    limit: filter.limit,
    offset: filter.offset,
  };
}

// ---------- Get ----------

export async function getWorkItem(workIdValue: string): Promise<WorkItem | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(workItems)
    .where(eq(workItems.workId, workIdValue))
    .limit(1);
  return row ?? null;
}

/** Same as getWorkItem but throws on not-found. */
export async function getWorkItemOrThrow(workIdValue: string): Promise<WorkItem> {
  const w = await getWorkItem(workIdValue);
  if (!w) throw new WorkItemNotFoundError(workIdValue);
  return w;
}

// ---------- Cancel ----------

export async function cancelWorkItem(
  workIdValue: string,
  actorUserId: string,
): Promise<WorkItem> {
  const db = getDb();
  const w = await getWorkItemOrThrow(workIdValue);
  if (w.status !== "queued" && w.status !== "running") {
    throw new WorkItemNotCancellableError(workIdValue, w.status);
  }
  const [updated] = await db
    .update(workItems)
    .set({ status: "failed", updatedAt: new Date() })
    .where(eq(workItems.workId, workIdValue))
    .returning();
  await logActivity(db, {
    workId: workIdValue,
    actorUserId,
    action: auditAction.itemCancelled,
    metadata: { previousStatus: w.status },
  });
  return updated!;
}

// ---------- Dispute ----------

export async function disputeWorkItem(
  workIdValue: string,
  actorUserId: string,
  input: DisputeWorkItemInput,
): Promise<WorkItem> {
  const db = getDb();
  const w = await getWorkItemOrThrow(workIdValue);
  if (w.status === "verified") {
    throw new WorkItemAlreadyVerifiedError(workIdValue);
  }
  if (w.status === "disputed" || w.status === "failed") {
    return w; // idempotent
  }
  const [updated] = await db
    .update(workItems)
    .set({ status: "disputed", updatedAt: new Date() })
    .where(eq(workItems.workId, workIdValue))
    .returning();
  await logActivity(db, {
    workId: workIdValue,
    actorUserId,
    action: auditAction.itemDisputed,
    metadata: { reason: input.reason, previousStatus: w.status },
  });
  return updated!;
}

// ---------- Audit tail (for GET response) ----------

export interface AuditTailRow {
  action: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export async function getWorkItemAuditTail(
  workIdValue: string,
  limit = 10,
): Promise<AuditTailRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      action: workAudit.action,
      createdAt: workAudit.createdAt,
      metadata: workAudit.metadata,
    })
    .from(workAudit)
    .where(eq(workAudit.workId, workIdValue))
    .orderBy(desc(workAudit.createdAt))
    .limit(limit);
  return rows;
}
