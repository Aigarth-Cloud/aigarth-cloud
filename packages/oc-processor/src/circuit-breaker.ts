/**
 * Circuit breaker (ADR 007 §6.2).
 *
 *   CLOSED   — normal. All invocations proceed.
 *   OPEN     — paused. All invocations rejected with PROCESSOR_PAUSED.
 *              Triggered by error rate > 25% over any 5-min window, OR
 *              a manual `pause()` call by the Aigarth OC operator.
 *   HALF_OPEN — probe. After 10 minutes OPEN, allow 1 invocation.
 *              If it succeeds, → CLOSED. If it fails, → OPEN for
 *              another 10 minutes.
 *
 * The breaker is per-processor (one breaker per registered
 * processor id). The state is process-local; a restart of the
 * processor defaults to CLOSED. A future change can persist
 * the state to services/work (the `oc_processor_breaker` table
 * mentioned in ADR 007 §6.2).
 */

export type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** Error-rate threshold to trip CLOSED → OPEN. Default 0.25. */
  errorRateThreshold: number;
  /** Sliding window in ms. Default 5 * 60_000. */
  windowMs: number;
  /** Minimum invocations in the window before the rate can trip. Default 10. */
  minSamples: number;
  /** How long OPEN before HALF_OPEN. Default 10 * 60_000. */
  openDurationMs: number;
}

export const DEFAULT_BREAKER: CircuitBreakerConfig = {
  errorRateThreshold: 0.25,
  windowMs: 5 * 60_000,
  minSamples: 10,
  openDurationMs: 10 * 60_000,
};

interface Sample {
  ok: boolean;
  atMs: number;
}

export class CircuitBreaker {
  private state: BreakerState = "CLOSED";
  private openedAtMs = 0;
  private samples: Sample[] = [];
  private readonly cfg: CircuitBreakerConfig;

  constructor(cfg: Partial<CircuitBreakerConfig> = {}) {
    this.cfg = { ...DEFAULT_BREAKER, ...cfg };
  }

  /** Decide whether the next invocation is allowed. */
  allow(nowMs: number): boolean {
    if (this.state === "CLOSED") return true;
    if (this.state === "OPEN") {
      if (nowMs - this.openedAtMs >= this.cfg.openDurationMs) {
        this.state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    // HALF_OPEN: allow exactly one probe.
    return true;
  }

  /** Record a successful invocation. */
  recordSuccess(nowMs: number): void {
    this.samples.push({ ok: true, atMs: nowMs });
    this.evict(nowMs);
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      return;
    }
    // The error-rate trip fires after *any* record once the window
    // has enough samples — the trip decision is independent of
    // whether this particular record was a success or a failure.
    if (this.state === "CLOSED" && this.shouldTrip()) {
      this.state = "OPEN";
      this.openedAtMs = nowMs;
    }
  }

  /** Record a failed invocation. */
  recordFailure(nowMs: number): void {
    this.samples.push({ ok: false, atMs: nowMs });
    this.evict(nowMs);
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openedAtMs = nowMs;
      return;
    }
    if (this.state === "CLOSED" && this.shouldTrip()) {
      this.state = "OPEN";
      this.openedAtMs = nowMs;
    }
  }

  /** Manual pause by the OC operator. */
  pause(nowMs: number): void {
    this.state = "OPEN";
    this.openedAtMs = nowMs;
  }

  /** Manual resume. The next invocation transitions to HALF_OPEN. */
  resume(): void {
    this.state = "HALF_OPEN";
  }

  /** Read-only state for dashboards. */
  snapshot(nowMs: number): { state: BreakerState; openedAtMs: number; samples: number; errorRate: number } {
    this.evict(nowMs);
    const total = this.samples.length;
    const errors = this.samples.filter((s) => !s.ok).length;
    return {
      state: this.state,
      openedAtMs: this.openedAtMs,
      samples: total,
      errorRate: total === 0 ? 0 : errors / total,
    };
  }

  /** Test-only. */
  __reset(): void {
    this.state = "CLOSED";
    this.openedAtMs = 0;
    this.samples = [];
  }

  private shouldTrip(): boolean {
    if (this.samples.length < this.cfg.minSamples) return false;
    const errors = this.samples.filter((s) => !s.ok).length;
    const rate = errors / this.samples.length;
    return rate >= this.cfg.errorRateThreshold;
  }

  private evict(nowMs: number): void {
    const cutoff = nowMs - this.cfg.windowMs;
    this.samples = this.samples.filter((s) => s.atMs >= cutoff);
  }
}
