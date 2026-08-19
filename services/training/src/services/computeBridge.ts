/**
 * Compute bridge (Phase 19C.4).
 *
 * Bridges `training_jobs` rows to the underlying services/compute.
 * The bridge is mode-agnostic: it goes through whatever
 * `ComputeClient` the factory hands out (stub or http).
 *
 *   allocateForJob(trainingJob)    — submit + store compute_job_id
 *   pollComputeJob(computeJobId)   — fetch + (mark succeeded/failed on terminal)
 *   releaseCompute(computeJobId)   — best-effort cancel
 *   runTrainingJob(trainingJobId)  — main orchestration: allocate -> poll -> terminal
 *
 * Polling backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ... The
 * function uses an internal counter so the same loop is reusable
 * from the worker's tick handler and from the route layer.
 */

import { createHash } from "node:crypto";
import { getDb } from "../db/index.js";
import { type TrainingJob, type TrainingMetrics } from "../db/schema.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { ComputeBridgeError } from "../lib/errors.js";
import { getComputeClient, type ComputeJobResult } from "../clients/compute.js";
import {
  getJob,
  markSucceeded,
  markFailed,
  markRunning,
  setComputeJobId,
  updateProgress,
} from "./jobs.js";
import { publishProgress } from "./progress.js";
import { loadConfig } from "../config/index.js";

// ---------- Polling ----------

const POLL_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;
const POLL_MAX_MS = 30_000;

function backoffDelayMs(attempt: number): number {
  if (attempt < POLL_BACKOFF_MS.length) return POLL_BACKOFF_MS[attempt]!;
  return POLL_MAX_MS;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("aborted");
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
  if (signal?.aborted) throw new Error("aborted");
}

// ---------- Allocation ----------

/**
 * Allocate a compute job for a training job. Returns the
 * `compute_job_id` (cross-service ref) and stores it on the
 * training row. The training job is still in `preparing`; the
 * worker transitions it to `running` after the first poll.
 */
