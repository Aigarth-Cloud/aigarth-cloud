/**
 * Wire serializers.
 *
 * The DB rows and the API responses are intentionally different
 * shapes. Serializers are the single place we translate between
 * them. Keep this file boring and mechanical.
 */

import { bigintToNumber } from "./db-types.js";
import type {
  Dataset,
  DatasetVersion,
  DatasetAccess,
  DatasetAuditLog,
  DatasetSchema,
} from "../db/schema.js";

/** Public-facing dataset. Hides internal columns like `datasetRevenueBps`
 *  unless we want to surface it on the listing detail page in v2. */
export function serializeDataset(d: Dataset) {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    description: d.description,
    owner_user_id: d.ownerUserId,
    owner_org_id: d.ownerOrgId ?? null,
    kind: d.kind,
    license: d.license,
    source: d.source,
    status: d.status,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
}

/** Public-facing dataset version. */
export function serializeDatasetVersion(v: DatasetVersion) {
  return {
    id: v.id,
    dataset_id: v.datasetId,
    version: v.version,
    object_key: v.objectKey,
    content_hash: v.contentHash,
    size_bytes: bigintToNumber(v.sizeBytes),
    row_count: v.rowCount != null ? bigintToNumber(v.rowCount) : null,
    schema: v.schemaJson as DatasetSchema,
    changelog: v.changelog,
    created_at: v.createdAt.toISOString(),
  };
}

/** Public-facing access grant. */
export function serializeDatasetAccess(a: DatasetAccess) {
  return {
    id: a.id,
    dataset_id: a.datasetId,
    grantee_user_id: a.granteeUserId ?? null,
    mode: a.mode,
    expires_at: a.expiresAt?.toISOString() ?? null,
    revoked_at: a.revokedAt?.toISOString() ?? null,
    granted_by: a.grantedBy,
    granted_at: a.grantedAt.toISOString(),
  };
}

/** Audit log row. Internal — not exposed via HTTP. */
export function serializeDatasetAuditLog(a: DatasetAuditLog) {
  return {
    id: a.id,
    action: a.action,
    actor_user_id: a.actorUserId,
    org_id: a.orgId,
    target_type: a.targetType,
    target_id: a.targetId,
    metadata: a.metadata,
    created_at: a.createdAt.toISOString(),
  };
}
