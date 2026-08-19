/**
 * Service-local audit logging.
 *
 * Mirrors services/dataset. The `training_audit_logs` table is
 * intentionally separate from any platform-wide audit log; this
 * one is for training-domain events only.
 */

import { getDb } from "../db/index.js";
import { trainingAuditLogs } from "../db/schema.js";
import { uid } from "./ids.js";

export const auditAction = {
  trainingJobSubmitted: "training.job_submitted",
  trainingJobCancelled: "training.job_cancelled",
  trainingJobSucceeded: "training.job_succeeded",
  trainingJobFailed: "training.job_failed",
  trainingJobProgressed: "training.job_progressed",
  trainingAnnVersionPublished: "training.ann_version_published",
  trainingComputeAllocated: "training.compute_allocated",
  trainingComputeReleased: "training.compute_released",
} as const;

export type AuditAction = (typeof auditAction)[keyof typeof auditAction];

export async function logActivity(
  db: ReturnType<typeof getDb>,
  args: {
    action: AuditAction | string;
    actorUserId?: string | null;
    orgId?: string | null;
    targetType: "training_recipe" | "training_job" | "training_ann_version";
    targetId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await db.insert(trainingAuditLogs).values({
      id: uid(),
      action: args.action,
      actorUserId: args.actorUserId ?? null,
      orgId: args.orgId ?? null,
      targetType: args.targetType,
      targetId: args.targetId,
      metadata: args.metadata ?? null,
    });
  } catch (err) {
    // Audit logging must never break the caller. Log and move on.
    // eslint-disable-next-line no-console
    console.error("[training] audit log failed:", err);
  }
}
