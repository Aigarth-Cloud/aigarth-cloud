import { describe, it, expect } from "vitest";
import {
  IntentEnvelopeSchema,
  blankEnvelope,
  SCHEMA_VERSION,
} from "../envelope";

const minimal = {
  schema_version: SCHEMA_VERSION,
  ann_id: "ann_sales_v1",
  ann_version: "1.0.0",
  state: 1,
  confidence: 0.92,
  authority: 0.5,
  reasoning: "Lead is qualified and recent",
  recommended_action: "proceed",
  supporting_signals: [{ source: "event", id: "evt_42" }],
  required_future_signals: [],
  reversibility: "soft",
  time_horizon: "session",
  signature: "",
  issued_at: "2026-08-04T12:00:00.000Z",
};

describe("envelope", () => {
  describe("IntentEnvelopeSchema", () => {
    it("accepts a fully populated envelope", () => {
      const env = IntentEnvelopeSchema.parse(minimal);
      expect(env.state).toBe(1);
      expect(env.ann_id).toBe("ann_sales_v1");
    });

    it("accepts the minimal envelope (defaults filled)", () => {
      const env = IntentEnvelopeSchema.parse({
        schema_version: SCHEMA_VERSION,
        ann_id: "ann_x",
        ann_version: "0.0.1",
        state: 0,
        confidence: 0,
        authority: 0.5,
        reasoning: "",
        supporting_signals: [],
        required_future_signals: [],
        reversibility: "advisory",
        time_horizon: "session",
        signature: "",
        issued_at: "2026-08-04T12:00:00.000Z",
      });
      expect(env.state).toBe(0);
    });

    it("rejects a wrong schema_version", () => {
      expect(() =>
        IntentEnvelopeSchema.parse({ ...minimal, schema_version: 2 }),
      ).toThrow();
    });

    it("rejects an out-of-range state", () => {
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, state: 2 })).toThrow();
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, state: -2 })).toThrow();
    });

    it("rejects confidence outside [0, 1]", () => {
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, confidence: 1.01 })).toThrow();
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, confidence: -0.01 })).toThrow();
    });

    it("rejects NaN/Infinity in confidence", () => {
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, confidence: NaN })).toThrow();
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, confidence: Infinity })).toThrow();
    });

    it("rejects authority outside [0, 1]", () => {
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, authority: 1.5 })).toThrow();
    });

    it("rejects a non-semver ann_version", () => {
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, ann_version: "1.0" })).toThrow();
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, ann_version: "v1" })).toThrow();
    });

    it("rejects a non-hex signature", () => {
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, signature: "not_hex!" })).toThrow();
    });

    it("rejects a missing issued_at", () => {
      const { issued_at, ...rest } = minimal;
      expect(() => IntentEnvelopeSchema.parse(rest)).toThrow();
    });

    it("rejects unknown fields (strict mode)", () => {
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, unknown_field: true })).toThrow();
    });

    it("rejects a supporting_signals entry with too many items", () => {
      const tooMany = Array.from({ length: 65 }, () => ({ source: "event", id: "x" }));
      expect(() => IntentEnvelopeSchema.parse({ ...minimal, supporting_signals: tooMany })).toThrow();
    });
  });

  describe("blankEnvelope", () => {
    it("builds a parseable envelope with defaults", () => {
      const env = blankEnvelope({
        ann_id: "ann_x",
        ann_version: "1.0.0",
        state: 1,
        confidence: 0.8,
      });
      expect(env.schema_version).toBe(1);
      expect(env.authority).toBe(0.5);
      expect(env.reversibility).toBe("advisory");
      expect(env.time_horizon).toBe("session");
      expect(env.signature).toBe("");
      expect(env.supporting_signals).toEqual([]);
      expect(env.required_future_signals).toEqual([]);
    });

    it("accepts explicit overrides for every default", () => {
      const env = blankEnvelope({
        ann_id: "ann_x",
        ann_version: "1.0.0",
        state: -1,
        confidence: 0.1,
        authority: 0.9,
        reasoning: "fraud risk high",
        recommended_action: "block",
        supporting_signals: [{ source: "market", id: "tx_42" }],
        required_future_signals: [{ source: "feature", id: "kyc_status" }],
        reversibility: "irreversible",
        time_horizon: "immediate",
        issued_at: "2026-08-04T12:00:00.000Z",
        expires_at: "2026-08-04T13:00:00.000Z",
      });
      expect(env.authority).toBe(0.9);
      expect(env.reversibility).toBe("irreversible");
      expect(env.time_horizon).toBe("immediate");
      expect(env.expires_at).toBe("2026-08-04T13:00:00.000Z");
    });
  });
});
