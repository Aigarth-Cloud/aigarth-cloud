/**
 * Job monitor worker.
 *
 * Subscribes to NATS for tx events from services/qubic. For each
 * `aigarth.compute.job` event referencing a job by tx hash, transitions
 * the job to `running` then `completed` (or `failed` on error).
 *
 * Run: `pnpm worker:job-monitor`
 */

import { eq, and, sql } from "drizzle-orm";
import { connect, type NatsConnection } from "nats";
import { loadConfig } from "../config/index.js";
import { getDb, closeDb } from "../db/index.js";
import { jobs } from "../db/schema.js";
import { transitionJob } from "../services/jobs.js";

const POLL_INTERVAL_MS = 10_000;
const RUNNING_TICKS_THRESHOLD = 3;

async function main() {
  const cfg = loadConfig();
  // eslint-disable-next-line no-console
  console.log("[job-monitor] starting");

  let nc: NatsConnection | null = null;
  try {
    nc = await connect({ servers: cfg.NATS_URL });
    // eslint-disable-next-line no-console
    console.log("[job-monitor] connected to NATS");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[job-monitor] NATS not reachable: ${err instanceof Error ? err.message : err}`);
    // eslint-disable-next-line no-console
    console.warn("[job-monitor] continuing in poll-only mode");
  }

  const tick = async () => {
    try {
      await pollInFlight();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[job-monitor] poll error:`, err);
    }
  };

  setInterval(tick, POLL_INTERVAL_MS);
  await tick();

  if (nc) {
    const sub = nc.subscribe(cfg.NATS_JOB_SUBJECT);
    for await (const msg of sub) {
      try {
        const data = JSON.parse(msg.string());
        if (data.jobId && data.event === "running") {
          await transitionJob(data.jobId, "running", {
            startedTick: data.tick,
          });
        } else if (data.jobId && data.event === "completed") {
          await transitionJob(data.jobId, "completed", {
            result: data.result ?? {},
            completedTick: data.tick,
          });
        } else if (data.jobId && data.event === "failed") {
          await transitionJob(data.jobId, "failed", {
            errorMessage: data.error ?? "unknown",
            completedTick: data.tick,
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[job-monitor] msg error:`, err);
      }
    }
  } else {
    setInterval(() => {}, 1 << 30);
  }
}

/**
 * Auto-progress submitted -> running -> completed after enough ticks.
 * For the stub mode, this is how jobs get marked done without real
 * Qubic tick events. Production would replace this with NATS-driven
 * transitions only.
 */
async function pollInFlight() {
  const db = getDb();
  const submitted = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "submitted"))
    .limit(50);
  for (const job of submitted) {
    if (!job.submittedTick) continue;
    const currentTick = Math.floor(Date.now() / 1000);
    if (currentTick - job.submittedTick >= RUNNING_TICKS_THRESHOLD) {
      await transitionJob(job.id, "running", { startedTick: currentTick });
    }
  }
  const running = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "running"))
    .limit(50);
  for (const job of running) {
    if (!job.startedTick) continue;
    const currentTick = Math.floor(Date.now() / 1000);
    // After 2x the running threshold, auto-complete
    if (currentTick - job.startedTick >= RUNNING_TICKS_THRESHOLD * 2) {
      await transitionJob(job.id, "completed", {
        result: { ok: true, note: "auto-completed by monitor (stub mode)" },
        completedTick: currentTick,
      });
    }
  }
  // Expire any deadline-missed jobs
  const expired = await db
    .select()
    .from(jobs)
    .where(
      and(
        sql`${jobs.status} in ('queued', 'submitted', 'running')`,
        sql`${jobs.deadlineAt} is not null and ${jobs.deadlineAt} < now()`,
      ),
    )
    .limit(20);
  for (const job of expired) {
    await transitionJob(job.id, "failed", {
      errorMessage: "deadline_exceeded",
    });
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[job-monitor] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
