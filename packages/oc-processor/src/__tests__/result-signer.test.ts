import { describe, it, expect } from "vitest";
import { signResult, verifyResultSignature } from "../result-signer.js";
import type { AigarthSigningKey } from "../result-signer.js";

const KEY: AigarthSigningKey = {
  publicKeyHex: "ab".repeat(32),
  secret: "this-is-a-test-secret-do-not-use-in-prod",
};

const ARGS = {
  invocationHash: "sha256:" + "a".repeat(64),
  workId: "wki_test",
  status: "verified" as const,
  result: { prediction: "up", confidence: 0.7 },
};

describe("result signer", () => {
  it("produces a stable signature for the same input", () => {
    expect(signResult({ ...ARGS, signingKey: KEY })).toBe(signResult({ ...ARGS, signingKey: KEY }));
  });
  it("verifies its own signature", () => {
    const sig = signResult({ ...ARGS, signingKey: KEY });
    expect(verifyResultSignature({ ...ARGS, signingKey: KEY, signature: sig })).toBe(true);
  });
  it("rejects a tampered signature", () => {
    const sig = signResult({ ...ARGS, signingKey: KEY });
    const tampered = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    expect(verifyResultSignature({ ...ARGS, signingKey: KEY, signature: tampered })).toBe(false);
  });
  it("rejects a signature from a different key", () => {
    const sig = signResult({ ...ARGS, signingKey: KEY });
    const other: AigarthSigningKey = { ...KEY, secret: "different-secret" };
    expect(verifyResultSignature({ ...ARGS, signingKey: other, signature: sig })).toBe(false);
  });
  it("changes when any field changes", () => {
    const sig = signResult({ ...ARGS, signingKey: KEY });
    expect(signResult({ ...ARGS, signingKey: KEY, status: "failed" })).not.toBe(sig);
    expect(signResult({ ...ARGS, signingKey: KEY, workId: "wki_other" })).not.toBe(sig);
    expect(signResult({ ...ARGS, signingKey: KEY, result: { x: 1 } })).not.toBe(sig);
  });
});
