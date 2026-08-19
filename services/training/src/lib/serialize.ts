/**
 * Wire serializers.
 *
 * The DB rows and the API responses are intentionally different
 * shapes. Serializers are the single place we translate between
 * them. Keep this file boring and mechanical.
 */

import { bigintToNumber } from "./db-types.js";
import type {
  TrainingRecipe,
  TrainingJob,
  TrainingAuditLog,
  TrainingProgress,
} from "../db/schema.js";

/** Public-facing recipe. */
export function serializeRecipe(r: TrainingRecipe) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    description: r.description,
    architecture: r.architecture,
    default_hyperparams: r.defaultHyperparams,
    supported_dataset_kinds: r.supportedDatasetKinds,
    output_artifact_kind: r.outputArtifactKind,
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

/** Public-facing training job. */
export function serializeJob(j: TrainingJob) {
  return {
    id: j.id,
    ann_id: j.annId,
    dataset_id: j.datasetId,
    dataset_version_id: j.datasetVersionId,
    recipe_id: j.recipeId,
    recipe: j.recipeJson,
    hyperparams: j.hyperparams,
    status: j.status,
    compute_job_id: j.computeJobId,
    progress: j.progressJson,
    metrics: j.metricsJson,
    error_message: j.errorMessage,
    artifact_url: j.artifactUrl,
    artifact_size_bytes: j.artifactSizeBytes != null ? bigintToNumber(j.artifactSizeBytes) : null,
    artifact_hash: j.artifactHash,
    auto_publish: j.autoPublish,
    submitted_by: j.submittedBy,
    submitted_at: j.submittedAt.toISOString(),
    started_at: j.startedAt?.toISOString() ?? null,
    finished_at: j.finishedAt?.toISOString() ?? null,
  };
}

/** Audit log row. Internal — not exposed via HTTP. */
export function serializeAuditLog(a: TrainingAuditLog) {
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

/** SSE progress event payload. */
export function serializeProgressEvent(p: TrainingProgress) {
  return {
    job_id: p.jobId,
    status: p.status,
    progress: p.progress,
    metrics: p.metrics,
    ts: p.ts.toISOString(),
  };
}
