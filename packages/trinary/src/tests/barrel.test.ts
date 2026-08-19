/**
 * Barrel test — verifies that every export documented in
 * `src/index.ts` is reachable and non-null. This is the only test
 * that exercises the barrel itself; without it, the index.ts file
 * shows 0% coverage because v8 cannot trace re-exports.
 */
import { describe, it, expect } from "vitest";
import * as Trinary from "..";

describe("barrel (public surface)", () => {
  it("exports the state surface", () => {
    expect(Trinary.TRINARY_STATES).toEqual([-1, 0, 1]);
    expect(Trinary.VERBS_BY_STATE).toBeDefined();
    expect(typeof Trinary.isTrinaryState).toBe("function");
    expect(typeof Trinary.signToTrinary).toBe("function");
    expect(typeof Trinary.negate).toBe("function");
    expect(typeof Trinary.verbMatchesState).toBe("function");
    expect(Trinary.TrinaryStateSchema).toBeDefined();
    expect(Trinary.TrinaryVerbSchema).toBeDefined();
  });

  it("exports the signal surface", () => {
    expect(Trinary.SignalSourceSchema).toBeDefined();
    expect(Trinary.SignalRefSchema).toBeDefined();
  });

  it("exports the envelope surface", () => {
    expect(Trinary.SCHEMA_VERSION).toBe(1);
    expect(Trinary.SchemaVersionSchema).toBeDefined();
    expect(Trinary.ReversibilitySchema).toBeDefined();
    expect(Trinary.TimeHorizonSchema).toBeDefined();
    expect(Trinary.IntentEnvelopeSchema).toBeDefined();
    expect(typeof Trinary.blankEnvelope).toBe("function");
  });

  it("exports the canonicalize surface", () => {
    expect(typeof Trinary.canonicalizeEnvelope).toBe("function");
    expect(typeof Trinary.canonicalizeValue).toBe("function");
    expect(typeof Trinary.hashEnvelope).toBe("function");
  });

  it("exports the sign surface", () => {
    expect(typeof Trinary.signEnvelope).toBe("function");
    expect(typeof Trinary.verifyEnvelope).toBe("function");
  });

  it("exports the consensus surface", () => {
    expect(Trinary.EMPTY_DECISION).toBeDefined();
    expect(typeof Trinary.combine).toBe("function");
  });
});
