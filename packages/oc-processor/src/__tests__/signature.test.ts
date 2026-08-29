import { describe, it, expect } from "vitest";
import { verifySignatureBundle } from "../signature.js";
import { messageHash } from "../canonicalize.js";
import { OcProcessorError } from "../types.js";
import type { QubicInvocation, QubicComputorKey } from "../types.js";

function makeInvocation(overrides: Partial<QubicInvocation> = {}): QubicInvocation {
  const base: QubicInvocation = {
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
  };
  const inv = { ...base, ...overrides };
  inv.signatures.message_hash = messageHash(inv);
  return inv;
}

function makeKeyMap(inv: QubicInvocation): Map<string, QubicComputorKey> {
  const m = new Map<string, QubicComputorKey>();
  inv.signatures.computors.forEach((c, i) => {
    m.set(c, { computorIndex: i, publicKeyHex: "ab".repeat(32) });
  });
  return m;
}

describe("verifySignatureBundle", () => {
  it("accepts a well-formed 451-sig bundle", () => {
    const inv = makeInvocation();
    const keys = makeKeyMap(inv);
    const out = verifySignatureBundle(inv, keys);
    expect(out.validCount).toBe(451);
  });

  it("rejects when the message hash does not match", () => {
    const inv = makeInvocation();
    inv.signatures.message_hash = "sha256:" + "f".repeat(64);
    expect(() => verifySignatureBundle(inv, makeKeyMap(inv))).toThrow(OcProcessorError);
  });

  it("rejects fewer than 451 sigs", () => {
    const inv = makeInvocation();
    inv.signatures.computors = inv.signatures.computors.slice(0, 100);
    inv.signatures.sigs = inv.signatures.sigs.slice(0, 100);
    inv.signatures.message_hash = messageHash(inv);
    expect(() => verifySignatureBundle(inv, new Map())).toThrow(/INSUFFICIENT_SIGS/);
  });

  it("rejects length mismatch", () => {
    const inv = makeInvocation();
    inv.signatures.sigs = inv.signatures.sigs.slice(0, 450);
    inv.signatures.message_hash = messageHash(inv);
    expect(() => verifySignatureBundle(inv, makeKeyMap(inv))).toThrow(/mismatch/);
  });

  it("rejects duplicate computors", () => {
    const inv = makeInvocation();
    inv.signatures.computors[0] = inv.signatures.computors[1]!;
    inv.signatures.message_hash = messageHash(inv);
    expect(() => verifySignatureBundle(inv, makeKeyMap(inv))).toThrow(/duplicate/);
  });

  it("rejects unknown computor", () => {
    const inv = makeInvocation();
    const keys = new Map<string, QubicComputorKey>();
    // intentionally empty
    expect(() => verifySignatureBundle(inv, keys)).toThrow(/unknown computor/);
  });
});
