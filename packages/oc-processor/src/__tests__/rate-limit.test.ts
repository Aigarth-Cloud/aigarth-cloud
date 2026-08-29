import { describe, it, expect } from "vitest";
import { RateLimiter, DEFAULT_RATE_LIMIT } from "../rate-limit.js";

describe("RateLimiter", () => {
  it("allows up to the per-caller epoch cap", () => {
    const rl = new RateLimiter({ perCallerEpoch: 3, perCallerBurst: 100 });
    const a = rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    const b = rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    const c = rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    const d = rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(true);
    expect(d.allowed).toBe(false);
    expect(d.layer).toBe("caller");
  });

  it("rejects on the burst cap with retryAfterSec", () => {
    const rl = new RateLimiter({ perCallerBurst: 2, perCallerEpoch: 100, burstWindowMs: 60_000 });
    rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    const r = rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 1_000 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets the per-epoch counter on a new epoch", () => {
    const rl = new RateLimiter({ perCallerEpoch: 2, perCallerBurst: 100 });
    rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    expect(rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 }).allowed).toBe(false);
    expect(rl.check({ caller: "c1", processorId: "p1", epoch: 2, nowMs: 0 }).allowed).toBe(true);
  });

  it("respects the per-processor epoch cap", () => {
    const rl = new RateLimiter({ perProcessorEpoch: 2, perProcessorBurst: 100, perCallerEpoch: 100, perCallerBurst: 100 });
    rl.check({ caller: "c1", processorId: "p1", epoch: 1, nowMs: 0 });
    rl.check({ caller: "c2", processorId: "p1", epoch: 1, nowMs: 0 });
    const r = rl.check({ caller: "c3", processorId: "p1", epoch: 1, nowMs: 0 });
    expect(r.allowed).toBe(false);
    expect(r.layer).toBe("processor");
  });

  it("ships sensible defaults", () => {
    expect(DEFAULT_RATE_LIMIT.perCallerEpoch).toBe(10);
    expect(DEFAULT_RATE_LIMIT.perProcessorEpoch).toBe(1_000);
    expect(DEFAULT_RATE_LIMIT.perEpoch).toBe(5_000);
  });
});
