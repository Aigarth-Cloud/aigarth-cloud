/**
 * Tests for the executions service (route-facing layer).
 *
 * Focuses on the pure helpers + the publishAnnStub behaviour, which
 * is the deterministic part of the service that doesn't need a
 * Postgres connection. The DB-touching paths are covered by the
 * existing route integration tests in `tests/routes.test.ts` once
 * the migration has been applied.
 */

import { describe, it, expect } from "vitest";
import { publishAnnStub, AnnNotFoundForExecutionError, AnnManifestMismatchError } from "../executions.js";

describe("publishAnnStub", () => {
  it("returns a not_configured response (publishing is deferred)", async () => {
    const r = await publishAnnStub("btc-direction-predictor", {
      version: "v1.0.0",
      repoOwner: "aigarth-cloud",
      repoName: "ann-btc-direction-predictor",
      commitSha: "0".repeat(40),
    });
    expect(r.status).toBe("not_configured");
    expect(r.message).toMatch(/GitHub publishing is deferred/);
  });
});

describe("error classes", () => {
  it("AnnNotFoundForExecutionError carries the slug", () => {
    const e = new AnnNotFoundForExecutionError("nope");
    expect(e.name).toBe("AnnNotFoundForExecutionError");
    expect(e.message).toBe("ANN 'nope' not found.");
  });
  it("AnnManifestMismatchError carries both hashes", () => {
    const e = new AnnManifestMismatchError("aaa", "bbb");
    expect(e.name).toBe("AnnManifestMismatchError");
    expect(e.message).toMatch(/aaa/);
    expect(e.message).toMatch(/bbb/);
  });
});
