/**
 * Work Runtime — global pool stats (AIGARTH-EVO-02).
 *
 *   Aggregates worker + run stats for the dashboard's "global
 *   contribution pool" widget. The widget renders:
 *     - workers grouped by kind (light = browser, dedicated = local/remote)
 *     - total evaluations in the last hour / last 24h
 *     - per-environment evaluation totals (which fitness envs are hot)
 *     - top contributing workers (by completed results in window)
 *
 *   The query layer is pure SQL via Drizzle — no application-side
 *   aggregation. Read-mostly; safe to hit every 10s from the
 *   dashboard's auto-refresh.
 */

import { sql, and, eq, gte, desc, count } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { workers, workItems, workResults } from "../db/schema.js";

export interface PoolWorkerCount {
  kind: "local" | "remote" | "browser" | "oc-processor" | "neuraxon" | "human-via-oracle";
  total: number;
  active: number;
}

export interface PoolEnvironmentCount {
  environment: string; // algorithm_name
  evaluations: number;
  workers: number;
}

export interface PoolTopWorker {
  worker_id: string;
  kind: PoolWorkerCount["kind"];
  location: string;
  completed: number;
  reputation: number;
}

export interface PoolStats {
  /** ISO timestamp of when the stats were computed. */
  computed_at: string;
  /** Workers grouped by kind. */
  workers_by_kind: PoolWorkerCount[];
  /** Total evaluations completed in the trailing hour. */
  evals_last_hour: number;
  /** Total evaluations completed in the trailing 24h. */
  evals_last_day: number;
  /** Currently-running items (any kind). */
  running_items: number;
  /** Currently-queued items. */
  queued_items: number;
  /** Per-algorithm evaluation counts (which fitness envs are hot). */
  per_environment: PoolEnvironmentCount[];
  /** Top contributing workers by completed results in last hour. */
  top_workers: PoolTopWorker[];
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export async function poolStats(): Promise<PoolStats> {
  const db = getDb();
  const now = new Date();
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);

  // Workers by kind + status.
  const workerRows = await db
    .select({
      kind: workers.kind,
      status: workers.status,
      value: count(),
    })
    .from(workers)
    .groupBy(workers.kind, workers.status);

  const byKind = new Map<PoolWorkerCount["kind"], { total: number; active: number }>();
  for (const r of workerRows) {
    const k = r.kind as PoolWorkerCount["kind"];
    const cur = byKind.get(k) ?? { total: 0, active: 0 };
    cur.total += Number(r.value);
    if (r.status === "active") cur.active += Number(r.value);
    byKind.set(k, cur);
  }
  const workersByKind: PoolWorkerCount[] = Array.from(byKind.entries()).map(([kind, v]) => ({
    kind,
    total: v.total,
    active: v.active,
  }));

  // Evals last hour + last 24h (submitted results).
  const [hourRow] = await db
    .select({ value: count() })
    .from(workResults)
    .where(
      and(
        eq(workResults.status, "submitted"),
        gte(workResults.submittedAt, hourAgo),
      ),
    );
  const [dayRow] = await db
    .select({ value: count() })
    .from(workResults)
    .where(
      and(
        eq(workResults.status, "submitted"),
        gte(workResults.submittedAt, dayAgo),
      ),
    );

  // Currently running + queued items.
  const [runningRow] = await db
    .select({ value: count() })
    .from(workItems)
    .where(eq(workItems.status, "running"));
  const [queuedRow] = await db
    .select({ value: count() })
    .from(workItems)
    .where(eq(workItems.status, "queued"));

  // Per-algorithm evaluation counts in last 24h.
  const envRows = await db.execute<{ algorithm_name: string; evaluations: string }>(sql`
    SELECT algorithm_name, COUNT(*)::text AS evaluations
      FROM work_items
     WHERE status IN ('verified', 'running')
       AND created_at >= ${dayAgo}
     GROUP BY algorithm_name
     ORDER BY evaluations DESC
     LIMIT 20
  `);
  const perEnvironment: PoolEnvironmentCount[] = envRows.rows.map((r) => ({
    environment: r.algorithm_name,
    evaluations: Number(r.evaluations),
    workers: 0, // workers per env isn't tracked in this view; the dashboard can compute share by evals/total
  }));

  // Top contributing workers in the last hour (by submitted results).
  const topRows = await db.execute<{
    worker_id: string;
    kind: PoolWorkerCount["kind"];
    location: string;
    reputation: string;
    completed: string;
  }>(sql`
    SELECT w.worker_id,
           w.kind,
           w.location,
           w.reputation::text AS reputation,
           COUNT(*)::text AS completed
      FROM work_results r
      JOIN workers w ON w.worker_id = r.claimed_by
     WHERE r.status = 'submitted'
       AND r.submitted_at >= ${hourAgo}
       AND r.claimed_by IS NOT NULL
     GROUP BY w.worker_id, w.kind, w.location, w.reputation
     ORDER BY completed DESC
     LIMIT 10
  `);
  const topWorkers: PoolTopWorker[] = topRows.rows.map((r) => ({
    worker_id: r.worker_id,
    kind: r.kind,
    location: r.location,
    completed: Number(r.completed),
    reputation: Number(r.reputation),
  }));

  return {
    computed_at: now.toISOString(),
    workers_by_kind: workersByKind,
    evals_last_hour: Number(hourRow?.value ?? 0),
    evals_last_day: Number(dayRow?.value ?? 0),
    running_items: Number(runningRow?.value ?? 0),
    queued_items: Number(queuedRow?.value ?? 0),
    per_environment: perEnvironment,
    top_workers: topWorkers,
  };
}
