/**
 * Tests for the pluggable trinary backends (Phase 19C.3).
 *
 * Covers:
 *   - Parser: 4 response shapes (pure JSON, JSON-in-fence, embedded,
 *     state-text fallback) + error paths
 *   - Parser: state coercion (number, string, "yes"/"no"/"proceed"/...)
 *   - Parser: confidence clamping (out-of-range, NaN, missing)
 *   - Parser: length clamping on reasoning and recommended_action
 *   - Stub backend: deterministic, all 3 states reachable, in [0.6, 0.99]
 *   - OpenAI-compatible backend: request shape, error mapping (network,
 *     timeout, non-2xx, malformed JSON, no assistant content)
 *   - Backend factory: single-flight cache
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseTrinaryOutput,
  TrinaryParserError,
  StubTrinaryBackend,
  OpenAICompatibleTrinaryBackend,
  __resetTrinaryBackendForTests,
  getTrinaryBackend,
} from "../backends/index.js";
import { TrinaryBackendError } from "../backends/index.js";

// ---------- parseTrinaryOutput ----------

describe("parseTrinaryOutput", () => {
  describe("happy paths", () => {
    it("parses a clean JSON object", () => {
      const out = parseTrinaryOutput(
        '{"state": 1, "confidence": 0.85, "reasoning": "Lead score is high", "recommended_action": "proceed"}',
      );
      expect(out.state).toBe(1);
      expect(out.confidence).toBe(0.85);
      expect(out.reasoning).toBe("Lead score is high");
      expect(out.recommended_action).toBe("proceed");
    });

    it("parses JSON inside a ```json code fence", () => {
      const raw = "Here is my analysis:\n\n```json\n{\"state\": -1, \"confidence\": 0.9, \"reasoning\": \"blocked\"}\n```\n\nDone.";
      const out = parseTrinaryOutput(raw);
      expect(out.state).toBe(-1);
      expect(out.confidence).toBe(0.9);
      expect(out.reasoning).toBe("blocked");
    });

    it("parses JSON inside a ``` code fence (no language hint)", () => {
      const raw = "```\n{\"state\": 0, \"confidence\": 0.6, \"reasoning\": \"unsure\"}\n```";
      const out = parseTrinaryOutput(raw);
      expect(out.state).toBe(0);
      expect(out.confidence).toBe(0.6);
      expect(out.reasoning).toBe("unsure");
    });

    it("parses a JSON object embedded in free text", () => {
      const raw = 'My answer: {"state": 1, "confidence": 0.7, "reasoning": "looks good"} - that is my call.';
      const out = parseTrinaryOutput(raw);
      expect(out.state).toBe(1);
      expect(out.confidence).toBe(0.7);
    });

    it("parses the first balanced JSON object when multiple are present", () => {
      const raw = '{"state": 1, "confidence": 0.5, "reasoning": "first"} then {"state": -1, "confidence": 0.9, "reasoning": "second"}';
      const out = parseTrinaryOutput(raw);
      expect(out.state).toBe(1);
      expect(out.confidence).toBe(0.5);
      expect(out.reasoning).toBe("first");
    });
  });

  describe("state coercion", () => {
    it("coerces state=\"+1\" to 1", () => {
      const out = parseTrinaryOutput('{"state": "+1", "confidence": 0.5, "reasoning": "x"}');
      expect(out.state).toBe(1);
    });

    it("coerces state=\"proceed\" to 1", () => {
      const out = parseTrinaryOutput('{"state": "proceed", "confidence": 0.5, "reasoning": "x"}');
      expect(out.state).toBe(1);
    });

    it("coerces state=\"block\" to -1", () => {
      const out = parseTrinaryOutput('{"state": "block", "confidence": 0.5, "reasoning": "x"}');
      expect(out.state).toBe(-1);
    });

    it("coerces state=\"neutral\" to 0", () => {
      const out = parseTrinaryOutput('{"state": "neutral", "confidence": 0.5, "reasoning": "x"}');
      expect(out.state).toBe(0);
    });

    it("coerces state=0.7 to 1 (positive)", () => {
      const out = parseTrinaryOutput('{"state": 0.7, "confidence": 0.5, "reasoning": "x"}');
      expect(out.state).toBe(1);
    });

    it("coerces state=-0.3 to 0 (neutral)", () => {
      const out = parseTrinaryOutput('{"state": -0.3, "confidence": 0.5, "reasoning": "x"}');
      expect(out.state).toBe(0);
    });
  });

  describe("confidence clamping", () => {
    it("clamps > 1.0 down to 1.0", () => {
      const out = parseTrinaryOutput('{"state": 0, "confidence": 1.5, "reasoning": "x"}');
      expect(out.confidence).toBe(1);
    });

    it("clamps < 0.0 up to 0.0", () => {
      const out = parseTrinaryOutput('{"state": 0, "confidence": -0.5, "reasoning": "x"}');
      expect(out.confidence).toBe(0);
    });

    it("falls back to 0.5 for non-finite or missing", () => {
      expect(parseTrinaryOutput('{"state": 0, "confidence": "high", "reasoning": "x"}').confidence).toBe(0.5);
      expect(parseTrinaryOutput('{"state": 0, "reasoning": "x"}').confidence).toBe(0.5);
      expect(parseTrinaryOutput('{"state": 0, "confidence": null, "reasoning": "x"}').confidence).toBe(0.5);
    });
  });

  describe("length clamping", () => {
    it("truncates reasoning over 8000 chars", () => {
      const long = "x".repeat(9000);
      const out = parseTrinaryOutput(`{"state": 0, "confidence": 0.5, "reasoning": "${long}"}`);
      expect(out.reasoning.length).toBe(8000);
    });

    it("truncates recommended_action over 120 chars", () => {
      const long = "y".repeat(200);
      const out = parseTrinaryOutput(
        `{"state": 0, "confidence": 0.5, "reasoning": "x", "recommended_action": "${long}"}`,
      );
      expect(out.recommended_action?.length).toBe(120);
    });

    it("omits recommended_action when empty string", () => {
      const out = parseTrinaryOutput(
        '{"state": 0, "confidence": 0.5, "reasoning": "x", "recommended_action": ""}',
      );
      expect(out.recommended_action).toBeUndefined();
    });
  });

  describe("text-only fallback", () => {
    it("returns -1 from a sentence starting with 'block'", () => {
      const out = parseTrinaryOutput("Block this transaction. Risk score is high.");
      expect(out.state).toBe(-1);
      expect(out.confidence).toBe(0.5);
    });

    it("returns +1 from a sentence starting with 'proceed'", () => {
      const out = parseTrinaryOutput("Proceed with the action. All signals are green.");
      expect(out.state).toBe(1);
    });

    it("returns neutral from a sentence starting with 'continue'", () => {
      const out = parseTrinaryOutput("Continue observing, no clear signal yet.");
      expect(out.state).toBe(0);
    });

    it("does not match a state verb embedded mid-sentence", () => {
      // The "no" inside "no clear signal" is normal English, not a state
      expect(() => parseTrinaryOutput("just some unrelated prose with no signal")).toThrow(
        TrinaryParserError,
      );
    });
  });

  describe("error paths", () => {
    it("throws when no JSON and no state text", () => {
      expect(() => parseTrinaryOutput("just some unrelated prose with no signal")).toThrow(
        TrinaryParserError,
      );
    });

    it("throws when input is not a string", () => {
      // @ts-expect-error -- testing runtime guard
      expect(() => parseTrinaryOutput(42)).toThrow(TrinaryParserError);
    });

    it("throws when state cannot be coerced", () => {
      expect(() => parseTrinaryOutput('{"state": "maybe-ish", "confidence": 0.5, "reasoning": "x"}')).toThrow(
        TrinaryParserError,
      );
    });
  });
});

// ---------- StubTrinaryBackend ----------

describe("StubTrinaryBackend", () => {
  const backend = new StubTrinaryBackend();

  it("reports its identity", () => {
    const info = backend.info();
    expect(info.id).toBe("stub");
    expect(info.model).toBe("stub-v1");
    expect(info.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("returns one of the three trinary states", async () => {
    for (let i = 0; i < 30; i++) {
      const out = await backend.invokeTrinary({
        systemPrompt: "you decide",
        input: { i },
        annId: "ann_test",
        annVersion: "1.0.0",
      });
      expect([-1, 0, 1]).toContain(out.state);
    }
  });

  it("returns a recommended_action matching the state", async () => {
    for (let i = 0; i < 20; i++) {
      const out = await backend.invokeTrinary({
        systemPrompt: "x",
        input: { i },
        annId: "ann_test",
        annVersion: "1.0.0",
      });
      if (out.state === 1) expect(out.recommended_action).toBe("proceed");
      if (out.state === -1) expect(out.recommended_action).toBe("block");
      if (out.state === 0) expect(out.recommended_action).toBe("continue_observing");
    }
  });

  it("returns confidence in [0.6, 0.99]", async () => {
    for (let i = 0; i < 30; i++) {
      const out = await backend.invokeTrinary({
        systemPrompt: "x",
        input: { i },
        annId: "ann_test",
        annVersion: "1.0.0",
      });
      expect(out.confidence).toBeGreaterThanOrEqual(0.6);
      expect(out.confidence).toBeLessThanOrEqual(0.99);
    }
  });

  it("mentions ANN id in reasoning", async () => {
    const out = await backend.invokeTrinary({
      systemPrompt: "x",
      input: { lead_score: 0.9 },
      annId: "ann_crochet",
      annVersion: "1.0.0",
    });
    expect(out.reasoning).toContain("ann_crochet");
  });
});

// ---------- OpenAICompatibleTrinaryBackend ----------

describe("OpenAICompatibleTrinaryBackend", () => {
  const baseCfg = {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
    timeoutMs: 5000,
    maxTokens: 256,
    temperature: 0.0,
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the right wire shape and parses the response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [
          {
            message: { role: "assistant", content: '{"state": 1, "confidence": 0.9, "reasoning": "ok"}' },
          },
        ],
      }),
    });
    const backend = new OpenAICompatibleTrinaryBackend(baseCfg);
    const out = await backend.invokeTrinary({
      systemPrompt: "decide",
      input: { lead_score: 0.9 },
      annId: "ann_x",
      annVersion: "1.0.0",
    });
    expect(out.state).toBe(1);
    expect(out.confidence).toBe(0.9);
    expect(out.reasoning).toBe("ok");

    // Verify the request shape
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("llama3.1");
    expect(body.temperature).toBe(0.0);
    expect(body.max_tokens).toBe(256);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("decide");
    expect(body.messages[0].content).toContain("JSON object");
    expect(body.messages[1].role).toBe("user");
    const userPayload = JSON.parse(body.messages[1].content);
    expect(userPayload.ann_id).toBe("ann_x");
    expect(userPayload.input.lead_score).toBe(0.9);
  });

  it("sends Authorization header when apiKey is set", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: '{"state": 0, "confidence": 0.5, "reasoning": "x"}' } }],
      }),
    });
    const backend = new OpenAICompatibleTrinaryBackend({ ...baseCfg, apiKey: "sk-test" });
    await backend.invokeTrinary({
      systemPrompt: "x",
      input: {},
      annId: "ann_x",
      annVersion: "1.0.0",
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
  });

  it("throws TrinaryBackendError on HTTP 500", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "boom",
    });
    const backend = new OpenAICompatibleTrinaryBackend(baseCfg);
    await expect(
      backend.invokeTrinary({
        systemPrompt: "x",
        input: {},
        annId: "ann_x",
        annVersion: "1.0.0",
      }),
    ).rejects.toThrow(TrinaryBackendError);
  });

  it("throws TrinaryBackendError on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const backend = new OpenAICompatibleTrinaryBackend(baseCfg);
    await expect(
      backend.invokeTrinary({
        systemPrompt: "x",
        input: {},
        annId: "ann_x",
        annVersion: "1.0.0",
      }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });

  it("throws TrinaryBackendError on timeout", async () => {
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          // Simulate an abort by rejecting with the AbortError name
          const e = new Error("aborted");
          e.name = "AbortError";
          // Don't reject immediately — let the timeout fire first
          setTimeout(() => reject(e), 10);
        }),
    );
    const backend = new OpenAICompatibleTrinaryBackend({ ...baseCfg, timeoutMs: 5 });
    await expect(
      backend.invokeTrinary({
        systemPrompt: "x",
        input: {},
        annId: "ann_x",
        annVersion: "1.0.0",
      }),
    ).rejects.toThrow(/timed out/);
  });

  it("throws TrinaryBackendError on response with no assistant content", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    const backend = new OpenAICompatibleTrinaryBackend(baseCfg);
    await expect(
      backend.invokeTrinary({
        systemPrompt: "x",
        input: {},
        annId: "ann_x",
        annVersion: "1.0.0",
      }),
    ).rejects.toThrow(/no assistant content/);
  });

  it("throws TrinaryBackendError on malformed assistant content", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "totally not json" } }],
      }),
    });
    const backend = new OpenAICompatibleTrinaryBackend(baseCfg);
    await expect(
      backend.invokeTrinary({
        systemPrompt: "x",
        input: {},
        annId: "ann_x",
        annVersion: "1.0.0",
      }),
    ).rejects.toThrow(TrinaryBackendError);
  });

  it("handles JSON-in-fence in the assistant content", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: "assistant",
              content: '```json\n{"state": -1, "confidence": 0.95, "reasoning": "blocked"}\n```',
            },
          },
        ],
      }),
    });
    const backend = new OpenAICompatibleTrinaryBackend(baseCfg);
    const out = await backend.invokeTrinary({
      systemPrompt: "x",
      input: {},
      annId: "ann_x",
      annVersion: "1.0.0",
    });
    expect(out.state).toBe(-1);
    expect(out.confidence).toBe(0.95);
  });
});

// ---------- Backend factory ----------

describe("getTrinaryBackend", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    __resetTrinaryBackendForTests();
    // The config schema requires JWT_SECRET and DATABASE_URL even when
    // the test only exercises the LLM backend factory. Provide a valid
    // pair so the schema check passes.
    process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    delete process.env.ANN_LLM_BACKEND;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    __resetTrinaryBackendForTests();
  });

  it("returns a StubTrinaryBackend by default (no env)", () => {
    const b1 = getTrinaryBackend();
    const b2 = getTrinaryBackend();
    expect(b1).toBe(b2); // single-flight
    expect(b1.info().id).toBe("stub");
  });
});
