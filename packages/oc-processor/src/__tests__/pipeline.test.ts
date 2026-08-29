/**
 * Integration test — full OC processor pipeline.
 *
 * Wires a registry, applies rate-limit + circuit-breaker, then
 * verifies the same handler failure trips the breaker and rejects
 * subsequent calls.
 */

import { describe, it, expect } from "vitest";
import {
  OcProcessorRegistry,
  OcErrorCode,
  RateLimiter,
  CircuitBreaker,
  messageHash,
  type QubicInvocation,
  type QubicComputorKey,
} from "../index.js";

function makeKeyMap(inv: QubicInvocation): Map<string, QubicComputorKey> {
  const m = new Map<string, QubicComputorKey>();
  inv.signatures.computors.forEach((c, i) => m.set(c, { computorIndex: i, publicKeyHex: "ab".repeat(32) }));
  return m;
}

function makeInvocation(overrides: Partial<QubicInvocation> = {}): QubicInvocation {
  const inv: QubicInvocation = {
    kind: "invocation",
    contract_index: 1,
    procedure: "x",
    caller: "a".repeat(64),
    payer: "b".repeat(64),
    fee_paid_qubit: "0",
    epoch: 1,
    nonce: "n",
    payload: {},
    signatures: {
      computors: Array.from({ length: 451 }, (_, i) => i.toString(16).padStart(64, "0")),
      sigs: Array.from({ length: 451 }, () => "deadbeef".repeat(8)),
      message_hash: "",
    },
    ...overrides,
  };
  inv.signatures.message_hash = messageHash(inv);
  return inv;
}

describe("OC pipeline", () => {
  it("applies the rate limit before reaching the handler", async () => {
    const reg = new OcProcessorRegistry();
    reg.register({
      manifest: { processor_id: "p", capabilities: ["x"], fee_qubic: "0", endpoint: "https://x", result_pubkey: "ab".repeat(32) },
      signingKey: { publicKeyHex: "ab".repeat(32), secret: "s" },
      rateLimit: { perCallerEpoch: 2, perCallerBurst: 100 },
      handler: async () => ({ status: "verified" as const, result: {} }),
      computorKeys: makeKeyMap(makeInvocation()),
    });
    const inv = makeInvocation();
    await reg.handle({ processorId: "p", invocation: inv });
    await reg.handle({ processorId: "p", invocation: inv });
    await expect(reg.handle({ processorId: "p", invocation: inv })).rejects.toMatchObject({
      code: OcErrorCode.RATE_LIMITED_CALLER,
    });
  });

  it("trips the circuit breaker on a run of handler failures", async () => {
    const reg = new OcProcessorRegistry();
    reg.register({
      manifest: { processor_id: "p", capabilities: ["x"], fee_qubic: "0", endpoint: "https://x", result_pubkey: "ab".repeat(32) },
      signingKey: { publicKeyHex: "ab".repeat(32), secret: "s" },
      circuitBreaker: { minSamples: 3, errorRateThreshold: 0.5, windowMs: 60_000, openDurationMs: 60_000 },
      handler: async () => {
        throw new Error("kaboom");
      },
      computorKeys: makeKeyMap(makeInvocation()),
    });
    // Force 3 different callers so the per-caller rate limit doesn't
    // fire first.
    for (let i = 0; i < 3; i++) {
      const inv = makeInvocation({ caller: i.toString(16).padStart(64, "0") });
      await expect(reg.handle({ processorId: "p", invocation: inv })).rejects.toMatchObject({
        code: OcErrorCode.HANDLER_FAILED,
      });
    }
    // After 3 failures, the breaker should be OPEN. The 4th call is
    // rejected before reaching the handler.
    const inv4 = makeInvocation({ caller: "f".repeat(64) });
    await expect(reg.handle({ processorId: "p", invocation: inv4 })).rejects.toMatchObject({
      code: OcErrorCode.PROCESSOR_PAUSED,
    });
  });

  it("rate limit and circuit breaker are isolated per processor", async () => {
    const reg = new OcProcessorRegistry();
    reg.register({
      manifest: { processor_id: "p1", capabilities: ["x"], fee_qubic: "0", endpoint: "https://p1", result_pubkey: "ab".repeat(32) },
      signingKey: { publicKeyHex: "ab".repeat(32), secret: "s" },
      handler: async () => ({ status: "verified" as const, result: {} }),
      computorKeys: makeKeyMap(makeInvocation()),
    });
    reg.register({
      manifest: { processor_id: "p2", capabilities: ["x"], fee_qubic: "0", endpoint: "https://p2", result_pubkey: "cd".repeat(32) },
      signingKey: { publicKeyHex: "cd".repeat(32), secret: "s" },
      handler: async () => ({ status: "verified" as const, result: {} }),
      computorKeys: makeKeyMap(makeInvocation()),
    });
    reg.pause("p1");
    const inv = makeInvocation();
    await expect(reg.handle({ processorId: "p1", invocation: inv })).rejects.toMatchObject({
      code: OcErrorCode.PROCESSOR_PAUSED,
    });
    // p2 is still open.
    const r = await reg.handle({ processorId: "p2", invocation: inv });
    expect(r.status).toBe("verified");
  });

  it("exposes RateLimiter + CircuitBreaker as standalone classes", () => {
    const rl = new RateLimiter();
    const cb = new CircuitBreaker();
    expect(rl.check({ caller: "c", processorId: "p", epoch: 1, nowMs: 0 }).allowed).toBe(true);
    expect(cb.allow(0)).toBe(true);
  });
});
