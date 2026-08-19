/**
 * Assignment worker (Task 8).
 *
 * Polls every SCHEDULER_TICK_MS (default 5s) and runs one
 * `schedulerTick()`. In a single-process deployment, this is
 * the only scheduler instance. The PEP §5 invariant 3 ("single
 * leader per Work Runtime deployment") is satisfied by the
 * single process.
 *
 * For Phase 28+ distributed deployments, the SELECT ... FOR
 * UPDATE SKIP LOCKED pattern (PEP §5 invariant 3) would replace
 * the in-process coordination.
 */

import { schedulerTick } from "../services/scheduler.js";
import { markStaleWorkersOffline } from "../services/workers.js";
import { loadConfig } from "../config/index.js";

let _interval: NodeJS.Timeout | null = null;

export function startAssignmentLoop(): void {
  if (_interval) return;
  const cfg = loadConfig();
  const tick = async () => {
    try {
      const stats = await schedulerTick(10);
      if (stats.assigned > 0 || stats.expired > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[work:assignment] scanned=${stats.scanned} assigned=${stats.assigned} expired=${stats.expired} eligible=${stats.eligibleWorkers}`,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[work:assignment] tick failed:", err);
    }
    // Sweep stale workers (offline if no heartbeat).
    try {
      const offlined = await markStaleWorkersOffline();
      if (offlined > 0) {
        // eslint-disable-next-line no-console
        console.log(`[work:assignment] marked ${offlined} workers offline`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[work:assignment] stale-worker sweep failed:", err);
    }
  };
  _interval = setInterval(() => {
    void tick();
  }, cfg.SCHEDULER_TICK_MS);
}

export function stopAssignmentLoop(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
}
