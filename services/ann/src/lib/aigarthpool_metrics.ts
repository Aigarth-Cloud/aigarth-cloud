/**
 * AigarthPool business metrics — Phase 13.1.
 *
 * Exposes a handful of gauges + counters on the ann service's
 * `/metrics` endpoint, sourced from the AigarthPool client (which is
 * either the in-process simulator or the real QPI client). The
 * metrics:
 *
 *   aigarthpool_total_staked_qubic          gauge   sum of active position principals (Qu-bit)
 *   aigarthpool_total_positions             gauge   count of active positions
 *   aigarthpool_paused                      gauge   0 or 1 — pool pause state
 *   aigarthpool_yield_paid_total_qubic      counter cumulative yield distributed (Qu-bit)
 *   aigarthpool_events_total{kind}          counter count of events emitted
 *
 * Update strategy: subscribe to the pool's event feed at server
 * startup. On every event we update the relevant gauges/counters.
 * The pool's `getTotals()` is also called once on startup so the
 * metrics are correct even before the first event.
 *
 * Precision note: the Prometheus exporter stores values as JS
 * `number`. Qu-bit amounts up to ~9e15 (Number.MAX_SAFE_INTEGER)
 * are represented exactly. Anything larger rounds to the nearest
 * 2. For Phase 13 v1 this is acceptable — the AigarthPool's
 * per-tx cap is 1M QUBIC (1e12 Qu-bit) and the per-user-per-epoch
 * cap is 5M QUBIC (5e12 Qu-bit), so totals stay well within the
 * safe range for any realistic pool size.
 */

import type { FastifyBaseLogger } from "fastify";
import { Counter, Gauge, type Registry } from "@aigarth/observability";
import {
  type AigarthPoolClient,
  type AigarthPoolEvent,
} from "@aigarth/aigarthpool";
import { getAigarthPool } from "../services/aigarthpool.js";

export interface AigarthPoolMetricsHandle {
  /** Unsubscribe from pool events and stop updating metrics. */
  dispose: () => void;
}

const toNumber = (n: bigint | number): number => {
  if (typeof n === "number") return n;
  // Round to the nearest integer; Prometheus counts are integers.
  return Number(n);
};

export function registerAigarthPoolMetrics(
  registry: Registry,
  log: FastifyBaseLogger,
): AigarthPoolMetricsHandle {
  const totalStakedGauge = registry.registerGauge({
    name: "aigarthpool_total_staked_qubic",
    help: "Sum of principal across all active positions in the AigarthPool, in Qu-bit.",
    labelNames: [],
  });
  const totalPositionsGauge = registry.registerGauge({
    name: "aigarthpool_total_positions",
    help: "Number of currently active positions in the AigarthPool.",
    labelNames: [],
  });
  const pausedGauge = registry.registerGauge({
    name: "aigarthpool_paused",
    help: "1 if the AigarthPool is paused (M4 circuit breaker), 0 otherwise.",
    labelNames: [],
  });
  const yieldPaidCounter = registry.registerCounter({
    name: "aigarthpool_yield_paid_total_qubic",
    help: "Cumulative Qearn yield distributed to position holders, in Qu-bit.",
    labelNames: [],
  });
  const eventsCounter = registry.registerCounter({
    name: "aigarthpool_events_total",
    help: "Count of AigarthPool events emitted by kind.",
    labelNames: ["kind"],
  });

  const pool: AigarthPoolClient = getAigarthPool();

  // Best-effort initial sync from getTotals + isPaused. The simulator
  // supports these; the real QPI client (Phase 20.6) will return
  // nulls / 0s until AIO is wired, which is fine.
  (async () => {
    try {
      const totals = await pool.getTotals();
      totalStakedGauge.set(toNumber(totals.totalStaked));
      totalPositionsGauge.set(totals.totalPositions);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "aigarthpool_metrics: initial getTotals failed");
    }
    try {
      const paused = await pool.isPaused();
      pausedGauge.set(paused ? 1 : 0);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "aigarthpool_metrics: initial isPaused failed");
    }
  })().catch(() => {
    /* swallow — already logged */
  });

  // Subscribe to the event feed. The simulator pushes events
  // synchronously; the real client will deliver them as they come
  // off the Qubic event log.
  const unsubscribe = pool.subscribe((event: AigarthPoolEvent) => {
    eventsCounter.inc({ kind: event.kind });
    switch (event.kind) {
      case "PositionOpened": {
        const e = event as { amount: bigint };
        totalStakedGauge.set(totalStakedGauge.get({}) + toNumber(e.amount));
        totalPositionsGauge.set(totalPositionsGauge.get({}) + 1);
        break;
      }
      case "PositionClosed": {
        // The principal returns to the user; the yield gets split.
        // Net pool value change = -principal + (yieldToUser +
        // yieldToCreator + yieldToTreasury) = 0; the yield counter
        // tracks the total yield distributed.
        const e = event as { principal: bigint; yieldAmount: bigint };
        totalStakedGauge.set(Math.max(0, totalStakedGauge.get({}) - toNumber(e.principal)));
        totalPositionsGauge.set(Math.max(0, totalPositionsGauge.get({}) - 1));
        yieldPaidCounter.inc({}, toNumber(e.yieldAmount));
        break;
      }
      case "RewardsClaimed": {
        const e = event as { yieldPaid: bigint };
        yieldPaidCounter.inc({}, toNumber(e.yieldPaid));
        break;
      }
      case "PoolPaused":
        pausedGauge.set(1);
        break;
      case "PoolUnpaused":
        pausedGauge.set(0);
        break;
      // SplitsChanged, TreasuryTransfer*, SignerChange* — no
      // aggregate change to the staked/position totals; the events
      // counter is already bumped above.
      default:
        break;
    }
  });

  return {
    dispose: () => {
      unsubscribe();
    },
  };
}
