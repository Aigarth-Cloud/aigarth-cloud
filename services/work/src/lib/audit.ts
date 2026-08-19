/**
 * Append-only audit log helper for the work service.
 *
 * Mirrors the pattern at services/tissue/src/lib/audit.ts.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { workAudit, type WorkAudit } from "../db/schema.js";
import type * as schemaType from "../db/schema.js";

type Db = NodePgDatabase<typeof schemaType>;

export const auditAction = {
  itemSubmitted: "work.item.submitted",
  itemAssigned: "work.item.assigned",
  itemClaimed: "work.item.claimed",
  itemResultSubmitted: "work.item.result_submitted",
  itemVerified: "work.item.verified",
  itemFailed: "work.item.failed",
  itemDisputed: "work.item.disputed",
  itemCancelled: "work.item.cancelled",
  itemLeaseExpired: "work.item.lease_expired",
  workerRegistered: "work.worker.registered",
  workerHeartbeat: "work.worker.heartbeat",
  workerSuspended: "work.worker.suspended",
  workerResumed: "work.worker.resumed",
  workerOffline: "work.worker.offline",
  challengeIssued: "work.challenge.issued",
  challengePassed: "work.challenge.passed",
  challengeFailed: "work.challenge.failed",
  algorithmRegistered: "work.algorithm.registered",
  billingEventEmitted: "work.billing.emitted",
} as const;

export interface AuditEvent {
  workId?: string | null;
  workerId?: string | null;
  actorUserId?: string | null;
  action:
    | keyof typeof auditAction
    | (typeof auditAction)[keyof typeof auditAction]
    | string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(db: Db, event: AuditEvent): Promise<WorkAudit> {
  const [row] = await db
    .insert(workAudit)
    .values({
      id: uid(),
      workId: event.workId ?? null,
      workerId: event.workerId ?? null,
      actorUserId: event.actorUserId ?? null,
      action: event.action,
      metadata: event.metadata ?? {},
    })
    .returning();
  return row!;
}

import { uid } from "./ids.js";
