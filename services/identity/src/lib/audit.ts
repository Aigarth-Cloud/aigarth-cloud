/**
 * Append-only audit log helpers. Every state-changing operation
 * in the identity service should call this.
 */

import type { Database } from "./db-types.js";
import { auditLogs, type AuditAction } from "../db/schema.js";
import { uid } from "./ids.js";

export interface AuditEvent {
  action: AuditAction;
  actorUserId?: string | null;
  orgId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
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
    ipHash: event.ipHash,
    userAgent: event.userAgent,
  });
}
