/**
 * Service-local audit logging.
 *
 * Mirrors the pattern from services/tissue + services/ann. The
 * `dataset_audit_logs` table is intentionally separate from any
 * platform-wide audit log (those live in services/identity); this
 * one is for dataset-domain events only.
 */

import { getDb } from "../db/index.js";
import { datasetAuditLogs } from "../db/schema.js";
import { uid } from "./ids.js";

export const auditAction = {
  datasetCreated: "dataset.created",
  datasetUpdated: "dataset.updated",
  datasetStatusChanged: "dataset.status_changed",
  datasetVersionUploaded: "dataset.version_uploaded",
  datasetAccessGranted: "dataset.access_granted",
  datasetAccessRevoked: "dataset.access_revoked",
  datasetConnectorCreated: "dataset.connector_created",
  datasetConnectorSynced: "dataset.connector_synced",
} as const;

export type AuditAction = (typeof auditAction)[keyof typeof auditAction];

export async function logActivity(
  db: ReturnType<typeof getDb>,
  args: {
    action: AuditAction | string;
    actorUserId?: string | null;
    orgId?: string | null;
    targetType: "dataset" | "dataset_version" | "dataset_access" | "dataset_connector";
    targetId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await db.insert(datasetAuditLogs).values({
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
    console.error("[dataset] audit log failed:", err);
  }
}
