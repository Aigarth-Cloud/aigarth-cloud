/**
 * ANN auto-publisher (Phase 19C.6).
 *
 * After a training job succeeds, if `autoPublish === true`, the
 * worker calls `publishTrainingResult` to:
 *   1. Look up the ANN's current latest version (or null if none).
 *   2. Compute the next semver (patch-bump).
 *   3. Create a new version with the training metadata.
 *   4. If `autoPublish`, also promote the new version.
 *
 * Auto-publish failures are non-fatal — the training job is
 * already succeeded. We log + audit; the caller (worker) can
 * still move on.
 */

import { getDb } from "../db/index.js";
import { type TrainingJob, type TrainingMetrics } from "../db/schema.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { getAnnClient, type AnnClient } from "../clients/ann.js";

export interface PublishResult {
  newVersionId: string;
  version: string;
  promoted: boolean;
  alreadyLatest: boolean;
}

// ---------- Public entry point ----------

/**
 * Publish a successful training job as a new ANN version. The
 * caller (worker) is responsible for only invoking this when
 * the job has reached `succeeded`.
 *
 * Throws if the ANN is not reachable AND the caller has set
 * `throwOnMissing: true`. Otherwise returns a `{ skipped: true }`
 * shape so the worker can continue.
 */
export async function publishTrainingResult(
  trainingJob: TrainingJob,
  computeResult: { result?: Record<string, unknown>; metrics: TrainingMetrics },
  options: { annClientOverride?: AnnClient; throwOnMissing?: boolean } = {},
): Promise<PublishResult | { skipped: true; reason: string }> {
  const annClient = options.annClientOverride ?? getAnnClient();
  const ann = await annClient.getAnn(trainingJob.annId);
  if (!ann) {
    const reason = `ANN ${trainingJob.annId} not found`;
    if (options.throwOnMissing) throw new Error(reason);
    // eslint-disable-next-line no-console
    console.warn(`[annPublisher] ${reason} — skipping publish for job ${trainingJob.id}`);
    return { skipped: true, reason };
  }

  const nextVersion = bumpPatch(ann.currentVersion);
  const alreadyLatest = nextVersion === ann.currentVersion;

  // The artifact hash is stored on the training job by the
  // compute bridge. If the worker passed metrics only, derive
  // a synthetic hash so the call to annClient.createVersion
  // has something to send.
  const artifactUrl = trainingJob.artifactUrl ?? `s3://aigarth/training-artifacts/${trainingJob.id}/metrics.json`;
  const artifactSizeBytes = trainingJob.artifactSizeBytes ?? Buffer.byteLength(JSON.stringify(computeResult.metrics), "utf-8");
  const artifactHash = trainingJob.artifactHash ?? "0".repeat(64);

  const handle = await annClient.createVersion(trainingJob.annId, {
    version: nextVersion,
    changelog: `Trained by services/training job ${trainingJob.id} using recipe '${trainingJob.recipeJson.slug}'.`,
    artifactUrl,
    artifactSizeBytes,
    artifactHash,
    trainingComputeJobId: trainingJob.computeJobId ?? undefined,
    trainingDatasetHash: undefined,
    hyperparameters: trainingJob.hyperparams as Record<string, unknown>,
    metrics: computeResult.metrics as Record<string, unknown>,
    isLatest: true,
  });

  let promoted = false;
  if (trainingJob.autoPublish) {
    await annClient.promoteVersion(trainingJob.annId, handle.id);
    promoted = true;
  }

  const db = getDb();
  await logActivity(db, {
    action: auditAction.trainingAnnVersionPublished,
    actorUserId: trainingJob.submittedBy,
    targetType: "training_ann_version",
    targetId: handle.id,
    metadata: {
      ann_id: trainingJob.annId,
      version: handle.version,
      promoted,
      training_job_id: trainingJob.id,
      auto_publish: trainingJob.autoPublish,
    },
  });

  return { newVersionId: handle.id, version: handle.version, promoted, alreadyLatest };
}

// ---------- Semver helper ----------

/**
 * Bump the patch component of a semver string. Examples:
 *   "0.1.0"   -> "0.1.1"
 *   "1.2.3"   -> "1.2.4"
 *   "1.2"     -> "1.2.1"  (2-part)
 *   null      -> "0.1.0"  (no prior version)
 *   garbage   -> "0.1.0"  (fallback)
 */
export function bumpPatch(current: string | null | undefined): string {
  if (!current) return "0.1.0";
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(current.trim());
  if (!m) return "0.1.0";
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = m[3] !== undefined ? Number(m[3]) + 1 : 1;
  return `${major}.${minor}.${patch}`;
}
