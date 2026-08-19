/**
 * Tests for the connector framework (Phase 19B.5).
 *
 * The HTTP API connector has no pure-logic surface to test (the
 * runtime requires a real fetch + dataset service), but the
 * config schema validation is critical and tested here.
 */

import { describe, it, expect } from "vitest";
import { HttpApiConfigSchema } from "../connectors/http-api.js";

describe("HttpApiConfigSchema", () => {
  it("accepts a minimal config", () => {
    const out = HttpApiConfigSchema.parse({ url: "https://example.com/data.csv" });
    expect(out.url).toBe("https://example.com/data.csv");
  });

  it("accepts a full config", () => {
    const out = HttpApiConfigSchema.parse({
      url: "https://api.example.com/dataset",
      auth_header: "Bearer sk-12345",
      content_type: "text/csv",
      poll_interval_seconds: 3600,
    });
    expect(out.auth_header).toBe("Bearer sk-12345");
    expect(out.poll_interval_seconds).toBe(3600);
  });

  it("rejects an invalid URL", () => {
    expect(() => HttpApiConfigSchema.parse({ url: "not-a-url" })).toThrow();
  });

  it("rejects a missing URL", () => {
    expect(() => HttpApiConfigSchema.parse({})).toThrow();
  });

  it("rejects an absurdly long auth header", () => {
    expect(() =>
      HttpApiConfigSchema.parse({ url: "https://x.com", auth_header: "x".repeat(501) }),
    ).toThrow();
  });

  it("rejects a poll interval over 1 day", () => {
    expect(() =>
      HttpApiConfigSchema.parse({
        url: "https://x.com",
        poll_interval_seconds: 86_401,
      }),
    ).toThrow();
  });
});
