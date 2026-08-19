import { describe, it, expect } from "vitest";
import {
  TRINARY_STATES,
  VERBS_BY_STATE,
  isTrinaryState,
  signToTrinary,
  negate,
  verbMatchesState,
  TrinaryStateSchema,
  TrinaryVerbSchema,
} from "../state";

describe("state", () => {
  it("TRINARY_STATES is exactly [-1, 0, 1]", () => {
    expect(TRINARY_STATES).toEqual([-1, 0, 1]);
  });

  it("VERBS_BY_STATE has the expected buckets", () => {
    expect(VERBS_BY_STATE["-1"]).toContain("block");
    expect(VERBS_BY_STATE["0"]).toContain("continue_observing");
    expect(VERBS_BY_STATE["1"]).toContain("proceed");
  });

  describe("isTrinaryState", () => {
    it("accepts -1, 0, 1", () => {
      expect(isTrinaryState(-1)).toBe(true);
      expect(isTrinaryState(0)).toBe(true);
      expect(isTrinaryState(1)).toBe(true);
    });
    it("rejects every other number", () => {
      expect(isTrinaryState(-2)).toBe(false);
      expect(isTrinaryState(2)).toBe(false);
      expect(isTrinaryState(0.5)).toBe(false);
      expect(isTrinaryState(NaN)).toBe(false);
    });
  });

  describe("signToTrinary", () => {
    it("maps negatives to -1", () => {
      expect(signToTrinary(-10)).toBe(-1);
      expect(signToTrinary(-0.1)).toBe(-1);
    });
    it("maps zero to 0", () => {
      expect(signToTrinary(0)).toBe(0);
      expect(signToTrinary(-0)).toBe(0);
    });
    it("maps positives to +1", () => {
      expect(signToTrinary(0.1)).toBe(1);
      expect(signToTrinary(42)).toBe(1);
    });
  });

  describe("negate", () => {
    it("flips +1 to -1 and back", () => {
      expect(negate(1)).toBe(-1);
      expect(negate(-1)).toBe(1);
    });
    it("leaves 0 alone", () => {
      expect(negate(0)).toBe(0);
    });
  });

  describe("verbMatchesState", () => {
    it("matches verbs to their state", () => {
      expect(verbMatchesState("block", -1)).toBe(true);
      expect(verbMatchesState("block", 1)).toBe(false);
      expect(verbMatchesState("proceed", 1)).toBe(true);
      expect(verbMatchesState("proceed", -1)).toBe(false);
      expect(verbMatchesState("continue_observing", 0)).toBe(true);
    });
    it("rejects unknown verbs", () => {
      expect(verbMatchesState("nope", 0)).toBe(false);
    });
  });

  describe("TrinaryStateSchema", () => {
    it("parses the three legal values", () => {
      expect(TrinaryStateSchema.parse(-1)).toBe(-1);
      expect(TrinaryStateSchema.parse(0)).toBe(0);
      expect(TrinaryStateSchema.parse(1)).toBe(1);
    });
    it("rejects every other value", () => {
      expect(() => TrinaryStateSchema.parse(2)).toThrow();
      expect(() => TrinaryStateSchema.parse(-2)).toThrow();
      expect(() => TrinaryStateSchema.parse("1")).toThrow();
    });
  });

  describe("TrinaryVerbSchema", () => {
    it("accepts a verb from any bucket", () => {
      expect(TrinaryVerbSchema.parse("block")).toBe("block");
      expect(TrinaryVerbSchema.parse("proceed")).toBe("proceed");
      expect(TrinaryVerbSchema.parse("continue_observing")).toBe("continue_observing");
    });
    it("rejects unknown verbs", () => {
      expect(() => TrinaryVerbSchema.parse("not_a_verb")).toThrow();
    });
  });
});
