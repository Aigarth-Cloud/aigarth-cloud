/**
 * Service-local audit log helper.
 * Mirrors the pattern used in services/identity and services/qubic.
 */

import { getDb } from "../db/index.js";
import { economyAuditLogs, type AuditLog } from "../db/schema.js";
import { uid } from "./ids.js";

export interface LogActivityOpts {
  actorUserId?: string | null;
  orgId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logActivity(
  action: string,
  message?: string,
  opts: LogActivityOpts = {},
): Promise<AuditLog> {
  const db = getDb();
  const id = uid();
  const row = await db
    .insert(economyAuditLogs)
    .values({
      id,
      action,
      actorUserId: opts.actorUserId ?? null,
      orgId: opts.orgId ?? null,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      metadata: { ...(message ? { message } : {}) },
    })
    .returning();
  return row[0]!;
}
