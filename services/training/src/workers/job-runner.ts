/**
 * In-process training job runner (Phase 19C.4 + 19C.6).
 *
 * One instance per process. The worker polls the DB every
 * `TRAINING_WORKER_INTERVAL_MS` for queued jobs, claims one,
 * and runs it through the compute bridge. On success, it calls
 * the ANN publisher to create a new version (and promote it
 * if `autoPublish`).
 *
 * v1 deliberately keeps this simple: no leader election, no
 * queue external to the DB. The `FOR UPDATE SKIP LOCKED` style
 * of claiming is documented in `services/jobs.ts`.claimNextQueuedJob
 * as the v2 upgrade path.
 */

import { loadConfig } from "../config/index.js";
import { claimNextQueuedJob, getJob } from "../services/jobs.js";
import { runTrainingJob, allocateForJob } from "../services/computeBridge.js";
import { publishTrainingResult } from "../services/annPublisher.js";
import { publishProgress } from "../services/progress.js";
import { markFailed } from "../services/jobs.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { getDb } from "../db/index.js";

interface RunningJob {
  abort: AbortController;
  promise: Promise<void>;
}

let intervalHandle: NodeJS.Timeout | null = null;
const running = new Map<string, RunningJob>();
let shuttingDown = false;

export function startWorker(): void {
  if (intervalHandle) return; // idempotent
  const cfg = loadConfig();
  // eslint-disable-next-line no-console
  console.log(
    `[worker] starting — interval=${cfg.TRAINING_WORKER_INTERVAL_MS}ms, mode=${cfg.TRAINING_COMPUTE_MODE}`,
  );
  intervalHandle = setInterval(tick, cfg.TRAINING_WORKER_INTERVAL_MS);
  // Run an immediate tick so the first job doesn't wait.
  void tick();
}

export async function stopWorker(): Promise<void> {
  shuttingDown = true;
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  // Cancel any in-flight job loops and wait for them to unwind.
  const waits: Promise<void>[] = [];
  for (const r of running.values()) {
    r.abort.abort();
    waits.push(r.promise.catch(() => undefined));
  }
  running.clear();
  await Promise.all(waits);
  // eslint-disable-next-line no-console
  console.log("[worker] stopped");
}

async function tick(): Promise<void> {
  if (shuttingDown) return;
  // Don't claim more than one job at a time. v1 single-worker
  // semantics; the loop is sequential so we don't overload
  // a stub compute client.
  if (running.size > 0) return;
  let claimed;
  try {
    claimed = await claimNextQueuedJob();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[worker] claimNextQueuedJob failed:", err);
    return;
  }
  if (!claimed) return;

  const abort = new AbortController();
  const promise = runJob(claimed.id, abort.signal);
  running.set(claimed.id, { abort, promise });
  promise.finally(() => {
    running.delete(claimed.id);
  });
}

async function runJob(trainingJobId: string, signal: AbortSignal): Promise<void> {
  try {
    // The job is in 'preparing' after claimNextQueuedJob.
    // allocateForJob is idempotent if compute_job_id is already set.
    const training = await getJob(trainingJobId);
    if (!training.computeJobId) {
      await allocateForJob(training);
    }
    const { outcome, metrics, error } = await runTrainingJob(trainingJobId, { signal });
    if (outcome === "succeeded" && metrics) {
      // Auto-publish step.
      const refreshed = await getJob(trainingJobId);
      if (refreshed.autoPublish) {
        const result = await publishTrainingResult(refreshed, {
          result: refreshed.metricsJson as Record<string, unknown>,
          metrics,
        });
        if ("skipped" in result) {
          // eslint-disable-next-line no-console
          console.warn(
            `[worker] autoPublish skipped for job ${trainingJobId}: ${result.reason}`,
          );
        } else {
          // eslint-disable-next-line no-console
          console.log(
            `[worker] autoPublish ok — ann=${refreshed.annId} version=${result.version} promoted=${result.promoted}`,
          );
        }
      }
    } else if (outcome === "failed") {
      // eslint-disable-next-line no-console
      console.warn(`[worker] training job ${trainingJobId} failed: ${error ?? "unknown"}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[worker] runJob(${trainingJobId}) threw:`, err);
    try {
      await markFailed(trainingJobId, `worker_error: ${message}`);
      await publishProgress(trainingJobId, {
        jobId: trainingJobId,
        status: "failed",
        progress: {},
        metrics: {},
        ts: new Date(),
      });
      const db = getDb();
      await logActivity(db, {
        action: auditAction.trainingJobFailed,
        targetType: "training_job",
        targetId: trainingJobId,
        metadata: { worker_error: message },
      });
    } catch {
      // Swallow — we've done our best.
    }
  }
}
