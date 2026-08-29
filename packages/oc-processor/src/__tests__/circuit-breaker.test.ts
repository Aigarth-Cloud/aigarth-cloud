import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "../circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("starts in CLOSED and allows all calls", () => {
    const cb = new CircuitBreaker({ minSamples: 5, errorRateThreshold: 0.3, windowMs: 60_000 });
    expect(cb.allow(0)).toBe(true);
    expect(cb.snapshot(0).state).toBe("CLOSED");
  });

  it("trips to OPEN when error rate exceeds the threshold", () => {
    const cb = new CircuitBreaker({ minSamples: 4, errorRateThreshold: 0.5, windowMs: 60_000 });
    cb.recordFailure(0);
    cb.recordFailure(0);
    cb.recordSuccess(0);
    cb.recordSuccess(0);
    // 2 of 4 errors = 50%, exactly the threshold. shouldTrip returns true.
    expect(cb.snapshot(0).state).toBe("OPEN");
    expect(cb.allow(0)).toBe(false);
  });

  it("transitions to HALF_OPEN after openDurationMs", () => {
    const cb = new CircuitBreaker({ minSamples: 1, errorRateThreshold: 0.1, openDurationMs: 100 });
    cb.recordFailure(0);
    expect(cb.allow(0)).toBe(false);
    expect(cb.allow(150).state === "HALF_OPEN" || cb.allow(150) === true).toBe(true);
  });

  it("HALF_OPEN → CLOSED on success", () => {
    const cb = new CircuitBreaker({ minSamples: 1, errorRateThreshold: 0.1, openDurationMs: 100 });
    cb.recordFailure(0);
    cb.allow(150); // transitions to HALF_OPEN
    cb.recordSuccess(150);
    expect(cb.snapshot(150).state).toBe("CLOSED");
  });

  it("HALF_OPEN → OPEN on failure", () => {
    const cb = new CircuitBreaker({ minSamples: 1, errorRateThreshold: 0.1, openDurationMs: 100 });
    cb.recordFailure(0);
    cb.allow(150); // → HALF_OPEN
    cb.recordFailure(150);
    expect(cb.snapshot(150).state).toBe("OPEN");
  });

  it("manual pause + resume", () => {
    const cb = new CircuitBreaker();
    cb.pause(0);
    expect(cb.snapshot(0).state).toBe("OPEN");
    cb.resume();
    expect(cb.snapshot(0).state).toBe("HALF_OPEN");
  });
});
