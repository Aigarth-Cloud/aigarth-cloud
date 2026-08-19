/**
 * Tissue licensing — Phase 18E tests.
 *
 *   Schema validation + checkAccess reasoning logic (no DB).
 */

import { describe, it, expect } from "vitest";
import { GrantLicenseSchema } from "../services/licenses.js";

describe("licenses.GrantLicenseSchema", () => {
  it("accepts a user-only grant", () => {
    const r = GrantLicenseSchema.safeParse({
      granteeUserId: "00000000-0000-0000-0000-000000000001",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.source).toBe("owner_grant");
  });

  it("accepts an org-only grant", () => {
    const r = GrantLicenseSchema.safeParse({
      granteeOrgId: "00000000-0000-0000-0000-000000000002",
      source: "marketplace_purchase",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a grant with no grantee", () => {
    const r = GrantLicenseSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects a bad uuid", () => {
    const r = GrantLicenseSchema.safeParse({ granteeUserId: "not-a-uuid" });
    expect(r.success).toBe(false);
  });

  it("rejects bad max_decisions", () => {
    const r = GrantLicenseSchema.safeParse({
      granteeUserId: "00000000-0000-0000-0000-000000000001",
      maxDecisions: "abc",
    });
    expect(r.success).toBe(false);
  });

  it("accepts expiresAt as ISO string", () => {
    const r = GrantLicenseSchema.safeParse({
      granteeUserId: "00000000-0000-0000-0000-000000000001",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });

  it("accepts all standard source values", () => {
    for (const source of ["owner_grant", "marketplace_purchase", "trial", "voucher"]) {
      const r = GrantLicenseSchema.safeParse({
        granteeUserId: "00000000-0000-0000-0000-000000000001",
        source,
      });
      expect(r.success).toBe(true);
    }
  });
});
