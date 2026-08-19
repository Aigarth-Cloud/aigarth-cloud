/**
 * Unit tests for the trinary decision service.
 *
 * Focus areas (per Phase 18B):
 *  - DecisionRequestSchema accepts/rejects expected input shapes
 *  - ListDecisionsQuerySchema accepts/rejects expected query shapes
 *  - Error classes carry the right messages
 *  - The stub produces valid envelopes in the trinary protocol
 *  - Sign / verify round-trip works against the stored envelope shape
 *
 * DB-bound happy paths (decideAnn, listDecisions against a real ANN)
 * are covered by integration tests in `routes.test.ts` and by the
 * docker-based smoke tests in CI.
 */

import { describe, it, expect } from "vitest";
import {
  DecideRequestSchema,
  ListDecisionsQuerySchema,
  AnnNotFoundError,
  AnnNotTrinaryError,
  AnnNoPublishedVersionError,
  stubTrinaryState,
  stubConfidence,
  stableStringify,
  stubReasoning,
  defaultReversibility,
  numericOr,
  newRequestId,
} from "../services/trinary.js";
import {
  IntentEnvelopeSchema,
  signEnvelope,
  verifyEnvelope,
  TRINARY_STATES,
} from "@aigarth/trinary";

describe("trinary service — schemas", () => {
  describe("DecideRequestSchema", () => {
    it("accepts a minimal request", () => {
      const r = DecideRequestSchema.parse({ input: { lead_score: 0.9 } });
      expect(r.request_id).toBeUndefined();
      expect(r.input).toEqual({ lead_score: 0.9 });
      expect(r.reversibility).toBeUndefined();
    });

    it("accepts a fully populated request", () => {
      const r = DecideRequestSchema.parse({
        request_id: "req_abc",
        input: { lead_id: "L123" },
        reversibility: "irreversible",
        time_horizon: "immediate",
        supporting_signals: [
          { source: "event", id: "evt_42" },
          { source: "feature", id: "kyc_status", content_hash: "a".repeat(64) },
        ],
      });
      expect(r.reversibility).toBe("irreversible");
      expect(r.time_horizon).toBe("immediate");
      expect(r.supporting_signals?.length).toBe(2);
    });

    it("defaults input to an empty object", () => {
      const r = DecideRequestSchema.parse({});
      expect(r.input).toEqual({});
    });

    it("rejects an unknown reversibility", () => {
      expect(() => DecideRequestSchema.parse({ reversibility: "permanent" })).toThrow();
    });

    it("rejects an unknown time_horizon", () => {
      expect(() => DecideRequestSchema.parse({ time_horizon: "forever" })).toThrow();
    });

    it("rejects a supporting_signal with an unknown source", () => {
      expect(() =>
        DecideRequestSchema.parse({
          supporting_signals: [{ source: "made_up_source", id: "x" }],
        }),
      ).toThrow();
    });

    it("rejects an empty signal id", () => {
      expect(() =>
        DecideRequestSchema.parse({
          supporting_signals: [{ source: "event", id: "" }],
        }),
      ).toThrow();
    });

    it("rejects more than 64 supporting_signals", () => {
      const tooMany = Array.from({ length: 65 }, () => ({ source: "event", id: "x" }));
      expect(() => DecideRequestSchema.parse({ supporting_signals: tooMany })).toThrow();
    });

    it("rejects a malformed content_hash", () => {
      expect(() =>
        DecideRequestSchema.parse({
          supporting_signals: [{ source: "event", id: "x", content_hash: "not_hex" }],
        }),
      ).toThrow();
    });
  });

  describe("ListDecisionsQuerySchema", () => {
    it("accepts an empty query", () => {
      const q = ListDecisionsQuerySchema.parse({});
      expect(q.limit).toBe(20);
      expect(q.verify_signatures).toBe(false);
      expect(q.state).toBeUndefined();
      expect(q.before).toBeUndefined();
    });

    it("coerces limit from string", () => {
      const q = ListDecisionsQuerySchema.parse({ limit: "50" });
      expect(q.limit).toBe(50);
    });

    it("rejects limit out of range", () => {
      expect(() => ListDecisionsQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => ListDecisionsQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it("rejects an invalid state", () => {
      expect(() => ListDecisionsQuerySchema.parse({ state: 2 })).toThrow();
      expect(() => ListDecisionsQuerySchema.parse({ state: -2 })).toThrow();
    });

    it("rejects an invalid before cursor", () => {
      expect(() => ListDecisionsQuerySchema.parse({ before: "not-a-date" })).toThrow();
    });

    it("coerces verify_signatures from string", () => {
      expect(ListDecisionsQuerySchema.parse({ verify_signatures: "true" }).verify_signatures).toBe(true);
      expect(ListDecisionsQuerySchema.parse({ verify_signatures: "false" }).verify_signatures).toBe(false);
      expect(ListDecisionsQuerySchema.parse({ verify_signatures: "1" }).verify_signatures).toBe(true);
      expect(ListDecisionsQuerySchema.parse({ verify_signatures: 0 }).verify_signatures).toBe(false);
      expect(ListDecisionsQuerySchema.parse({ verify_signatures: true }).verify_signatures).toBe(true);
    });
  });
});

describe("trinary service — errors", () => {
  it("AnnNotFoundError carries the id-or-slug in its message", () => {
    const e = new AnnNotFoundError("ann_xyz");
    expect(e.name).toBe("AnnNotFoundError");
    expect(e.message).toContain("ann_xyz");
  });

  it("AnnNotTrinaryError names the protocol in its message", () => {
    const e = new AnnNotTrinaryError("ann_xyz", "openai_chat");
    expect(e.name).toBe("AnnNotTrinaryError");
    expect(e.message).toContain("openai_chat");
    expect(e.message).toContain("ann_xyz");
  });

  it("AnnNoPublishedVersionError asks the caller to publish a version", () => {
    const e = new AnnNoPublishedVersionError("ann_xyz");
    expect(e.name).toBe("AnnNoPublishedVersionError");
    expect(e.message.toLowerCase()).toContain("publish");
  });
});

describe("trinary service — protocol invariants", () => {
  it("a stub envelope round-trips through IntentEnvelopeSchema", () => {
    // Build a deterministic stub envelope the same way the service does
    // (without the DB), then validate and verify it survives a sign / verify.
    const KEY = "test-signing-key-rotate-in-prod";
    const env = {
      schema_version: 1 as const,
      ann_id: "ann_test",
      ann_version: "1.0.0",
      state: 1 as const,
      confidence: 0.9,
      authority: 0.5,
      reasoning: "stub test",
      supporting_signals: [],
      required_future_signals: [],
      reversibility: "soft" as const,
      time_horizon: "session" as const,
      signature: "",
      issued_at: "2026-08-04T12:00:00.000Z",
    };
    const parsed = IntentEnvelopeSchema.parse(env);
    const signed = { ...parsed, signature: signEnvelope(parsed, KEY) };
    expect(IntentEnvelopeSchema.parse(signed)).toEqual(signed);
    expect(verifyEnvelope(signed, KEY)).toBe(true);
  });

  it("re-exports TRINARY_STATES for callers that need the tuple", async () => {
    const { TRINARY_STATES: imported } = await import("../services/trinary.js");
    expect(imported).toEqual(TRINARY_STATES);
  });
});

describe("trinary service — stub helpers", () => {
  describe("stableStringify", () => {
    it("sorts object keys at every depth", () => {
      const a = stableStringify({ b: 1, a: 2, c: { z: 1, y: 2 } });
      const b = stableStringify({ a: 2, c: { y: 2, z: 1 }, b: 1 });
      expect(a).toBe(b);
    });

    it("preserves array order", () => {
      expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
    });

    it("handles primitives", () => {
      expect(stableStringify("hi")).toBe('"hi"');
      expect(stableStringify(42)).toBe("42");
      expect(stableStringify(null)).toBe("null");
    });
  });

  describe("stubTrinaryState", () => {
    it("always returns one of the three trinary states", () => {
      for (let i = 0; i < 50; i++) {
        const s = stubTrinaryState(`ann_${i}`, "1.0.0", `req_${i}`, { lead_score: i / 50 });
        expect(TRINARY_STATES).toContain(s);
      }
    });

    it("is deterministic for the same input", () => {
      const a = stubTrinaryState("ann_x", "1.0.0", "req_1", { lead_id: "L42" });
      const b = stubTrinaryState("ann_x", "1.0.0", "req_1", { lead_id: "L42" });
      expect(a).toBe(b);
    });

    it("changes when the input changes", () => {
      // Not a strict guarantee (the hash could land in the same bucket
      // for two different inputs), but for these specific inputs the
      // expected outcome is observable across a few samples.
      const states = new Set<number>();
      for (let i = 0; i < 10; i++) {
        states.add(stubTrinaryState("ann_x", "1.0.0", "req_1", { i }));
      }
      expect(states.size).toBeGreaterThan(1);
    });
  });

  describe("stubConfidence", () => {
    it("is always in [0.6, 0.99]", () => {
      for (let i = 0; i < 30; i++) {
        const c = stubConfidence("ann_x", "1.0.0", `req_${i}`, { i });
        expect(c).toBeGreaterThanOrEqual(0.6);
        expect(c).toBeLessThanOrEqual(0.99);
      }
    });

    it("is deterministic for the same input", () => {
      const a = stubConfidence("ann_x", "1.0.0", "req_1", { x: 1 });
      const b = stubConfidence("ann_x", "1.0.0", "req_1", { x: 1 });
      expect(a).toBe(b);
    });
  });

  describe("stubReasoning", () => {
    it("handles empty input", () => {
      const r = stubReasoning("ann_x", {});
      expect(r).toContain("ann_x");
      expect(r.toLowerCase()).toContain("empty");
    });

    it("summarises non-empty input", () => {
      const r = stubReasoning("ann_x", { a: 1, b: 2, c: 3 });
      expect(r).toContain("3");
      expect(r).toContain("a, b, c");
    });

    it("truncates the field list to 5 entries", () => {
      const r = stubReasoning("ann_x", { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 });
      expect(r).toContain("7");
      expect(r).not.toContain("g");
    });
  });

  describe("defaultReversibility", () => {
    it("is stable per ANN id", () => {
      const a = defaultReversibility("ann_x");
      const b = defaultReversibility("ann_x");
      expect(a).toBe(b);
    });

    it("returns one of the documented values", () => {
      const a = defaultReversibility("ann_x");
      expect(["irreversible", "soft", "advisory"]).toContain(a);
    });

    it("differs between ANN ids (at least in distribution)", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) {
        seen.add(defaultReversibility(`ann_${i}`));
      }
      expect(seen.size).toBeGreaterThan(1);
    });
  });

  describe("numericOr", () => {
    it("returns the fallback for null and undefined", () => {
      expect(numericOr(null, 0.5)).toBe(0.5);
      expect(numericOr(undefined, 0.5)).toBe(0.5);
    });

    it("parses string numbers", () => {
      expect(numericOr("0.7", 0.5)).toBeCloseTo(0.7, 5);
    });

    it("passes through numbers", () => {
      expect(numericOr(0.8, 0.5)).toBe(0.8);
    });

    it("returns the fallback for non-finite values", () => {
      expect(numericOr(NaN, 0.5)).toBe(0.5);
      expect(numericOr(Infinity, 0.5)).toBe(0.5);
      expect(numericOr("not a number", 0.5)).toBe(0.5);
    });
  });

  describe("newRequestId", () => {
    it("returns a string with the req_ prefix", () => {
      const id = newRequestId();
      expect(id).toMatch(/^req_[a-f0-9]+$/);
    });

    it("produces a different value on each call", () => {
      const ids = new Set([newRequestId(), newRequestId(), newRequestId(), newRequestId()]);
      expect(ids.size).toBe(4);
    });
  });
});
