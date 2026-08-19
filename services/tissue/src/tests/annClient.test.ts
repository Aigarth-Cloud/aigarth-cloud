/**
 * Tests for the ANN client.
 *
 * - URL building handles trailing slashes, special chars in slugs
 * - buildAnnInput maps the tissue shape to the ANN /decide shape
 * - callAnnDecide never throws; returns discriminated result
 *   (tested via mocked fetch; the real network path is covered
 *   by docker-based integration tests)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildAnnDecideUrl,
  buildAnnInput,
  callAnnDecide,
} from "../services/annClient.js";

describe("annClient — buildAnnDecideUrl", () => {
  it("builds the URL with no trailing slash on the base", () => {
    expect(buildAnnDecideUrl("http://ann:7006", "ann_x")).toBe(
      "http://ann:7006/v1/anns/ann_x/decide",
    );
  });

  it("strips a trailing slash on the base", () => {
    expect(buildAnnDecideUrl("http://ann:7006/", "ann_x")).toBe(
      "http://ann:7006/v1/anns/ann_x/decide",
    );
  });

  it("encodes special characters in the slug", () => {
    expect(buildAnnDecideUrl("http://ann:7006", "ann sales/v1")).toBe(
      "http://ann:7006/v1/anns/ann%20sales%2Fv1/decide",
    );
  });
});

describe("annClient — buildAnnInput", () => {
  it("maps the tissue input shape to the ANN /decide shape", () => {
    const out = buildAnnInput(
      { lead_id: "L42", score: 0.91 },
      { request_id: "req_abc", reversibility: "soft", time_horizon: "session" },
    );
    expect(out.request_id).toBe("req_abc");
    expect(out.input).toEqual({ lead_id: "L42", score: 0.91 });
    expect(out.reversibility).toBe("soft");
    expect(out.time_horizon).toBe("session");
  });

  it("passes through undefined for unset passthroughs", () => {
    const out = buildAnnInput({ x: 1 }, {});
    expect(out.request_id).toBeUndefined();
    expect(out.reversibility).toBeUndefined();
    expect(out.time_horizon).toBeUndefined();
  });
});

describe("annClient — callAnnDiscide (mocked fetch)", () => {
  const originalFetch = globalThis.fetch;
  const originalAbort = AbortController;
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";
    process.env.JWT_SECRET = "test-secret-for-routes-only-do-not-use-elsewhere-please";
    process.env.ANN_SERVICE_URL = "http://ann.test:7006";
    process.env.TISSUE_DECISION_TIMEOUT_MS = "1000";
    // Re-import the config so the new env values are picked up.
    vi.resetModules();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns ok=true with a parsed envelope on a 2xx response", async () => {
    const envelope = {
      schema_version: 1,
      ann_id: "ann_x",
      ann_version: "1.0.0",
      state: 1,
      confidence: 0.9,
      authority: 0.5,
      reasoning: "ok",
      supporting_signals: [],
      required_future_signals: [],
      reversibility: "soft",
      time_horizon: "session",
      signature: "a3f4b2c1d0",
      issued_at: "2026-08-04T12:00:00.000Z",
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({ decision_id: "dec_1", envelope, persisted: true }),
    });

    const result = await callAnnDecide("ann_x", "test-jwt", {
      request_id: "req_1",
      input: { x: 1 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.decision_id).toBe("dec_1");
      expect(result.response.envelope.state).toBe(1);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns ok=false on a 4xx response with the body excerpt", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "ANN not found",
      json: async () => ({}),
    });
    const result = await callAnnDecide("ann_x", "test-jwt", { input: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("404");
      expect(result.reason).toContain("ANN not found");
    }
  });

  it("returns ok=false on a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await callAnnDecide("ann_x", "test-jwt", { input: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ECONNREFUSED");
    }
  });

  it("forwards the Bearer token and the JSON body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({
        decision_id: "dec_1",
        envelope: {
          schema_version: 1,
          ann_id: "ann_x",
          ann_version: "1.0.0",
          state: 0,
          confidence: 0.5,
          authority: 0.5,
          reasoning: "",
          supporting_signals: [],
          required_future_signals: [],
          reversibility: "advisory",
          time_horizon: "session",
          signature: "00",
          issued_at: "2026-08-04T12:00:00.000Z",
        },
        persisted: true,
      }),
    });
    await callAnnDecide("ann_x", "the-jwt-token", {
      request_id: "req_1",
      input: { hello: "world" },
    });
    const [calledUrl, calledInit] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe("http://ann.test:7006/v1/anns/ann_x/decide");
    expect(calledInit.method).toBe("POST");
    const headers = calledInit.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer the-jwt-token");
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(calledInit.body)).toEqual({
      request_id: "req_1",
      input: { hello: "world" },
    });
  });
});
