/**
 * Shared serializers used by routes.
 */

import type {
  Ann,
  AnnVersion,
  AnnRating,
  AnnBenchmark,
  AnnDeployment,
  AnnLicenseGrant,
  AnnDecisionOutcomeRow,
  AnnRetrainConfig,
  AnnRetrainEvent,
} from "../db/schema.js";

/**
 * Stable JSON stringify with sorted keys. Used by the Execution
 * Router for canonicalising input + output before hashing. The
 * local stub backend (`services/ann/src/backends/stub.ts`) has its
 * own copy of this function; the version here is exported for
 * cross-service callers (e.g. the QubicOCExecutor).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}

export function serializeAnn(a: Ann) {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    tagline: a.tagline,
    description: a.description,
    icon: a.icon,
    tags: a.tags,
    category_id: a.categoryId,
    license_id: a.licenseId,
    creator_user_id: a.creatorUserId,
    creator_name: a.creatorName,
    visibility: a.visibility,
    status: a.status,
    creator_wallet_address: a.creatorWalletAddress,
    signature: a.signature,
    accuracy: a.accuracy,
    latency_p50_ms: a.latencyP50Ms,
    latency_p99_ms: a.latencyP99Ms,
    total_calls: a.totalCalls.toString(),
    total_revenue_qubic: a.totalRevenueQubic.toString(),
    monthly_calls: a.monthlyCalls.toString(),
    downloads: a.downloads.toString(),
    rating_average: a.ratingAverage,
    rating_count: a.ratingCount,
    current_version_id: a.currentVersionId,
    published_at: a.publishedAt?.toISOString() ?? null,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
    /** Phase 18B — trinary decision surface. */
    decision_protocol: a.decisionProtocol,
    authority_weight: a.authorityWeight,
    /** The trinary prompt template is intentionally omitted from the
     *  public serializer: it's creator-only data, not consumer-facing. */
  };
}

export function serializeVersion(v: AnnVersion) {
  return {
    id: v.id,
    ann_id: v.annId,
    version: v.version,
    changelog: v.changelog,
    artifact_url: v.artifactUrl,
    artifact_size_bytes: v.artifactSizeBytes?.toString() ?? null,
    artifact_hash: v.artifactHash,
    training_compute_job_id: v.trainingComputeJobId,
    training_dataset_hash: v.trainingDatasetHash,
    hyperparameters: v.hyperparameters,
    metrics: v.metrics,
    signature: v.signature,
    is_latest: v.isLatest,
    created_at: v.createdAt.toISOString(),
  };
}

export function serializeRating(r: AnnRating) {
  return {
    id: r.id,
    ann_id: r.annId,
    user_id: r.userId,
    rating: r.rating,
    review: r.review,
    verified_use: r.verifiedUse,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export function serializeBenchmark(b: AnnBenchmark) {
  return {
    id: b.id,
    ann_id: b.annId,
    version_id: b.versionId,
    benchmark_name: b.benchmarkName,
    score: b.score,
    dataset_hash: b.datasetHash,
    runner: b.runner,
    metadata: b.metadata,
    verified_at: b.verifiedAt.toISOString(),
    created_at: b.createdAt.toISOString(),
  };
}

export function serializeDeployment(d: AnnDeployment) {
  return {
    id: d.id,
    ann_id: d.annId,
    version_id: d.versionId,
    region_id: d.regionId,
    cluster_id: d.clusterId,
    compute_job_id: d.computeJobId,
    status: d.status,
    endpoint_url: d.endpointUrl,
    replicas: d.replicas,
    owner_user_id: d.ownerUserId,
    owner_org_id: d.ownerOrgId,
    cost_per_call_qubic: d.costPerCallQubic.toString(),
    deployed_at: d.deployedAt?.toISOString() ?? null,
    stopped_at: d.stoppedAt?.toISOString() ?? null,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
}

export function serializeLicenseGrant(g: AnnLicenseGrant) {
  return {
    id: g.id,
    ann_id: g.annId,
    license_id: g.licenseId,
    user_id: g.userId,
    org_id: g.orgId,
    status: g.status,
    granted_at: g.grantedAt.toISOString(),
    expires_at: g.expiresAt?.toISOString() ?? null,
    call_count: g.callCount.toString(),
    revoked_at: g.revokedAt?.toISOString() ?? null,
    revoked_reason: g.revokedReason,
  };
}

/**
 * Phase 19D.1 — decision outcome (the "what actually happened" side of
 * the feedback loop). One per `ann_decision` row, joined to the ANN for
 * fast queries. `confidence_in_label` is the reporter's self-rated
 * confidence, not the ANN's own confidence from the envelope.
 */
export function serializeDecisionOutcome(o: AnnDecisionOutcomeRow) {
  return {
    id: o.id,
    decision_id: o.decisionId,
    ann_id: o.annId,
    ann_version_id: o.annVersionId,
    outcome: o.outcome,
    confidence_in_label: o.confidenceInLabel,
    notes: o.notes,
    recorded_by: o.recordedBy,
    source: o.source,
    outcome_at: o.outcomeAt.toISOString(),
    recorded_at: o.recordedAt.toISOString(),
  };
}

/**
 * Phase 19D.2 — per-ANN retrain config.
 */
export function serializeRetrainConfig(c: AnnRetrainConfig) {
  return {
    ann_id: c.annId,
    opt_in: c.optIn,
    baseline_success_rate: c.baselineSuccessRate,
    drift_threshold: c.driftThreshold,
    outcome_floor: c.outcomeFloor,
    cooldown_hours: c.cooldownHours,
    last_retrain_at: c.lastRetrainAt?.toISOString() ?? null,
    preferred_dataset_version_id: c.preferredDatasetVersionId,
    notify_mode: c.notifyMode,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

/**
 * Phase 19D.2 — retrain event (one row per triggered retrain).
 */
export function serializeRetrainEvent(e: AnnRetrainEvent) {
  return {
    id: e.id,
    ann_id: e.annId,
    training_job_id: e.trainingJobId,
    reason: e.reason,
    baseline_success_rate: e.baselineSuccessRate,
    current_success_rate: e.currentSuccessRate,
    total_outcomes_at_trigger: e.totalOutcomesAtTrigger,
    notes: e.notes,
    triggered_at: e.triggeredAt.toISOString(),
  };
}
