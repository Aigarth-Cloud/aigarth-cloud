import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { canonicalizeEnvelope, canonicalizeValue, hashEnvelope } from "../canonicalize";
import { blankEnvelope } from "../envelope";

describe("canonicalize", () => {
  describe("canonicalizeValue", () => {
    it("sorts object keys at every depth", () => {
      const a = canonicalizeValue({ b: 1, a: 2, c: { z: 1, y: 2 } });
      const b = canonicalizeValue({ a: 2, c: { y: 2, z: 1 }, b: 1 });
      expect(a).toBe(b);
    });

    it("ignores array order (arrays are not sorted)", () => {
      const a = canonicalizeValue({ list: [1, 2, 3] });
      const b = canonicalizeValue({ list: [3, 2, 1] });
      expect(a).not.toBe(b);
    });

    it("produces no whitespace", () => {
      const out = canonicalizeValue({ a: 1, b: 2 });
      expect(out).toBe('{"a":1,"b":2}');
    });

    it("handles nested mixed structures", () => {
      const out = canonicalizeValue({
        meta: { z: 1, a: 2 },
        list: [
          { y: 1, x: 2 },
          { x: 1, y: 2 },
        ],
        scalar: "hi",
      });
      // Top-level keys sorted; nested object keys inside arrays are
      // also sorted (the replacer is called for every value, including
      // array elements). Array order itself is preserved.
      expect(out).toBe(
        '{"list":[{"x":2,"y":1},{"x":1,"y":2}],"meta":{"a":2,"z":1},"scalar":"hi"}',
      );
    });
  });

  describe("canonicalizeEnvelope", () => {
    it("clears the signature field", () => {
      const env = blankEnvelope({
        ann_id: "ann_x",
        ann_version: "1.0.0",
        state: 1,
        confidence: 0.9,
      });
      const signed = { ...env, signature: "deadbeef" };
      const a = canonicalizeEnvelope(signed);
      const b = canonicalizeEnvelope({ ...signed, signature: "" });
      expect(a).toBe(b);
    });

    it("is stable across key insertion order", () => {
      const env = blankEnvelope({
        ann_id: "ann_x",
        ann_version: "1.0.0",
        state: 1,
        confidence: 0.9,
        authority: 0.7,
        reasoning: "all good",
        reversibility: "soft",
        time_horizon: "session",
        issued_at: "2026-08-04T12:00:00.000Z",
      });
      const reordered = {
        issued_at: env.issued_at,
        time_horizon: env.time_horizon,
        reversibility: env.reversibility,
        reasoning: env.reasoning,
        authority: env.authority,
        confidence: env.confidence,
        state: env.state,
        ann_version: env.ann_version,
        ann_id: env.ann_id,
        schema_version: env.schema_version,
        signature: env.signature,
        supporting_signals: env.supporting_signals,
        required_future_signals: env.required_future_signals,
      };
      expect(canonicalizeEnvelope(env)).toBe(canonicalizeEnvelope(reordered));
    });
  });

  describe("hashEnvelope", () => {
    it("matches an independent sha-256 of the canonical form", () => {
      const env = blankEnvelope({
        ann_id: "ann_x",
        ann_version: "1.0.0",
        state: 1,
        confidence: 0.9,
      });
      const expected = createHash("sha256")
        .update(canonicalizeEnvelope(env), "utf8")
        .digest("hex");
      expect(hashEnvelope(env)).toBe(expected);
    });

    it("changes when any field changes", () => {
      const base = blankEnvelope({
        ann_id: "ann_x",
        ann_version: "1.0.0",
        state: 1,
        confidence: 0.9,
      });
      const h0 = hashEnvelope(base);
      const h1 = hashEnvelope({ ...base, state: -1 });
      const h2 = hashEnvelope({ ...base, confidence: 0.91 });
      const h3 = hashEnvelope({ ...base, ann_version: "1.0.1" });
      const h4 = hashEnvelope({ ...base, reasoning: "different" });
      expect(new Set([h0, h1, h2, h3, h4]).size).toBe(5);
    });

    it("returns a 64-char lowercase hex string", () => {
      const env = blankEnvelope({
        ann_id: "ann_x",
        ann_version: "1.0.0",
        state: 0,
        confidence: 0.5,
      });
      const h = hashEnvelope(env);
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
