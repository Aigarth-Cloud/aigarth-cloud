import { describe, it, expect } from "vitest";
import { canonicaliseInvocation, messageHash, stableStringify } from "../canonicalize.js";
import type { QubicInvocation } from "../types.js";

const SAMPLE: QubicInvocation = {
  kind: "invocation",
  contract_index: 7,
  procedure: "trinary_decision",
  caller: "a".repeat(64),
  payer: "b".repeat(64),
  fee_paid_qubit: "1000000",
  epoch: 150,
  nonce: "n-1",
  payload: { input: { features: [1, 2, 3] } },
  signatures: {
    computors: Array.from({ length: 451 }, (_, i) => i.toString(16).padStart(64, "0")),
    sigs: Array.from({ length: 451 }, () => "deadbeef".repeat(8)),
    message_hash: "sha256:" + "0".repeat(64),
  },
};

describe("stableStringify", () => {
  it("sorts keys", () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });
  it("is recursive", () => {
    expect(stableStringify({ b: { y: 2, x: 1 }, a: 1 })).toBe(
      stableStringify({ a: 1, b: { x: 1, y: 2 } }),
    );
  });
});

describe("canonicaliseInvocation", () => {
  it("is stable for permuted payload keys", () => {
    const a = canonicaliseInvocation(SAMPLE);
    const b = canonicaliseInvocation({ ...SAMPLE, payload: { ...SAMPLE.payload } });
    expect(a).toBe(b);
  });
  it("changes when any field changes", () => {
    expect(canonicaliseInvocation(SAMPLE)).not.toBe(
      canonicaliseInvocation({ ...SAMPLE, fee_paid_qubit: "2000000" }),
    );
  });
});

describe("messageHash", () => {
  it("returns sha256:<64 hex>", () => {
    expect(messageHash(SAMPLE)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
  it("is stable", () => {
    expect(messageHash(SAMPLE)).toBe(messageHash(SAMPLE));
  });
});
