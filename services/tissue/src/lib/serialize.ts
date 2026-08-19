/**
 * Shared serializers used by routes.
 */

import type {
  Tissue,
  TissueMember,
  TissueDecision,
  TissueLicense,
} from "../db/schema.js";

export function serializeTissue(t: Tissue) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    owner_user_id: t.ownerUserId,
    owner_org_id: t.ownerOrgId,
    visibility: t.visibility,
    status: t.status,
    version: t.version,
    policy: t.policy,
    policy_kind: t.policyKind,
    access: t.access,
    total_decisions: t.totalDecisions.toString(),
    metadata: t.metadata,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
  };
}

export function serializeTissueMember(m: TissueMember) {
  return {
    id: m.id,
    tissue_id: m.tissueId,
    ann_slug: m.annSlug,
    ann_id: m.annId,
    role: m.role,
    authority_weight: m.authorityWeight,
    position: m.position,
    created_at: m.createdAt.toISOString(),
  };
}

export function serializeTissueLicense(l: TissueLicense) {
  return {
    id: l.id,
    tissue_id: l.tissueId,
    grantee_user_id: l.granteeUserId,
    grantee_org_id: l.granteeOrgId,
    source: l.source,
    expires_at: l.expiresAt?.toISOString() ?? null,
    max_decisions: l.maxDecisions?.toString() ?? null,
    revoked_at: l.revokedAt?.toISOString() ?? null,
    created_at: l.createdAt.toISOString(),
  };
}

export function serializeTissueDecision(d: TissueDecision) {
  return {
    id: d.id,
    tissue_id: d.tissueId,
    tissue_version: d.tissueVersion,
    request_id: d.requestId,
    state: d.state,
    confidence: d.confidence,
    authority: d.authority,
    reasoning: d.reasoning,
    reversibility: d.reversibility,
    time_horizon: d.timeHorizon,
    contributors: d.contributors,
    ignored: d.ignored,
    envelope: d.envelope,
    signature: d.signature,
    issued_at: d.issuedAt.toISOString(),
    expires_at: d.expiresAt?.toISOString() ?? null,
    latency_ms: d.latencyMs,
    created_at: d.createdAt.toISOString(),
  };
}
