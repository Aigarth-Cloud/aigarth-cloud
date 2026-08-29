/**
 * Append-only audit log helper for the ANN service.
 *
 * Service-local — uses free-form `action` text.
 */

import type { Database } from "./db-types.js";
import { auditLogs } from "../db/schema.js";
import { uid } from "./ids.js";

export const auditAction = {
  annCreated: "ann.created",
  annUpdated: "ann.updated",
  annPublished: "ann.published",
  annDeprecated: "ann.deprecated",
  versionAdded: "ann.version_added",
  annSigned: "ann.signed",
  deploymentStarted: "ann.deployment_started",
  deploymentStopped: "ann.deployment_stopped",
  ratingAdded: "ann.rating_added",
  benchmarkAdded: "ann.benchmark_added",
  licenseGranted: "ann.license_granted",
  /** Phase 18B — an ANN emitted a trinary IntentEnvelope. */
  decisionEmitted: "ann.decision_emitted",
  /** Phase 19D.1 — a caller recorded the real-world outcome of a decision. */
  decisionOutcomeRecorded: "ann.decision_outcome_recorded",
  /** Phase 29 — an ANN execution was submitted to the Execution Router. */
  executionSubmitted: "ann.execution.submitted",
  /** Phase 29 — an ANN execution completed (any target, any status). */
  executionCompleted: "ann.execution.completed",
  /** Phase 29 — an ANN execution was verified (OC target, replicas agreed). */
  executionVerified: "ann.execution.verified",
  /** Phase 29 — an ANN execution failed (any target). */
  executionFailed: "ann.execution.failed",
} as const;

export interface AuditEvent {
  action: keyof typeof auditAction | (typeof auditAction)[keyof typeof auditAction] | string;
  actorUserId?: string | null;
  orgId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(db: Database, event: AuditEvent): Promise<void> {
  await db.insert(auditLogs).values({
    id: uid(),
    action: event.action,
    actorUserId: event.actorUserId ?? null,
    orgId: event.orgId ?? null,
    targetType: event.targetType,
    targetId: event.targetId,
    metadata: event.metadata ?? {},
  });
}
