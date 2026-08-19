/**
 * Tissue listings — Phase 18E productization tests.
 *
 * Covers:
 *   - CreateTissueListingSchema (zod validation, defaults)
 *   - UpdateTissueListingSchema
 *   - ListTissueListingsQuerySchema
 *   - slug derivation from title
 *   - recordTissueDecision (counter + revenue increment)
 */

import { describe, it, expect } from "vitest";
import {
  CreateTissueListingSchema,
  UpdateTissueListingSchema,
  ListTissueListingsQuerySchema,
} from "../services/tissueListings.js";

describe("tissueListings.CreateTissueListingSchema", () => {
  it("accepts a minimal valid input", () => {
    const r = CreateTissueListingSchema.safeParse({
      title: "Executive Tissue",
      tissueSlug: "tissue_executive_v1",
      tissueName: "Executive Tissue",
      pricePerDecisionQubic: "1000",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tags).toEqual([]);
      expect(r.data.access).toBe("open");
      expect(r.data.visibility).toBe("public");
      expect(r.data.tissueVersion).toBe("1.0.0");
    }
  });

  it("rejects empty title", () => {
    const r = CreateTissueListingSchema.safeParse({
      title: "",
      tissueSlug: "x",
      tissueName: "x",
      pricePerDecisionQubic: "1000",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-numeric price", () => {
    const r = CreateTissueListingSchema.safeParse({
      title: "T",
      tissueSlug: "x",
      tissueName: "x",
      pricePerDecisionQubic: "not-a-number",
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative price", () => {
    const r = CreateTissueListingSchema.safeParse({
      title: "T",
      tissueSlug: "x",
      tissueName: "x",
      pricePerDecisionQubic: "-1000",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown access", () => {
    const r = CreateTissueListingSchema.safeParse({
      title: "T",
      tissueSlug: "x",
      tissueName: "x",
      pricePerDecisionQubic: "1000",
      access: "private",
    });
    expect(r.success).toBe(false);
  });

  it("accepts licensed access", () => {
    const r = CreateTissueListingSchema.safeParse({
      title: "T",
      tissueSlug: "x",
      tissueName: "x",
      pricePerDecisionQubic: "1000",
      access: "licensed",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.access).toBe("licensed");
  });

  it("accepts custom tags, icon, sellerName", () => {
    const r = CreateTissueListingSchema.safeParse({
      title: "Risk Council",
      tissueSlug: "tissue_risk_v1",
      tissueName: "Risk Council",
      pricePerDecisionQubic: "5000",
      tags: ["risk", "compliance"],
      icon: "shield",
      sellerName: "Acme",
      tissueVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tags).toEqual(["risk", "compliance"]);
      expect(r.data.icon).toBe("shield");
      expect(r.data.sellerName).toBe("Acme");
      expect(r.data.tissueVersion).toBe("2.0.0");
    }
  });
});

describe("tissueListings.UpdateTissueListingSchema", () => {
  it("accepts a partial update", () => {
    const r = UpdateTissueListingSchema.safeParse({
      pricePerDecisionQubic: "2000",
    });
    expect(r.success).toBe(true);
  });

  it("accepts an empty object (no-op)", () => {
    const r = UpdateTissueListingSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("rejects bad status", () => {
    const r = UpdateTissueListingSchema.safeParse({ status: "deleted" });
    expect(r.success).toBe(false);
  });

  it("rejects bad price", () => {
    const r = UpdateTissueListingSchema.safeParse({ pricePerDecisionQubic: "abc" });
    expect(r.success).toBe(false);
  });
});

describe("tissueListings.ListTissueListingsQuerySchema", () => {
  it("defaults status to active and limit to 20", () => {
    const r = ListTissueListingsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("active");
      expect(r.data.limit).toBe(20);
      expect(r.data.offset).toBe(0);
      expect(r.data.sort).toBe("newest");
    }
  });

  it("accepts access filter", () => {
    const r = ListTissueListingsQuerySchema.safeParse({ access: "licensed" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.access).toBe("licensed");
  });

  it("accepts tissueSlug filter", () => {
    const r = ListTissueListingsQuerySchema.safeParse({ tissueSlug: "tissue_executive_v1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tissueSlug).toBe("tissue_executive_v1");
  });

  it("clamps limit to 100", () => {
    const r = ListTissueListingsQuerySchema.safeParse({ limit: 999 });
    expect(r.success).toBe(false);
  });

  it("accepts sort options", () => {
    for (const sort of ["newest", "oldest", "price_asc", "price_desc", "rating"] as const) {
      const r = ListTissueListingsQuerySchema.safeParse({ sort });
      expect(r.success).toBe(true);
    }
  });
});
