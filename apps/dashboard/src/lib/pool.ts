/**
 * Pool stats adapter — dashboard side.
 *
 *   Reads from /v1/work/pool on services/work (port 7012) and
 *   exposes a typed shape + a synthetic fallback so the UI is
 *   demoable without a live Work Runtime.
 *
 *   The synthetic fallback is only used when the Work Runtime
 *   reports an error. In production, the real pool stats win.
 *
 *   The adapter also tracks *local* stats (this tab's evaluations
 *   since the user opened the page) and computes share-of-pool
 *   as `local_evals / max(global_evals, 1)`.
 */

export type WorkerKind =
  | "local"
  | "remote"
  | "browser"
  | "oc-processor"
  | "neuraxon"
  | "human-via-oracle";

export interface PoolWorkerCount {
  kind: WorkerKind;
  total: number;
  active: number;
}

export interface PoolEnvironmentCount {
  environment: string;
  evaluations: number;
  workers: number;
}

export interface PoolTopWorker {
  worker_id: string;
  kind: WorkerKind;
  location: string;
  completed: number;
  reputation: number;
}

export interface PoolStats {
  computed_at: string;
  workers_by_kind: PoolWorkerCount[];
  evals_last_hour: number;
  evals_last_day: number;
  running_items: number;
  queued_items: number;
  per_environment: PoolEnvironmentCount[];
  top_workers: PoolTopWorker[];
}

/** Default work runtime URL for the dashboard's local dev environment. */
const DEFAULT_WORK_URL = "http://localhost:7012";

/**
 * Fetch pool stats from services/work. Throws on network failure;
 * callers fall back to `syntheticPoolStats()`.
 */
export async function fetchPoolStats(workUrl: string = DEFAULT_WORK_URL): Promise<PoolStats> {
  const res = await fetch(`${workUrl}/v1/work/pool`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`pool stats: HTTP ${res.status}`);
  }
  return (await res.json()) as PoolStats;
}

/**
 * Synthetic pool stats — used when the Work Runtime is unreachable
 * (no docker compose up, dashboard-only mode, etc.). The numbers
 * are seeded so the dashboard renders consistently during demos.
 */
export function syntheticPoolStats(now: Date = new Date()): PoolStats {
  return {
    computed_at: now.toISOString(),
    workers_by_kind: [
      { kind: "local", total: 4, active: 2 },
      { kind: "remote", total: 2, active: 1 },
      { kind: "browser", total: 12, active: 7 },
      { kind: "oc-processor", total: 1, active: 0 },
      { kind: "neuraxon", total: 0, active: 0 },
      { kind: "human-via-oracle", total: 0, active: 0 },
    ],
    evals_last_hour: 14_820,
    evals_last_day: 287_412,
    running_items: 9,
    queued_items: 14,
    per_environment: [
      { environment: "evo_step", evaluations: 192_004, workers: 11 },
      { environment: "awork_1", evaluations: 73_410, workers: 5 },
      { environment: "btc_direction_predictor", evaluations: 21_998, workers: 3 },
    ],
    top_workers: [
      { worker_id: "wrk_local_3f1a", kind: "local", location: "local", completed: 12_409, reputation: 0.94 },
      { worker_id: "wrk_browser_8e22", kind: "browser", location: "browser", completed: 4_201, reputation: 0.71 },
      { worker_id: "wrk_local_22c9", kind: "local", location: "local", completed: 3_902, reputation: 0.88 },
    ],
  };
}

/**
 * Compute "share of pool" for a single browser worker — i.e. this
 * tab's fraction of the global last-hour evaluations.
 *
 *   share = local_evals / max(global_evals, 1)
 *
 * Returns a number in [0, 1] that the UI renders as a percentage.
 */
export function shareOfPool(localEvals: number, globalEvals: number): number {
  if (globalEvals <= 0) return 0;
  return Math.min(1, localEvals / globalEvals);
}

/**
 * Count of *light* (browser) workers vs *dedicated* (local/remote/
 * oc-processor/neuraxon/human-via-oracle) workers in the pool.
 */
export function classifyWorkers(
  counts: ReadonlyArray<PoolWorkerCount>,
): { light: number; dedicated: number } {
  let light = 0;
  let dedicated = 0;
  for (const c of counts) {
    if (c.kind === "browser") light += c.active;
    else dedicated += c.active;
  }
  return { light, dedicated };
}
