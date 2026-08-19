/**
 * Accountant + cost calculation unit tests.
 */

import { describe, it, expect } from "vitest";
import { estimateWorkCost, WorkUsageEventSchema } from "../types/billing.js";

describe("estimateWorkCost (v1 formula: base + replicas * replica)", () => {
  it("computes base + replica * replicas for 3 replicas (default)", () => {
    const cost = estimateWorkCost(3);
    // base 100 + replica 50 * 3 = 250
    expect(cost).toBe(BigInt(250));
  });

  it("respects custom base + replica costs", () => {
    const cost = estimateWorkCost(5, { baseCostQubit: 200, replicaCostQubit: 30 });
    // 200 + 30 * 5 = 350
    expect(cost).toBe(BigInt(350));
  });

  it("works for 1 replica", () => {
    const cost = estimateWorkCost(1);
    expect(cost).toBe(BigInt(150)); // 100 + 50
  });
});

describe("WorkUsageEventSchema", () => {
  it("accepts a valid event", () => {
    const r = WorkUsageEventSchema.safeParse({
      userId: "user_001",
      workId: "wki_" + "0".repeat(26),
      workType: "trinary_decision",
      algorithmVersion: "v1.0.0",
      costQubic: "1000",
      replicas: 3,
      verificationMethod: "replication",
      replicasAgreed: "3/3",
      workerId: "wrk_" + "A".repeat(26),
      requestId: "req-1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid workId", () => {
    const r = WorkUsageEventSchema.safeParse({
      userId: "user_001",
      workId: "not-a-work-id",
      workType: "trinary_decision",
      algorithmVersion: "v1.0.0",
      costQubic: "1000",
      replicas: 3,
      verificationMethod: "replication",
      replicasAgreed: "3/3",
      workerId: "wrk_" + "A".repeat(26),
      requestId: "req-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a workType not in the v1 enum", () => {
    const r = WorkUsageEventSchema.safeParse({
      userId: "user_001",
      workId: "wki_" + "0".repeat(26),
      workType: "not_a_real_type",
      algorithmVersion: "v1.0.0",
      costQubic: "1000",
      replicas: 3,
      verificationMethod: "replication",
      replicasAgreed: "3/3",
      workerId: "wrk_" + "A".repeat(26),
      requestId: "req-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects tee/zk verification methods (deferred per ADR 006 §6)", () => {
    const r = WorkUsageEventSchema.safeParse({
      userId: "user_001",
      workId: "wki_" + "0".repeat(26),
      workType: "trinary_decision",
      algorithmVersion: "v1.0.0",
      costQubic: "1000",
      replicas: 3,
      verificationMethod: "tee",
      replicasAgreed: "3/3",
      workerId: "wrk_" + "A".repeat(26),
      requestId: "req-1",
    });
    expect(r.success).toBe(false);
  });
});
