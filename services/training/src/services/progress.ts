/**
 * Progress pub/sub (Phase 19C.5).
 *
 * The worker publishes progress events here; the SSE route
 * subscribes. The transport is NATS in production, falling
 * back to an in-process EventEmitter when NATS is unreachable
 * (so a single-instance dev/test setup still works).
 *
 * Subject shape: `${TRAINING_PROGRESS_SUBJECT}.<jobId>` —
 *   - `aigarth.training.progress.<jobId>` per job
 *
 * We connect lazily: the first `publish` or `subscribe` call
 * tries to connect to NATS; on failure we set `useInMemory = true`
 * and never retry. This keeps the worker simple and lets the
 * service boot in environments where NATS is not yet up.
 */

import { EventEmitter } from "node:events";
import { connect, type NatsConnection, type Subscription } from "nats";
import { loadConfig } from "../config/index.js";
import type { TrainingProgress, TrainingJobStatus } from "../db/schema.js";

// ---------- State ----------

let nc: NatsConnection | null = null;
let connectingPromise: Promise<NatsConnection | null> | null = null;
let useInMemory = false;
const memoryBus = new EventEmitter();

function subject(jobId: string): string {
  const cfg = loadConfigSafe();
  return `${cfg?.subject ?? "aigarth.training.progress"}.${jobId}`;
}

interface CfgShape {
  subject: string;
  url: string;
}
function loadConfigSafe(): CfgShape | null {
  try {
    const cfg = loadConfig();
    return { subject: cfg.TRAINING_PROGRESS_SUBJECT, url: cfg.NATS_URL };
  } catch {
    return null;
  }
}

// ---------- Connection ----------

async function ensureNatsConnection(): Promise<NatsConnection | null> {
  if (nc) return nc;
  if (useInMemory) return null;
  if (connectingPromise) return connectingPromise;
  const cfg = loadConfigSafe();
  if (!cfg) return null;
  connectingPromise = (async () => {
    try {
      const c = await connect({ servers: cfg.url, timeout: 1_000 });
      nc = c;
      // eslint-disable-next-line no-console
      console.log(`[progress] NATS connected at ${cfg.url}`);
      return c;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[progress] NATS unreachable (${err instanceof Error ? err.message : err}); using in-memory bus`,
      );
      useInMemory = true;
      return null;
    } finally {
      connectingPromise = null;
    }
  })();
  return connectingPromise;
}

// ---------- Publish ----------

/**
 * Publish a progress event. Returns immediately. Errors are
 * logged but never thrown — pub/sub is best-effort; the
 * source-of-truth is the DB row.
 */
export async function publishProgress(jobId: string, event: TrainingProgress): Promise<void> {
  const payload = JSON.stringify(event);
  const c = await ensureNatsConnection();
  if (c) {
    try {
      c.publish(subject(jobId), payload);
      // We don't await flush; the worker doesn't need back-pressure
      // on progress events.
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[progress] NATS publish failed:`, err);
      // Fall through to in-memory.
    }
  }
  if (useInMemory || !c) {
    memoryBus.emit("progress", { jobId, event });
    memoryBus.emit(`progress:${jobId}`, event);
  }
}

// ---------- Subscribe ----------

/**
 * Subscribe to progress events for a single job. Returns an
 * `unsubscribe()` function the caller must call on disconnect.
 */
export async function subscribeProgress(
  jobId: string,
  callback: (event: TrainingProgress) => void,
): Promise<() => void> {
  const c = await ensureNatsConnection();
  if (c && !useInMemory) {
    const sub: Subscription = c.subscribe(subject(jobId));
    const handler = (msg: { string(): string }) => {
      try {
        const parsed = JSON.parse(msg.string()) as TrainingProgress;
        callback(parsed);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[progress] bad message on ${subject(jobId)}:`, err);
      }
    };
    (async () => {
      for await (const msg of sub) handler(msg);
    })().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(`[progress] subscription loop ended:`, err);
    });
    return () => {
      try {
        sub.unsubscribe();
      } catch {
        /* already unsubscribed */
      }
    };
  }
  // In-memory fallback.
  const channel = `progress:${jobId}`;
  const listener = (event: TrainingProgress) => callback(event);
  memoryBus.on(channel, listener);
  return () => {
    memoryBus.off(channel, listener);
  };
}

// ---------- Test-only helpers ----------

/** Reset the global bus state so unit tests start clean. */
export function __resetProgressForTests(): void {
  memoryBus.removeAllListeners();
  if (nc) {
    try {
      void nc.close();
    } catch {
      /* ignore */
    }
  }
  nc = null;
  connectingPromise = null;
  useInMemory = false;
}

/** Force the in-memory transport for a test. */
export function __forceInMemoryProgress(): void {
  useInMemory = true;
}

/** Read the current transport mode for assertions. */
export function __getProgressMode(): "nats" | "in-memory" {
  return useInMemory || !nc ? "in-memory" : "nats";
}

/** Re-export for routes that need to know job-status union. */
export type { TrainingJobStatus };
