/**
 * Append-only audit log helper for the tissue service.
 */

import type { Database } from "./db-types.js";
import { auditLogs } from "../db/schema.js";
import { uid } from "./ids.js";

export const auditAction = {
  tissueCreated: "tissue.created",
  tissueUpdated: "tissue.updated",
  tissuePublished: "tissue.published",
  tissuePaused: "tissue.paused",
  tissueDeprecated: "tissue.deprecated",
  memberAdded: "tissue.member_added",
  memberRemoved: "tissue.member_removed",
  decisionEmitted: "tissue.decision_emitted",
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
