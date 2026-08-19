/**
 * Append-only audit log helper for the Compute service.
 *
 * Schema is local to this service so action values can be compute-specific.
 */

import type { Database } from "./db-types.js";
import { auditLogs } from "../db/schema.js";
import { uid } from "./ids.js";

export const auditAction = {
  regionCreated: "region.created",
  regionUpdated: "region.updated",
  regionDeleted: "region.deleted",
  clusterCreated: "cluster.created",
  clusterMemberAdded: "cluster.member_added",
  clusterMemberRemoved: "cluster.member_removed",
  jobSubmitted: "job.submitted",
  jobBroadcast: "job.broadcast",
  jobCompleted: "job.completed",
  jobFailed: "job.failed",
  jobCancelled: "job.cancelled",
  reservationCreated: "reservation.created",
  reservationBroadcast: "reservation.broadcast",
  reservationReleased: "reservation.released",
  reservationExpired: "reservation.expired",
  nodeReservationCreated: "node_reservation.created",
  nodeReservationFunded: "node_reservation.funded",
  nodeReservationConfirmWindowOpened: "node_reservation.confirm_window_opened",
  nodeReservationConfirmed: "node_reservation.confirmed",
  nodeReservationReleased: "node_reservation.released",
  nodeReservationAutoReleased: "node_reservation.auto_released",
  qubicUsdRateRecorded: "qubic_usd_rate.recorded",
  nodeEscrowDebited: "node_escrow.debited",
  nodeEscrowCredited: "node_escrow.credited",
  nodeYieldLockCreated: "node_yield_lock.created",
  nodeYieldLockReleased: "node_yield_lock.released",
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