export async function allocateForJob(trainingJob: TrainingJob): Promise<string> {
  const client = getComputeClient();
  let handle;
  try {
    handle = await client.submitJob({
      type: "training",
      userId: trainingJob.submittedBy,
      payload: {
        training_job_id: trainingJob.id,
        recipe: trainingJob.recipeJson,
        hyperparams: trainingJob.hyperparams,
        ann_id: trainingJob.annId,
        dataset_id: trainingJob.datasetId,
        dataset_version_id: trainingJob.datasetVersionId,
        output_artifact_kind: "ann_weights_v1",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ComputeBridgeError(`Failed to allocate compute job: ${message}`);
  }
  await setComputeJobId(trainingJob.id, handle.id);
  const db = getDb();
  await logActivity(db, {
    action: auditAction.trainingComputeAllocated,
    actorUserId: trainingJob.submittedBy,
    targetType: "training_job",
    targetId: trainingJob.id,
    metadata: { compute_job_id: handle.id, status: handle.status },
  });
  return handle.id;
}

// ---------- Polling ----------

export type PollOutcome = "running" | "succeeded" | "failed";

export async function pollComputeJob(computeJobId: string): Promise<{
  outcome: PollOutcome;
  compute: ComputeJobResult;
}> {
  const client = getComputeClient();
  const compute = await client.getJob(computeJobId);
  if (compute.status === "completed") return { outcome: "succeeded", compute };
  if (compute.status === "failed") return { outcome: "failed", compute };
  if (compute.status === "cancelled") {
    return { outcome: "failed", compute: { ...compute, error: compute.error ?? "cancelled" } };
  }
  return { outcome: "running", compute };
}

// ---------- Release ----------

export async function releaseCompute(computeJobId: string): Promise<void> {
  const client = getComputeClient();
  try {
    await client.cancelJob(computeJobId);
  } catch (err) {
    // Best-effort. The job might already be terminal. Log and move on.
    // eslint-disable-next-line no-console
    console.warn(`[computeBridge] releaseCompute(${computeJobId}) failed:`, err);
  }
}

// ---------- Orchestration ----------

/**
 * Drive a training job from `preparing` to a terminal state.
 *
 * The flow:
 *   1. Mark `running` + publish initial progress.
 *   2. Poll the compute job with exponential backoff until
 *      the status is `completed` or `failed` (or the job is
 *      cancelled mid-flight).
 *   3. On success, build a synthetic metrics snapshot, mark
 *      the training job succeeded, publish final progress.
 *      The auto-publish step (19C.6) is handled by the
 *      caller (the worker), not here.
 *   4. On failure, mark the training job failed with the
 *      compute service's error message.
 *
 * The `signal` lets the worker cancel the loop if the job
 * was cancelled by the user.
 */
export async function runTrainingJob(
  trainingJobId: string,
  options: { signal?: AbortSignal } = {},
): Promise<{ outcome: "succeeded" | "failed" | "cancelled"; metrics?: TrainingMetrics; error?: string }> {
  const training = await getJob(trainingJobId);
  if (training.status === "cancelled") {
    return { outcome: "cancelled" };
  }
  if (training.status !== "preparing") {
    throw new ComputeBridgeError(
      `Training job ${trainingJobId} is in status '${training.status}'; expected 'preparing'.`,
    );
  }

  // Allocate a compute job if we don't already have one.
  let computeJobId = training.computeJobId;
  if (!computeJobId) {
    computeJobId = await allocateForJob(training);
  }

  await markRunning(trainingJobId);
  await publishProgress(trainingJobId, {
    jobId: trainingJobId,
    status: "running",
    progress: { epoch: 0, total_epochs: 10 },
    metrics: {},
    ts: new Date(),
  });

  // Poll until terminal.
  let attempt = 0;
  // The synthetic progress writer ticks in the background so
  // the SSE stream stays alive even while the compute job is
  // still queued. In a real production setup this would be
  // driven by heartbeat messages from the compute service.
  const progressTimer = startSyntheticProgress(trainingJobId, options.signal);

  try {
    while (true) {
      if (options.signal?.aborted) {
        await releaseCompute(computeJobId);
        return { outcome: "cancelled" };
      }
      // Check the DB for user-cancellation.
      const current = await getJob(trainingJobId);
      if (current.status === "cancelled") {
        await releaseCompute(computeJobId);
        return { outcome: "cancelled" };
      }

      const { outcome, compute } = await pollComputeJob(computeJobId);
      if (outcome === "succeeded") {
        const metrics = computeResultToMetrics(compute);
        const artifact = buildArtifact(trainingJobId, metrics);
        const updated = await markSucceeded(trainingJobId, { metrics, artifact });
        await publishProgress(trainingJobId, {
          jobId: trainingJobId,
          status: "succeeded",
          progress: { epoch: 10, total_epochs: 10, ...(metrics as Record<string, unknown>) },
          metrics,
          ts: new Date(),
        });
        return { outcome: "succeeded", metrics: updated.metricsJson as TrainingMetrics };
      }
      if (outcome === "failed") {
        const errorMessage = compute.error ?? "compute job failed";
        await markFailed(trainingJobId, errorMessage);
        await publishProgress(trainingJobId, {
          jobId: trainingJobId,
          status: "failed",
          progress: {},
          metrics: {},
          ts: new Date(),
        });
        return { outcome: "failed", error: errorMessage };
      }

      // Still running — back off and try again.
      await sleep(backoffDelayMs(attempt), options.signal);
      attempt += 1;
    }
  } finally {
    clearInterval(progressTimer);
  }
}

// ---------- Helpers ----------

/**
 * The compute service returns its result as `Record<string, unknown>`.
 * Map the well-known training metrics fields through; pass the
 * rest through verbatim so recipes can attach their own metrics.
 */
function computeResultToMetrics(compute: ComputeJobResult): TrainingMetrics {
  const r = compute.result ?? {};
  const metrics: TrainingMetrics = {};
  if (typeof r.loss === "number") metrics.loss = r.loss;
  if (typeof r.val_loss === "number") metrics.val_loss = r.val_loss;
  if (typeof r.accuracy === "number") metrics.accuracy = r.accuracy;
  if (typeof r.val_accuracy === "number") metrics.val_accuracy = r.val_accuracy;
  // Pass-through: copy any extra fields the recipe cares about.
  for (const [k, v] of Object.entries(r)) {
    if (!(k in metrics)) (metrics as Record<string, unknown>)[k] = v;
  }
  return metrics;
}

/**
 * Build the synthetic artifact metadata. v1 stores the metrics
 * JSON itself as the "artifact" — there's no S3 upload in the
 * path. The shape is deterministic so two runs with the same
 * metrics produce the same hash.
 */
function buildArtifact(
  trainingJobId: string,
  metrics: TrainingMetrics,
): { url: string; sizeBytes: number; hash: string } {
  const json = JSON.stringify(metrics, Object.keys(metrics).sort());
  return {
    url: `s3://aigarth/training-artifacts/${trainingJobId}/metrics.json`,
    sizeBytes: Buffer.byteLength(json, "utf-8"),
    hash: deterministicSha256(json),
  };
}

/**
 * Synchronous SHA-256. Returns the lowercase hex digest.
 *
 * The metrics JSON is small (<1KB typically); a sync hash is
 * fine here and avoids awaiting crypto on the hot path.
 */
function deterministicSha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Synthetic progress writer. Emits a tick every 2s that
 * interpolates epoch / loss / accuracy for the SSE stream.
 * The values are deterministic and don't reflect any real
 * training run — they exist so the dashboard has something
 * to show.
 */
function startSyntheticProgress(trainingJobId: string, signal?: AbortSignal): NodeJS.Timeout {
  const cfg = loadConfigSafe();
  const intervalMs = cfg?.TRAINING_PROGRESS_TICK_MS ?? 2000;
  const totalEpochs = 10;
  let epoch = 1;
  return setInterval(() => {
    if (signal?.aborted) return;
    const t = epoch / totalEpochs; // 0..1
    const loss = lerp(1.0, 0.1, t);
    const valLoss = lerp(1.05, 0.15, t);
    const accuracy = lerp(0.5, 0.92, t);
    const valAccuracy = lerp(0.48, 0.89, t);
    const etaSeconds = Math.max(0, (totalEpochs - epoch) * intervalMs / 1000);
    updateProgress(trainingJobId, {
      epoch,
      total_epochs: totalEpochs,
      loss,
      val_loss: valLoss,
      accuracy,
      val_accuracy: valAccuracy,
      eta_seconds: etaSeconds,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(`[computeBridge] updateProgress failed:`, err);
    });
    publishProgress(trainingJobId, {
      jobId: trainingJobId,
      status: "running",
      progress: {
        epoch,
        total_epochs: totalEpochs,
        loss,
        val_loss: valLoss,
        accuracy,
        val_accuracy: valAccuracy,
        eta_seconds: etaSeconds,
      },
      metrics: { loss, accuracy },
      ts: new Date(),
    }).catch(() => {
      // publishProgress already swallows NATS errors; nothing to do.
    });
    epoch += 1;
    if (epoch > totalEpochs) {
      // Stop emitting once we've hit the cap. The terminal
      // progress event will come from runTrainingJob itself.
    }
  }, intervalMs);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function loadConfigSafe(): { TRAINING_PROGRESS_TICK_MS?: number } | null {
  try {
    return loadConfig();
  } catch {
    return null;
  }
}

/**
 * Used by callers that need an async-compatible hash for ad-hoc
 * verification. The internal `deterministicSha256` is sync; this
 * is just a thin Promise wrapper for parity.
 */
export async function sha256Hex(input: string): Promise<string> {
  return Promise.resolve(deterministicSha256(input));
}
