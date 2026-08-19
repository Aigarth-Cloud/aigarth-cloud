/**
 * Tissue usage — Phase 18E billing tests.
 *
 *   Covers zod schema for the internal usage event.
 *   (Aggregation is tested live in the service; this only
 *   pins the wire contract.)
 */

import { describe, it, expect } from "vitest";
import { TissueUsageEventSchema } from "../services/tissueUsage.js";

describe("tissueUsage.TissueUsageEventSchema", () => {
  it("accepts a valid event", () => {
    const r = TissueUsageEventSchema.safeParse({
      userId: "00000000-0000-0000-0000-000000000001",
      tissueSlug: "tissue_executive_v1",
      tissueVersion: "1.0.0",
      state: 1,
      costQubic: "1000",
      requestId: "req-1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing userId", () => {
    const r = TissueUsageEventSchema.safeParse({
      tissueSlug: "x",
      tissueVersion: "1.0.0",
      state: 0,
      costQubic: "1000",
      requestId: "req-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid state", () => {
    const r = TissueUsageEventSchema.safeParse({
      userId: "00000000-0000-0000-0000-000000000001",
      tissueSlug: "x",
      tissueVersion: "1.0.0",
      state: 2,
      costQubic: "1000",
      requestId: "req-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-numeric cost", () => {
    const r = TissueUsageEventSchema.safeParse({
      userId: "00000000-0000-0000-0000-000000000001",
      tissueSlug: "x",
      tissueVersion: "1.0.0",
      state: 0,
      costQubic: "abc",
      requestId: "req-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty requestId", () => {
    const r = TissueUsageEventSchema.safeParse({
      userId: "00000000-0000-0000-0000-000000000001",
      tissueSlug: "x",
      tissueVersion: "1.0.0",
      state: 0,
      costQubic: "1000",
      requestId: "",
    });
    expect(r.success).toBe(false);
  });

  it("accepts an optional tissueListingId", () => {
    const r = TissueUsageEventSchema.safeParse({
      userId: "00000000-0000-0000-0000-000000000001",
      tissueSlug: "x",
      tissueVersion: "1.0.0",
      state: -1,
      costQubic: "0",
      requestId: "req-1",
      tissueListingId: "00000000-0000-0000-0000-000000000099",
    });
    expect(r.success).toBe(true);
  });

  it("accepts all three states", () => {
    for (const state of [-1, 0, 1] as const) {
      const r = TissueUsageEventSchema.safeParse({
        userId: "00000000-0000-0000-0000-000000000001",
        tissueSlug: "x",
        tissueVersion: "1.0.0",
        state,
        costQubic: "0",
        requestId: "req-1",
      });
      expect(r.success).toBe(true);
    }
  });
});
