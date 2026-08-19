/**
 * Append-only audit log helper for the Qubic service.
 *
 * Schema is local to this service (not shared with identity) so the
 * enum values can be Qubic-specific.
 */

import type { Database } from "./db-types.js";
import { auditLogs } from "../db/schema.js";
import { uid } from "./ids.js";

export const auditAction = {
  walletLinked: "wallet.linked",
  stakeIntentCreated: "stake.intent_created",
  stakeBroadcast: "stake.broadcast",
  stakeCancelled: "stake.cancelled",
  stakeReleased: "stake.released",
  stakeAuthorized: "stake.authorized",
  txConfirmed: "tx.confirmed",
  txFailed: "tx.failed",
  rewardAccrued: "reward.accrued",
  rewardClaimed: "reward.claimed",
  treasuryMovement: "treasury.movement",
  validatorOnboarded: "validator.onboarded",
  validatorDeactivated: "validator.deactivated",
} as const;

// Note: the audit action column in this service uses a free-form text
// (no pgEnum) to keep the Qubic service decoupled from the identity
// service's enum. We still type-check the values above.

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

// Suppress unused import
// (none — audit_action enum covers the type space)
