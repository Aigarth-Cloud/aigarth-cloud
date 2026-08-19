/**
 * Tests for the tissue service's schemas and error classes.
 *
 * DB-bound happy paths (createTissue, listTissues, addMember) are
 * covered by the docker-based smoke tests in CI. This file
 * focuses on:
 *  - Schema validation
 *  - Error class shape
 *  - Cross-field constraints (e.g. authority range, role enum)
 */

import { describe, it, expect } from "vitest";
import {
  CreateTissueSchema,
  UpdateTissueSchema,
  AddMemberSchema,
  ListQuerySchema,
  ListMembersQuerySchema,
  TissueNotFoundError,
  TissueNotActiveError,
  TissueNoMembersError,
  TissueMemberLimitError,
  TissueDuplicateMemberError,
} from "../services/tissues.js";

describe("tissue schemas — CreateTissueSchema", () => {
  it("accepts a minimal tissue with a weighted_majority policy", () => {
    const r = CreateTissueSchema.parse({
      name: "Executive Tissue",
      policy: { kind: "weighted_majority", threshold: 0.5 },
    });
    expect(r.name).toBe("Executive Tissue");
    expect(r.policy.kind).toBe("weighted_majority");
    expect(r.visibility).toBe("public");
    expect(r.metadata).toEqual({});
  });

  it("accepts a veto_aware policy", () => {
    const r = CreateTissueSchema.parse({
      name: "Veto Aware",
      policy: { kind: "veto_aware", threshold: 0.4 },
    });
    expect(r.policy.kind).toBe("veto_aware");
  });

  it("accepts an unanimous policy (no extra fields)", () => {
    const r = CreateTissueSchema.parse({
      name: "Strict",
      policy: { kind: "unanimous" },
    });
    expect(r.policy.kind).toBe("unanimous");
  });

  it("accepts a short_circuit policy (no extra fields)", () => {
    const r = CreateTissueSchema.parse({
      name: "Fast Path",
      policy: { kind: "short_circuit" },
    });
    expect(r.policy.kind).toBe("short_circuit");
  });

  it("rejects an unknown policy kind", () => {
    expect(() =>
      CreateTissueSchema.parse({
        name: "X",
        policy: { kind: "bayesian", threshold: 0.5 },
      }),
    ).toThrow();
  });

  it("rejects a weighted_majority with non-positive threshold", () => {
    expect(() =>
      CreateTissueSchema.parse({
        name: "X",
        policy: { kind: "weighted_majority", threshold: 0 },
      }),
    ).toThrow();
  });

  it("rejects an empty name", () => {
    expect(() =>
      CreateTissueSchema.parse({
        name: "",
        policy: { kind: "unanimous" },
      }),
    ).toThrow();
  });
});

describe("tissue schemas — AddMemberSchema", () => {
  it("accepts a minimal member", () => {
    const m = AddMemberSchema.parse({ ann_slug: "ann_x" });
    expect(m.role).toBe("voting");
    expect(m.authority_weight).toBe(0.5);
    expect(m.position).toBe(0);
  });

  it("accepts a fully populated member", () => {
    const m = AddMemberSchema.parse({
      ann_slug: "ann_y",
      ann_id: "00000000-0000-0000-0000-000000000001",
      role: "veto",
      authority_weight: 0.8,
      position: 3,
    });
    expect(m.role).toBe("veto");
    expect(m.ann_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(m.authority_weight).toBe(0.8);
    expect(m.position).toBe(3);
  });

  it("rejects an unknown role", () => {
    expect(() => AddMemberSchema.parse({ ann_slug: "x", role: "judge" })).toThrow();
  });

  it("rejects an out-of-range authority_weight", () => {
    expect(() => AddMemberSchema.parse({ ann_slug: "x", authority_weight: 1.5 })).toThrow();
    expect(() => AddMemberSchema.parse({ ann_slug: "x", authority_weight: -0.1 })).toThrow();
  });
});

describe("tissue schemas — ListQuerySchema", () => {
  it("accepts an empty query with defaults", () => {
    const q = ListQuerySchema.parse({});
    expect(q.status).toBe("active");
    expect(q.visibility).toBeUndefined();
    expect(q.sort).toBe("newest");
    expect(q.limit).toBe(20);
    expect(q.offset).toBe(0);
  });

  it("filters by policy_kind", () => {
    const q = ListQuerySchema.parse({ policy_kind: "veto_aware" });
    expect(q.policy_kind).toBe("veto_aware");
  });

  it("rejects an unknown policy_kind", () => {
    expect(() => ListQuerySchema.parse({ policy_kind: "bayesian" })).toThrow();
  });
});

describe("tissue error classes", () => {
  it("TissueNotFoundError carries the id-or-slug", () => {
    const e = new TissueNotFoundError("tissue_x");
    expect(e.name).toBe("TissueNotFoundError");
    expect(e.message).toContain("tissue_x");
  });

  it("TissueNotActiveError names the current status", () => {
    const e = new TissueNotActiveError("tissue_x", "draft");
    expect(e.name).toBe("TissueNotActiveError");
    expect(e.message).toContain("draft");
  });

  it("TissueNoMembersError asks the caller to add a member", () => {
    const e = new TissueNoMembersError("tissue_x");
    expect(e.name).toBe("TissueNoMembersError");
    expect(e.message.toLowerCase()).toContain("member");
  });

  it("TissueMemberLimitError carries the limit", () => {
    const e = new TissueMemberLimitError("tissue_x", 20);
    expect(e.name).toBe("TissueMemberLimitError");
    expect(e.message).toContain("20");
  });

  it("TissueDuplicateMemberError names the conflicting slug", () => {
    const e = new TissueDuplicateMemberError("tissue_x", "ann_y");
    expect(e.name).toBe("TissueDuplicateMemberError");
    expect(e.message).toContain("ann_y");
  });
});
