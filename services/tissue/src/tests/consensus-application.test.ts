/**
 * Tests for the consensus-application helpers in decisions.ts.
 *
 * The pure consensus algebra (`combine()` from @aigarth/trinary) is
 * tested in that package. This file covers the *application* logic
 * that's specific to the tissue service: envelope derivation,
 * signal deduplication, the most-conservative rules for
 * reversibility and time_horizon, and the recommended-action verb
 * mapping.
 */

import { describe, it, expect } from "vitest";
import {
  maxReversibility,
  maxTimeHorizon,
  recommendedActionFor,
} from "../services/decisions.js";

describe("consensus application — maxReversibility", () => {
  it("returns the most conservative value", () => {
    expect(maxReversibility(["advisory"])).toBe("advisory");
    expect(maxReversibility(["advisory", "soft"])).toBe("soft");
    expect(maxReversibility(["advisory", "soft", "irreversible"])).toBe("irreversible");
    expect(maxReversibility(["soft", "soft"])).toBe("soft");
    expect(maxReversibility(["irreversible", "advisory", "soft"])).toBe("irreversible");
  });

  it("returns advisory on an empty list (the safest fallback)", () => {
    expect(maxReversibility([])).toBe("advisory");
  });
});

describe("consensus application — maxTimeHorizon", () => {
  it("returns the most conservative value", () => {
    expect(maxTimeHorizon(["immediate"])).toBe("immediate");
    expect(maxTimeHorizon(["immediate", "session"])).toBe("session");
    expect(maxTimeHorizon(["immediate", "session", "persistent"])).toBe("persistent");
    expect(maxTimeHorizon(["session", "session"])).toBe("session");
    expect(maxTimeHorizon(["persistent", "immediate", "session"])).toBe("persistent");
  });

  it("returns immediate on an empty list", () => {
    expect(maxTimeHorizon([])).toBe("immediate");
  });
});

describe("consensus application — recommendedActionFor", () => {
  it("maps +1 to proceed", () => {
    expect(recommendedActionFor(1)).toBe("proceed");
  });
  it("maps -1 to block", () => {
    expect(recommendedActionFor(-1)).toBe("block");
  });
  it("maps 0 to continue_observing", () => {
    expect(recommendedActionFor(0)).toBe("continue_observing");
  });
});
