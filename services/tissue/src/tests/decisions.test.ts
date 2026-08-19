/**
 * Tests for the decisions service schemas.
 *
 * DB- and HTTP-bound happy paths (decideTissue) are covered by the
 * docker-based smoke tests in CI. This file focuses on the
 * zod schema validation + error class shape.
 */

import { describe, it, expect } from "vitest";
import {
  DecideRequestSchema,
  ListDecisionsQuerySchema,
  AllMembersFailedError,
} from "../services/decisions.js";

describe("decisions schemas — DecideRequestSchema", () => {
  it("accepts a minimal request", () => {
    const r = DecideRequestSchema.parse({ input: { lead_id: "L42" } });
    expect(r.input).toEqual({ lead_id: "L42" });
    expect(r.reversibility).toBeUndefined();
    expect(r.time_horizon).toBeUndefined();
    expect(r.request_id).toBeUndefined();
  });

  it("accepts a fully populated request", () => {
    const r = DecideRequestSchema.parse({
      request_id: "req_abc",
      input: { x: 1 },
      reversibility: "irreversible",
      time_horizon: "immediate",
    });
    expect(r.reversibility).toBe("irreversible");
    expect(r.time_horizon).toBe("immediate");
  });

  it("defaults input to an empty object", () => {
    expect(DecideRequestSchema.parse({}).input).toEqual({});
  });

  it("rejects an unknown reversibility", () => {
    expect(() => DecideRequestSchema.parse({ reversibility: "permanent" })).toThrow();
  });

  it("rejects an unknown time_horizon", () => {
    expect(() => DecideRequestSchema.parse({ time_horizon: "forever" })).toThrow();
  });
});

describe("decisions schemas — ListDecisionsQuerySchema", () => {
  it("accepts an empty query with defaults", () => {
    const q = ListDecisionsQuerySchema.parse({});
    expect(q.limit).toBe(20);
    expect(q.state).toBeUndefined();
    expect(q.before).toBeUndefined();
  });

  it("rejects an out-of-range state", () => {
    expect(() => ListDecisionsQuerySchema.parse({ state: 2 })).toThrow();
    expect(() => ListDecisionsQuerySchema.parse({ state: -2 })).toThrow();
  });

  it("rejects an invalid before cursor", () => {
    expect(() => ListDecisionsQuerySchema.parse({ before: "not-a-date" })).toThrow();
  });
});

describe("AllMembersFailedError", () => {
  it("carries the ignored list and uses it in the message", () => {
    const ignored = [
      { ann_slug: "a", reason: "404" },
      { ann_slug: "b", reason: "timeout" },
    ];
    const e = new AllMembersFailedError(ignored);
    expect(e.name).toBe("AllMembersFailedError");
    expect(e.ignored).toEqual(ignored);
    expect(e.message).toContain("2");
  });
});
