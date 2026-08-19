/**
 * Phase 19D.2 — auto-retrain cron loop.
 *
 * A simple `setInterval` that calls `runRetrainScan()` on a fixed
 * interval. The interval + on/off switch come from config:
 *
 *   RETRAIN_SCAN_ENABLED     — default true in production, false in tests
 *   RETRAIN_SCAN_INTERVAL_MS — default 6 hours
 *
 * The cron does not throw out — errors are logged and the next tick
 * runs anyway. The ann service is the source of truth for retrain
 * state; a missed scan just delays the next trigger attempt.
 *
 * ----------------------------------------------------------------------
 * ADR 005 §10 / ADR 008 F3 — organism-event guardrail
 * ----------------------------------------------------------------------
 * The cron (and any future event-driven path) MUST NOT trigger a
 * weight retrain for an `organism_*` event. An organism mutation is
 * a *genome change*, not a model-weights retrain. Mistaking an
 * `organism_fitness_history` row insert for an `ann_decision_outcomes`
 * event would burn compute enqueuing a retrain job that has no
 * semantically meaningful effect on the organism.
 *
 * The guard sits at the consumer side (`runRetrainScanForEvent`
 * below). The regex `^organism_` is anchored at the start so any
 * *future* `organism_*` event kind is caught without code changes.
 * The producer side (the Organism service) does not need to know
 * about `services/training` — the consumer enforces the contract.
 */

import { loadConfig } from "../config/index.js";
import { runRetrainScan, type RetrainScanResult } from "../services/retrainTrigger.js";

/**
 * Minimal event shape the guard checks. The full event payload may
 * carry more fields; only `kind` and `id` are required by the guard.
 * The Organism service emits events whose `kind` is one of
 * `organism_fitness`, `organism_mutation`, `organism_memory_write`,
 * `organism_lineage`, etc. — all of those match the regex below.
 */
export interface RetrainEvent {
  id?: string;
  kind?: string;
  /** Free-form event payload; ignored by the guard. */
  payload?: unknown;
}

let timer: NodeJS.Timeout | null = null;

/**
 * Event-driven entry point for a single retrain-trigger event.
 *
 * This is the *guard* called by any future code path that wants to
 * respond to "model got worse" events. The interval-based cron
 * (`startRetrainCron` below) still calls `runRetrainScan()` directly
 * because it has no single event to guard — the interval is the
 * "all events" scan, which is ANN-only by construction.
 *
 * Hard guardrail (ADR 005 §10 / ADR 008 F3): if the event's `kind`
 * starts with `organism_`, do NOT call into the ann service and do
 * NOT enqueue a retrain job. The event is a *genome* change, not a
 * model-weights retrain — a retrain job would be wasted compute and
 * would never produce a meaningful update to the organism. Log a
 * warning so the next maintainer can see *why* the event was skipped.
 *
 * For any other event kind (or when `kind` is absent), delegate to
 * the standard `runRetrainScan()` call. The ann service owns the
 * trigger logic; the training service is the cron caller.
 */
export async function runRetrainScanForEvent(
  event: RetrainEvent,
): Promise<RetrainScanResult> {
  const kind = event.kind;
  if (typeof kind === "string" && kind.match(/^organism_/)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[retrain-cron] skipping organism event id=${event.id ?? "<unknown>"} ` +
        `kind=${kind} — organism events do not trigger weight retrain ` +
        `(organism mutations are genome changes, not model retrains; ` +
        `see ADR 005 §10 / ADR 008 F3)`,
    );
    return { scanned: 0, triggered: 0, skipped: 1, errors: 0 };
  }
  return runRetrainScan();
}

export function startRetrainCron(): void {
  const cfg = loadConfig();
  if (!cfg.RETRAIN_SCAN_ENABLED) {
    // eslint-disable-next-line no-console
    console.log("[retrain-cron] disabled (RETRAIN_SCAN_ENABLED=false)");
    return;
  }
  // eslint-disable-next-line no-console
  console.log(
    `[retrain-cron] starting, interval=${cfg.RETRAIN_SCAN_INTERVAL_MS}ms ` +
      `target=${cfg.TRAINING_ANN_BASE_URL}/v1/internal/anns/retrain-scan`,
  );
  const tick = async () => {
    try {
      const result = await runRetrainScan();
      // eslint-disable-next-line no-console
      console.log(
        `[retrain-cron] scan complete: scanned=${result.scanned} ` +
          `triggered=${result.triggered} skipped=${result.skipped} ` +
          `errors=${result.errors}`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[retrain-cron] scan failed:`, err);
    }
  };
  // Run once on start so devs don't have to wait the full interval.
  void tick();
  timer = setInterval(() => {
    void tick();
  }, cfg.RETRAIN_SCAN_INTERVAL_MS);
}

export function stopRetrainCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
