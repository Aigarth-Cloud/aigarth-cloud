/**
 * Compute service client (Phase 19C.4).
 *
 * Two implementations:
 *   - `StubComputeClient` — in-process simulation. Used in dev/tests.
 *   - `HttpComputeClient`  — calls the real services/compute HTTP API.
 *
 * The factory in `getComputeClient()` picks one based on
 * TRAINING_COMPUTE_MODE. Both share the same `ComputeClient`
 * interface so the bridge is mode-agnostic.
 */

import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/index.js";

// ---------- Shared types ----------

export interface ComputeJobHandle {
  id: string;
  status: "queued" | "submitted" | "running" | "completed" | "failed" | "cancelled";
  txHash?: string;
}

export interface ComputeJobResult {
  id: string;
  status: "queued" | "submitted" | "running" | "completed" | "failed" | "cancelled";
  result?: Record<string, unknown>;
  error?: string;
}

export interface SubmitComputeInput {
  type: "training";
  payload: Record<string, unknown>;
  /** Cross-service ref to the user who kicked off the training. */
  userId: string;
  /** Optional priority 0..10. */
  priority?: number;
}

export interface ComputeClient {
  readonly mode: "stub" | "http";
  submitJob(input: SubmitComputeInput): Promise<ComputeJobHandle>;
  getJob(id: string): Promise<ComputeJobResult>;
  cancelJob(id: string): Promise<void>;
}

// ---------- StubComputeClient ----------

/**
 * In-process simulation. Each submitted job advances through
 * queued -> submitted -> running -> completed on a randomized
 * schedule (50-500ms per transition). This is what `pnpm dev`
 * uses by default, and what the unit tests target.
 */
export class StubComputeClient implements ComputeClient {
  readonly mode = "stub" as const;

  /**
   * In-memory store. Keyed by job id. Each entry tracks the
   * current state + the list of pending timers so tests can
   * flush them deterministically.
   */
  private jobs = new Map<
    string,
    {
      state: ComputeJobHandle["status"];
      txHash?: string;
      result?: Record<string, unknown>;
      error?: string;
      input: SubmitComputeInput;
    }
  >();
  private timers = new Set<NodeJS.Timeout>();

  async submitJob(input: SubmitComputeInput): Promise<ComputeJobHandle> {
    const id = randomUUID();
    const handle: ComputeJobHandle = { id, status: "queued" };
    this.jobs.set(id, { state: "queued", input });
    logTransition("submitJob", id, "queued", input);
    // Advance through submitted -> running -> completed with
    // random delays. Each step is a separate timer so the
    // worker can interleave with progress publishing.
    this.scheduleTransition(id, "submitted", { txHash: `0xstub${id.slice(0, 8)}` }, 50);
    this.scheduleTransition(id, "running", undefined, 50 + this.randMs(50, 500));
    this.scheduleTransition(
      id,
      "completed",
      {
        result: {
          ok: true,
          loss: 0.1,
          accuracy: 0.92,
          val_loss: 0.15,
          val_accuracy: 0.89,
          epochs_completed: 10,
        },
      },
      50 + this.randMs(50, 500) * 2,
    );
    return handle;
  }

  async getJob(id: string): Promise<ComputeJobResult> {
    const job = this.jobs.get(id);
    if (!job) return { id, status: "failed", error: "not_found" };
    return {
      id,
      status: job.state,
      result: job.result,
      error: job.error,
    };
  }

