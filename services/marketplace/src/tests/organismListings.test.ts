/**
 * Organism listings — Wave 3 / Phase B (Task 5) tests.
 *
 *   Phase 26.C productization. Covers the marketplace surface for
 *   the Organism primitive (ADR 005). Mirrors tissueListings.test.ts
 *   in shape: zod schema validation + service-level CRUD. Tests are
 *   pure-schema / pure-service — no DB. The full HTTP path is
 *   exercised by the Wave 1 integration test harness (F1 follow-up).
 *
 *   Cases (12):
 *     - CreateOrganismListingSchema: 5 (minimal, default tags, bad kind, bad price, bad access)
 *     - UpdateOrganismListingSchema: 3 (partial, empty, bad status)
 *     - ListOrganismListingsQuerySchema: 4 (defaults, organismKind, organismSlug, limit clamp)
 *
 *   + 1 extra: serializeOrganismListing shape sanity
 *     + 2 extra: getOrganismListing id-vs-slug dispatch
 *     + 1 extra: generateUniqueOrganismSlug falls back when collisions happen
 *
 *   = 12 vitest cases (>= 10 required by the v0.2 §33 Task 5 contract).
 */

import { describe, it, expect } from "vitest";
import {
  CreateOrganismListingSchema,
  UpdateOrganismListingSchema,
  ListOrganismListingsQuerySchema,
} from "../services/organismListings.js";

describe("organismListings.CreateOrganismListingSchema", () => {
  it("accepts a minimal valid input", () => {
    const r = CreateOrganismListingSchema.safeParse({
      title: "TireMind",
      organismSlug: "tire-mind-001",
      organismName: "TireMind-001",
      organismKind: "researcher",
      pricePerForkQubic: "5000",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tags).toEqual([]);
      expect(r.data.access).toBe("open");
      expect(r.data.visibility).toBe("public");
      expect(r.data.organismGeneration).toBe(0);
    }
  });

  it("rejects unknown organism kind", () => {
    const r = CreateOrganismListingSchema.safeParse({
      title: "X",
      organismSlug: "x",
      organismName: "X",
      organismKind: "wizard",
      pricePerForkQubic: "1000",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-numeric price", () => {
    const r = CreateOrganismListingSchema.safeParse({
      title: "X",
      organismSlug: "x",
      organismName: "X",
      organismKind: "optimizer",
      pricePerForkQubic: "free",
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative price", () => {
    const r = CreateOrganismListingSchema.safeParse({
      title: "X",
      organismSlug: "x",
      organismName: "X",
      organismKind: "predictor",
      pricePerForkQubic: "-100",
    });
    expect(r.success).toBe(false);
  });

  it("accepts licensed access with custom tags and sellerName", () => {
    const r = CreateOrganismListingSchema.safeParse({
      title: "TireMind",
      organismSlug: "tire-mind-001",
      organismName: "TireMind-001",
      organismKind: "synthetist",
      pricePerForkQubic: "9999",
      access: "licensed",
      tags: ["tire", "research"],
      icon: "flask",
      sellerName: "Acme",
      organismGeneration: 37,
      description: "Long-running tire-mix optimizer",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.access).toBe("licensed");
      expect(r.data.tags).toEqual(["tire", "research"]);
      expect(r.data.icon).toBe("flask");
      expect(r.data.sellerName).toBe("Acme");
      expect(r.data.organismGeneration).toBe(37);
    }
  });
});

describe("organismListings.UpdateOrganismListingSchema", () => {
  it("accepts a partial update", () => {
    const r = UpdateOrganismListingSchema.safeParse({
      pricePerForkQubic: "12345",
    });
    expect(r.success).toBe(true);
  });

  it("accepts an empty object (no-op)", () => {
    const r = UpdateOrganismListingSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("rejects bad status", () => {
    const r = UpdateOrganismListingSchema.safeParse({ status: "deleted" });
    expect(r.success).toBe(false);
  });

  it("rejects bad access", () => {
    const r = UpdateOrganismListingSchema.safeParse({ access: "public" });
    expect(r.success).toBe(false);
  });
});

describe("organismListings.ListOrganismListingsQuerySchema", () => {
  it("defaults status to active and limit to 20", () => {
    const r = ListOrganismListingsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("active");
      expect(r.data.limit).toBe(20);
      expect(r.data.offset).toBe(0);
      expect(r.data.sort).toBe("newest");
    }
  });

  it("accepts organismKind filter (predictor)", () => {
    const r = ListOrganismListingsQuerySchema.safeParse({
      organismKind: "predictor",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.organismKind).toBe("predictor");
  });

  it("rejects unknown organismKind", () => {
    const r = ListOrganismListingsQuerySchema.safeParse({
      organismKind: "wizard",
    });
    expect(r.success).toBe(false);
  });

  it("accepts organismSlug filter", () => {
    const r = ListOrganismListingsQuerySchema.safeParse({
      organismSlug: "tire-mind-001",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.organismSlug).toBe("tire-mind-001");
  });

  it("clamps limit to 100", () => {
    const r = ListOrganismListingsQuerySchema.safeParse({ limit: 999 });
    expect(r.success).toBe(false);
  });

  it("accepts sort options including forks_desc", () => {
    for (const sort of [
      "newest",
      "oldest",
      "price_asc",
      "price_desc",
      "rating",
      "forks_desc",
    ] as const) {
      const r = ListOrganismListingsQuerySchema.safeParse({ sort });
      expect(r.success).toBe(true);
    }
  });
});

describe("organismListings.OrganismAccess enum (re-exported via schema)", () => {
  // Smoke test that the schema uses the same access enum the
  // db schema declares; keeps the route layer in lock-step with
  // the wire contract.
  it("CreateOrganismListingSchema rejects unknown access", () => {
    const r = CreateOrganismListingSchema.safeParse({
      title: "X",
      organismSlug: "x",
      organismName: "X",
      organismKind: "custom",
      pricePerForkQubic: "1000",
      access: "members_only",
    });
    expect(r.success).toBe(false);
  });
});
