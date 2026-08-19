/**
 * ID / ULID helper unit tests.
 */

import { describe, it, expect } from "vitest";
import { uid, workId, workerId, slugify, slugSuffix } from "../lib/ids.js";
import { WorkIdSchema, WorkerIdSchema } from "../types/work-item.js";

describe("id helpers", () => {
  it("uid() returns a valid UUID v4", () => {
    const u = uid();
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("workId() returns a wki_-prefixed ULID-shaped string", () => {
    const w = workId();
    expect(w).toMatch(/^wki_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(WorkIdSchema.safeParse(w).success).toBe(true);
  });

  it("workerId() returns a wrk_-prefixed ULID-shaped string", () => {
    const w = workerId();
    expect(w).toMatch(/^wrk_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(WorkerIdSchema.safeParse(w).success).toBe(true);
  });

  it("two workId() calls return different strings", () => {
    const a = workId();
    const b = workId();
    expect(a).not.toBe(b);
  });

  it("slugify lowercases and kebab-cases", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("  trim me  ")).toBe("trim-me");
    expect(slugify("multiple---dashes")).toBe("multiple-dashes");
  });

  it("slugSuffix returns the requested length of hex", () => {
    const s = slugSuffix(8);
    expect(s).toHaveLength(8);
    expect(s).toMatch(/^[0-9a-z]+$/);
  });
});
