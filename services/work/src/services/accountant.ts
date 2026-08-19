/**
 * Work accountant (Task 9).
 *
 * Per ADR 006 §7. The accountant is the *single* bridge from
 * services/work to services/billing. It emits a WorkUsageEvent
 * exactly once per work item on `status = "verified"`. Disputed
 * and failed items do NOT bill.
 *
 * Invariants:
 *   1. WorkUsageEvent emitted exactly once per work item.
 *   2. costQubic computed at submit time, not verify time.
 *   3. The accountant is the only path from services/work to
 *      services/billing.
 *
 * The actual HTTP call is in services/work/src/services/billingHook.ts.
 * This module is the policy + idempotency layer.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { workItems, workAudit, type WorkItem } from "../db/schema.js";
import { logActivity, auditAction } from "../lib/audit.js";
import {
  WorkUsageEventSchema,
  estimateWorkCost,
  type WorkUsageEvent,
} from "../types/billing.js";
import { loadConfig } from "../config/index.js";
import { reportWorkUsage } from "./billingHook.js";

export class WorkItemNotVerifiedError extends Error {
  constructor(workIdValue: string, status: string) {
    super(`Work item '${workIdValue}' is in status '${status}', not 'verified'. Only verified items can be billed.`);
    this.name = "WorkItemNotVerifiedError";
  }
}

export class WorkItemAlreadyBilledError extends Error {
  constructor(workIdValue: string) {
    super(`Work item '${workIdValue}' has already been billed (audit log shows a billing event).`);
    this.name = "WorkItemAlreadyBilledError";
  }
}

/**
 * Emit a WorkUsageEvent for a verified work item.
 * Returns true on success, false on failure (logged but not thrown).
 *
 * Idempotency: checks work_audit for a prior `work.billing.emitted`
 * row for this workId; if found, returns false without billing.
 */
export async function billVerifiedWorkItem(workIdValue: string): Promise<boolean> {
  const db = getDb();
  const cfg = loadConfig();

  const [item] = await db
    .select()
    .from(workItems)
    .where(eq(workItems.workId, workIdValue))
    .limit(1);
  if (!item) return false;
  if (item.status !== "verified") {
    throw new WorkItemNotVerifiedError(workIdValue, item.status);
  }

  // ADR 006 §7 invariant 1: emit exactly once. Check the audit log.
  const priorBillings = await db
    .select()
    .from(workAudit)
    .where(eq(workAudit.workId, workIdValue));
  const alreadyBilled = priorBillings.some((a) => a.action === auditAction.billingEventEmitted);
  if (alreadyBilled) {
    return false;
  }

  // Compute cost. v1 formula: base + replicas * replica.
  const costQubic = estimateWorkCost(item.replicas);

  const event: WorkUsageEvent = WorkUsageEventSchema.parse({
    userId: item.rewardPayer,
    workId: item.workId,
    workType: mapWorkType(item.type),
    algorithmVersion: item.algorithmVersion,
    costQubic: costQubic.toString(),
    replicas: item.replicas,
    verificationMethod: mapVerificationMethod(item.verificationMethod),
    replicasAgreed: item.resultReplicasAgreed ?? `${item.replicas}/${item.replicas}`,
    workerId: item.resultCompletedBy ?? "unknown",
    requestId: `work-billing-${item.workId}`,
    occurredAt: new Date(),
  });

  const ok = await reportWorkUsage(event, cfg.BILLING_SERVICE_URL, cfg.INTERNAL_TOKEN);
  if (ok) {
    await logActivity(db, {
      workId: workIdValue,
      action: auditAction.billingEventEmitted,
      metadata: { costQubic: costQubic.toString(), replicas: item.replicas },
    });
  }
  return ok;
}

/**
 * Map work item `type` (freeform text) to a WorkUsageEvent.workType enum.
 * Falls back to a permissive mapping; the union has 5 values, so any
 * unmapped type falls through to "trinary_decision" as a safe default
 * (the most common Phase 27 type).
 */
function mapWorkType(
  type: string,
): "materials_simulation" | "video_evaluation" | "trinary_decision" | "dft_relaxation" | "awork_1" {
  switch (type) {
    case "materials_simulation":
    case "video_evaluation":
    case "trinary_decision":
    case "dft_relaxation":
    case "awork_1":
      return type;
    default:
      return "trinary_decision";
  }
}

/**
 * Map work item `verificationMethod` to a WorkUsageEvent enum.
 * The event schema only allows 3 v1 values; tee/zk are deferred
 * (ADR 006 §6).
 */
function mapVerificationMethod(
  method: string,
): "replication" | "challenge" | "deterministic" {
  switch (method) {
    case "replication":
    case "challenge":
    case "deterministic":
      return method;
    default:
      return "replication";
  }
}
