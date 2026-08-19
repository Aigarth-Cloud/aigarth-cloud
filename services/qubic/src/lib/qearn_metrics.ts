/**
 * Qearn business metrics — Phase 13.1.
 *
 * Exposes a gauge on the qubic service's `/metrics` endpoint that
 * reports the count of Qearn events observed, grouped by kind
 * (`lock`, `unlock`, `yield`, `other`). The Qearn watcher (a
 * separate process) writes events to the `qubic_qearn_events`
 * table; this module reads the counts back on demand.
 *
 * Update strategy: lazy — the gauge is set on each `/metrics`
 * scrape (best-effort; failures are silent because metrics must
 * never break the request path). The gauge is also refreshed
 * once on startup so the initial value is correct.
 *
 * Cross-process note: the watcher (services/qubic/src/workers/
 * qearn-watcher.ts) is a separate process. A future v2 can use
 * NATS to push live updates to the qubic service; for v1 a DB
 * read on scrape is good enough and stays consistent because
 * the watcher commits to the DB on every event.
 */

import { sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Gauge, Registry } from "@aigarth/observability";
import { getDb } from "../db/index.js";
import { qubicQearnEvents } from "../db/schema.js";

const KNOWN_KINDS = ["lock", "unlock", "yield", "other"] as const;
type QearnKind = (typeof KNOWN_KINDS)[number];

export interface QearnMetricsHandle {
  /** Refresh the gauge from the database. Safe to call repeatedly. */
  refresh: () => Promise<void>;
}

export function registerQearnMetrics(
  registry: Registry,
  log: FastifyBaseLogger,
): QearnMetricsHandle {
  const gauge = registry.registerGauge({
    name: "qubic_qearn_events_observed_total",
    help: "Count of Qearn events observed by the watcher, grouped by kind. Sourced from the qubic_qearn_events mirror table on each scrape.",
    labelNames: ["kind"],
  });

  // Initialise all known kinds to 0 so Grafana queries don't show
  // gaps for unseen kinds.
  for (const kind of KNOWN_KINDS) gauge.set({ kind }, 0);

  const refresh = async (): Promise<void> => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          kind: qubicQearnEvents.kind,
          count: sql<string>`COUNT(*)::text`,
        })
        .from(qubicQearnEvents)
        .groupBy(qubicQearnEvents.kind);
      // Reset known kinds to the DB count; leave any unknown kinds
      // untouched. (The enum is fixed; the only "unknown" kind is
      // `other` which is always present in the enum.)
      for (const r of rows) {
        const k = String(r.kind) as QearnKind;
        const c = Number(r.count);
        if (Number.isFinite(c)) {
          gauge.set({ kind: k }, c);
        }
      }
    } catch (err) {
      // Metrics must never break a scrape; log and move on.
      log.debug({ err: (err as Error).message }, "qearn_metrics: refresh failed (DB likely unavailable)");
    }
  };

  // Best-effort initial refresh. Failure is non-fatal.
  refresh().catch(() => {
    /* already logged */
  });

  return { refresh };
}
