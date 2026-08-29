/**
 * Three-layer rate limit (ADR 007 §6.1).
 *
 *   per-caller   — keyed on the calling Qubic identity (the smart
 *                  contract's identity). Burst + epoch caps.
 *   per-processor — keyed on the Aigarth processor id. Burst + epoch caps.
 *   per-epoch    — single counter for all invocations across all
 *                  callers and processors in the current Qubic epoch.
 *
 * Defaults (per ADR 007 §6.1):
 *
 *   per-caller   epoch cap: 10  invocations / epoch
 *                burst cap:  3   in any 60s window
 *   per-processor epoch cap: 1_000 invocations / epoch
 *                burst cap:  100 in any 60s window
 *   per-epoch    epoch cap: 5_000 invocations / epoch
 *
 * The state is in-memory (a `Map<key, counter>`). The Qubic epoch
 * is a monotonic int supplied by the caller; the limiter resets
 * the per-epoch counters on a new epoch number.
 *
 * A separate ADR (BLOCKER, ADR 007 §13) is required to finalise the
 * policy. Phase 29 ships the *mechanism* with the default caps.
 */

export interface RateLimitConfig {
  /** Max invocations per Qubic epoch per caller identity. */
  perCallerEpoch: number;
  /** Max invocations in any 60s sliding window per caller. */
  perCallerBurst: number;
  /** Max invocations per Qubic epoch per processor id. */
  perProcessorEpoch: number;
  /** Max invocations in any 60s sliding window per processor. */
  perProcessorBurst: number;
  /** Max invocations per Qubic epoch across all callers + processors. */
  perEpoch: number;
  /** Burst window length in ms. Default 60_000. */
  burstWindowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  perCallerEpoch: 10,
  perCallerBurst: 3,
  perProcessorEpoch: 1_000,
  perProcessorBurst: 100,
  perEpoch: 5_000,
  burstWindowMs: 60_000,
};

interface Counter {
  epochCount: number;
  burstCount: number;
  burstStartMs: number;
  epoch: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  layer?: "caller" | "processor" | "epoch";
  retryAfterSec?: number;
}

export class RateLimiter {
  private readonly callers = new Map<string, Counter>();
  private readonly processors = new Map<string, Counter>();
  private epochCounter: Counter = this.fresh(0);
  private readonly cfg: RateLimitConfig;

  constructor(cfg: Partial<RateLimitConfig> = {}) {
    this.cfg = { ...DEFAULT_RATE_LIMIT, ...cfg };
  }

  /**
   * Check + increment. If allowed, all three counters are bumped.
   * If rejected, no counter is bumped (the next call is also a
   * retry).
   */
  check(args: { caller: string; processorId: string; epoch: number; nowMs: number }): RateLimitDecision {
    const callerC = this.bump(this.callers, args.caller, args.epoch, args.nowMs);
    if (callerC.burstCount > this.cfg.perCallerBurst) {
      return this.reject("caller", callerC, args.nowMs);
    }
    if (callerC.epochCount > this.cfg.perCallerEpoch) {
      return this.reject("caller", callerC, args.nowMs);
    }
    const procC = this.bump(this.processors, args.processorId, args.epoch, args.nowMs);
    if (procC.burstCount > this.cfg.perProcessorBurst) {
      return this.reject("processor", procC, args.nowMs);
    }
    if (procC.epochCount > this.cfg.perProcessorEpoch) {
      return this.reject("processor", procC, args.nowMs);
    }
    this.bumpEpoch(args.epoch, args.nowMs);
    if (this.epochCounter.epochCount > this.cfg.perEpoch) {
      return this.reject("epoch", this.epochCounter, args.nowMs);
    }
    return { allowed: true };
  }

  /** Test-only: reset all state. */
  __reset(): void {
    this.callers.clear();
    this.processors.clear();
    this.epochCounter = this.fresh(0);
  }

  private fresh(epoch: number): Counter {
    return { epochCount: 0, burstCount: 0, burstStartMs: 0, epoch };
  }

  private bump(map: Map<string, Counter>, key: string, epoch: number, nowMs: number): Counter {
    let c = map.get(key);
    if (!c || c.epoch !== epoch) {
      c = this.fresh(epoch);
      map.set(key, c);
    }
    // Reset the burst window only when it has actually elapsed.
    // The initial `burstStartMs = 0` from `fresh()` falls through
    // here on the first call (diff 0 < windowMs) so the window
    // starts when the first call lands; it does not get re-reset
    // on every call.
    if (nowMs - c.burstStartMs >= this.cfg.burstWindowMs) {
      c.burstStartMs = nowMs;
      c.burstCount = 0;
    }
    c.epochCount += 1;
    c.burstCount += 1;
    return c;
  }

  private bumpEpoch(epoch: number, nowMs: number): void {
    if (this.epochCounter.epoch !== epoch) {
      this.epochCounter = this.fresh(epoch);
    }
    if (nowMs - this.epochCounter.burstStartMs >= this.cfg.burstWindowMs) {
      this.epochCounter.burstStartMs = nowMs;
      this.epochCounter.burstCount = 0;
    }
    this.epochCounter.epochCount += 1;
    this.epochCounter.burstCount += 1;
  }

  private reject(layer: "caller" | "processor" | "epoch", c: Counter, nowMs: number): RateLimitDecision {
    const retryAfter = Math.max(1, Math.ceil((c.burstStartMs + this.cfg.burstWindowMs - nowMs) / 1000));
    return { allowed: false, layer, retryAfterSec: retryAfter };
  }
}
