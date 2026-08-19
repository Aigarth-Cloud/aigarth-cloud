import { describe, it, expect } from "vitest";
import { signEnvelope, verifyEnvelope } from "../sign";
import { blankEnvelope, type IntentEnvelope } from "../envelope";
import { hashEnvelope } from "../canonicalize";

const KEY = "a-test-key-not-for-production-please-rotate";

function make(state: -1 | 0 | 1 = 1, conf = 0.9): IntentEnvelope {
  return blankEnvelope({
    ann_id: "ann_x",
    ann_version: "1.0.0",
    state,
    confidence: conf,
  });
}

describe("sign / verify", () => {
  it("signEnvelope produces a 64-char hex string", () => {
    const env = make();
    const sig = signEnvelope(env, KEY);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifyEnvelope accepts a valid signature", () => {
    const env = make();
    const sig = signEnvelope(env, KEY);
    expect(verifyEnvelope({ ...env, signature: sig }, KEY)).toBe(true);
  });

  it("verifyEnvelope rejects a tampered envelope", () => {
    const env = make();
    const sig = signEnvelope(env, KEY);
    expect(verifyEnvelope({ ...env, state: -1, signature: sig }, KEY)).toBe(false);
    expect(verifyEnvelope({ ...env, confidence: 0.1, signature: sig }, KEY)).toBe(false);
    expect(verifyEnvelope({ ...env, reasoning: "tampered", signature: sig }, KEY)).toBe(false);
  });

  it("verifyEnvelope rejects the wrong key", () => {
    const env = make();
    const sig = signEnvelope(env, KEY);
    expect(verifyEnvelope({ ...env, signature: sig }, "different-key")).toBe(false);
  });

  it("verifyEnvelope rejects a signature of the wrong length", () => {
    const env = make();
    const sig = signEnvelope(env, KEY);
    expect(verifyEnvelope({ ...env, signature: sig.slice(0, 60) }, KEY)).toBe(false);
    expect(verifyEnvelope({ ...env, signature: sig + "00" }, KEY)).toBe(false);
  });

  it("verifyEnvelope rejects a non-hex signature without throwing", () => {
    const env = make();
    expect(verifyEnvelope({ ...env, signature: "not_hex_at_all!" }, KEY)).toBe(false);
  });

  it("signEnvelope accepts a Buffer key", () => {
    const env = make();
    const sigFromString = signEnvelope(env, KEY);
    const sigFromBuffer = signEnvelope(env, Buffer.from(KEY, "utf8"));
    expect(sigFromString).toBe(sigFromBuffer);
  });

  it("signEnvelope throws on an empty key", () => {
    const env = make();
    expect(() => signEnvelope(env, "")).toThrow();
  });

  it("signature depends on the canonical hash, not on the signature field", () => {
    const env = make();
    const sig1 = signEnvelope(env, KEY);
    // Even if the envelope's own signature field changes, the signed
    // bytes don't — because the canonical form clears the signature.
    const envWithSignature = { ...env, signature: "aa".repeat(32) };
    const sig2 = signEnvelope(envWithSignature, KEY);
    expect(sig1).toBe(sig2);
    expect(hashEnvelope(env)).toBe(hashEnvelope(envWithSignature));
  });
});