  async cancelJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.state === "completed" || job.state === "failed" || job.state === "cancelled") return;
    job.state = "cancelled";
    logTransition("cancelJob", id, "cancelled", undefined);
  }

  /**
   * Synchronously advance every pending timer. Used by tests
   * that don't want to wait the full ~600ms transition window.
   * Calling this from production code is a no-op (it just lets
   * the timers fire naturally).
   */
  flushTimers(): void {
    for (const t of this.timers) {
      clearTimeout(t);
      // We can't synchronously call the callback from here
      // because setTimeout semantics don't allow that, so we
      // expose a separate `tick()` below that the test can drive.
    }
    this.timers.clear();
  }

  /**
   * Test-only: drive every pending transition to completion
   * synchronously by fast-forwarding all timers to fire
   * immediately.
   */
  async tickAll(): Promise<void> {
    const pending = Array.from(this.timers);
    this.timers.clear();
    for (const t of pending) {
      clearTimeout(t);
    }
    // Replay transitions: walk each job forward in order until
    // it reaches a terminal state. We only have three
    // transitions queued at submit time, so a fixed loop is fine.
    for (const [, job] of this.jobs) {
      // If the job is still in a non-terminal state, finalize
      // it now. (Timers were just cleared; their work didn't
      // run.)
      if (job.state === "queued") {
        job.state = "submitted";
        job.txHash = `0xstub${job.input.priority ?? 5}`;
        logTransition("tickAll", "id", "submitted", undefined);
      }
      if (job.state === "submitted") {
        job.state = "running";
        logTransition("tickAll", "id", "running", undefined);
      }
      if (job.state === "running") {
        job.state = "completed";
        job.result = {
          ok: true,
          loss: 0.1,
          accuracy: 0.92,
          val_loss: 0.15,
          val_accuracy: 0.89,
          epochs_completed: 10,
        };
        logTransition("tickAll", "id", "completed", undefined);
      }
    }
  }

  private scheduleTransition(
    id: string,
    nextState: ComputeJobHandle["status"],
    patch: { txHash?: string; result?: Record<string, unknown> } | undefined,
    delayMs: number,
  ): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      const job = this.jobs.get(id);
      if (!job) return;
      // Don't transition a job that's been cancelled.
      if (job.state === "cancelled" || job.state === "completed" || job.state === "failed") return;
      job.state = nextState;
      if (patch?.txHash) job.txHash = patch.txHash;
      if (patch?.result) job.result = patch.result;
      logTransition("scheduleTransition", id, nextState, patch);
    }, delayMs);
    this.timers.add(t);
  }

  private randMs(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min));
  }
}

function logTransition(
  fn: string,
  id: string,
  status: string,
  _extra: unknown,
): void {
  // eslint-disable-next-line no-console
  console.log(`[compute:stub] ${fn} id=${id} status=${status}`);
}

// ---------- HttpComputeClient ----------

/**
 * HTTP client for the real services/compute. Authenticated with
 * COMPUTE_INTERNAL_TOKEN; the compute service is expected to
 * have an internal-token allowlist for cross-service calls.
 */
export class HttpComputeClient implements ComputeClient {
  readonly mode = "http" as const;
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`compute ${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  }

  async submitJob(input: SubmitComputeInput): Promise<ComputeJobHandle> {
    const data = await this.request<{ id: string; status: ComputeJobHandle["status"]; tx_hash?: string }>(
      "/v1/compute/jobs",
      { method: "POST", body: JSON.stringify(input) },
    );
    return { id: data.id, status: data.status, txHash: data.tx_hash };
  }

  async getJob(id: string): Promise<ComputeJobResult> {
    const data = await this.request<{ id: string; status: ComputeJobResult["status"]; result?: Record<string, unknown>; error?: string }>(
      `/v1/compute/jobs/${encodeURIComponent(id)}`,
    );
    return { id: data.id, status: data.status, result: data.result, error: data.error };
  }

  async cancelJob(id: string): Promise<void> {
    await this.request(`/v1/compute/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
  }
}

// ---------- Factory ----------

let cached: ComputeClient | null = null;

export function getComputeClient(): ComputeClient {
  if (cached) return cached;
  const cfg = loadConfig();
  if (cfg.TRAINING_COMPUTE_MODE === "http") {
    cached = new HttpComputeClient(cfg.COMPUTE_BASE_URL, cfg.COMPUTE_INTERNAL_TOKEN);
  } else {
    cached = new StubComputeClient();
  }
  return cached;
}

/** Test-only: clear the cached client so a new factory call rebuilds. */
export function __resetComputeClientForTests(): void {
  cached = null;
}
