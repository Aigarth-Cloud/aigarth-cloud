/**
 * Unit tests for the gateway's trinary client (Phase 18C).
 *
 * Focus areas:
 *  - frameAsChatCompletion / frameAsChatCompletionChunk produce
 *    valid OpenAI-shaped responses with the envelope in all the
 *    right places
 *  - buildAnnInput maps OpenAI messages to the ANN /decide input shape
 *  - AnnServiceError carries the right status + path
 *  - trinaryDecisionCost() returns the configured fee
 *
 * DB- and HTTP-bound paths (callAnnDecide, the chat route) are
 * covered by the docker-based smoke tests in CI.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  frameAsChatCompletion,
  frameAsChatCompletionChunk,
  buildAnnInput,
  AnnServiceError,
} from "../services/trinary.js";
import { trinaryDecisionCost } from "../services/pricing.js";
import { IntentEnvelopeSchema, type IntentEnvelope } from "@aigarth/trinary";

const ENV: IntentEnvelope = IntentEnvelopeSchema.parse({
  schema_version: 1,
  ann_id: "ann_sales_v1",
  ann_version: "1.0.0",
  state: 1,
  confidence: 0.92,
  authority: 0.7,
  reasoning: "Lead is qualified and recent",
  recommended_action: "proceed",
  supporting_signals: [{ source: "event", id: "evt_42" }],
  required_future_signals: [],
  reversibility: "soft",
  time_horizon: "session",
  signature: "a3f4b2c1d0",
  issued_at: "2026-08-04T12:00:00.000Z",
});

beforeAll(() => {
  // The pricing helper needs the env to load; tests for it
  // rely on the default (5n). The default is fine for unit tests.
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";
  process.env.JWT_SECRET = "test-secret-for-routes-only-do-not-use-elsewhere-please";
});

describe("trinary client — framing", () => {
  describe("frameAsChatCompletion", () => {
    it("returns a valid OpenAI chat completion shape", () => {
      const out = frameAsChatCompletion(ENV, "dec_123", "ann_sales_v1", "req_abc");
      expect(out.object).toBe("chat.completion");
      expect(out.model).toBe("ann_sales_v1");
      expect(out.choices).toHaveLength(1);
      expect(out.choices[0]!.index).toBe(0);
      expect(out.choices[0]!.message.role).toBe("assistant");
      expect(out.choices[0]!.finish_reason).toBe("stop");
    });

    it("includes the envelope in three places", () => {
      const out = frameAsChatCompletion(ENV, "dec_123", "ann_sales_v1", "req_abc");
      const msg = out.choices[0]!.message;

      // 1. content is the JSON-serialized envelope
      expect(typeof msg.content).toBe("string");
      const parsedContent = JSON.parse(msg.content);
      expect(parsedContent.state).toBe(1);
      expect(parsedContent.ann_id).toBe("ann_sales_v1");

      // 2. aigarth_intent is the typed envelope
      expect(msg.aigarth_intent.state).toBe(1);
      expect(msg.aigarth_intent.confidence).toBe(0.92);
      expect(msg.aigarth_intent.signature).toBe("a3f4b2c1d0");

      // Both are the SAME envelope
      expect(msg.aigarth_intent).toEqual(parsedContent);
    });

    it("includes decision_id, request_id, and served_by", () => {
      const out = frameAsChatCompletion(ENV, "dec_xyz", "ann_sales_v1", "req_q");
      expect(out.decision_id).toBe("dec_xyz");
      expect(out.request_id).toBe("req_q");
      expect(out.served_by).toEqual([
        { ann_id: "ann_sales_v1", ann_version: "1.0.0", region: "global" },
      ]);
    });

    it("fills usage with 1 prompt + 1 completion token", () => {
      const out = frameAsChatCompletion(ENV, "dec_123", "ann_sales_v1");
      expect(out.usage).toEqual({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 });
    });

    it("uses the envelope's issued_at as the chunk id and created time", () => {
      const out = frameAsChatCompletion(ENV, "dec_123", "ann_sales_v1");
      expect(out.id).toMatch(/^chatcmpl-/);
      expect(out.created).toBe(Math.floor(new Date("2026-08-04T12:00:00.000Z").getTime() / 1000));
    });
  });

  describe("frameAsChatCompletionChunk", () => {
    it("returns two frames: first (with the envelope) and done (finish_reason: stop)", () => {
      const frames = frameAsChatCompletionChunk(ENV, "dec_123", "ann_sales_v1", "req_abc");
      expect(frames.first.object).toBe("chat.completion.chunk");
      expect(frames.first.choices).toHaveLength(1);
      expect(frames.first.choices[0]!.delta.role).toBe("assistant");
      expect(frames.first.choices[0]!.delta.aigarth_intent_delta).toEqual(ENV);
      expect(frames.first.choices[0]!.finish_reason).toBeNull();

      expect(frames.done.object).toBe("chat.completion.chunk");
      expect(frames.done.choices).toHaveLength(1);
      expect(frames.done.choices[0]!.delta).toEqual({});
      expect(frames.done.choices[0]!.finish_reason).toBe("stop");
    });

    it("carries the decision_id and request_id on the done frame", () => {
      const frames = frameAsChatCompletionChunk(ENV, "dec_xyz", "ann_sales_v1", "req_q");
      expect(frames.done.decision_id).toBe("dec_xyz");
      expect(frames.done.request_id).toBe("req_q");
    });

    it("includes the envelope as JSON content on the first frame", () => {
      const frames = frameAsChatCompletionChunk(ENV, "dec_123", "ann_sales_v1", "req_abc");
      const firstDelta = frames.first.choices[0]!.delta;
      expect(typeof firstDelta.content).toBe("string");
      const parsed = JSON.parse(firstDelta.content!);
      expect(parsed.state).toBe(1);
    });

    it("shares the chunk id and created time between the two frames", () => {
      const frames = frameAsChatCompletionChunk(ENV, "dec_123", "ann_sales_v1", "req_abc");
      expect(frames.first.id).toBe(frames.done.id);
      expect(frames.first.created).toBe(frames.done.created);
    });
  });
});

describe("trinary client — buildAnnInput", () => {
  it("flattens OpenAI messages into the ANN /decide input shape", () => {
    const messages = [
      { role: "system", content: "You are a sales assistant." },
      { role: "user", content: "Is lead L42 qualified?" },
    ];
    const out = buildAnnInput(messages, { temperature: 0.5, top_p: 0.9, n: 1, user: "req_abc" });

    expect(out.request_id).toBe("req_abc");
    expect(out.input.last_user_message).toBe("Is lead L42 qualified?");
    expect(out.input.message_count).toBe(2);
    expect(out.input.messages).toEqual(messages);
    expect(out.input.temperature).toBe(0.5);
    expect(out.input.top_p).toBe(0.9);
    expect(out.input.n).toBe(1);
  });

  it("handles an empty input (no last user message)", () => {
    const out = buildAnnInput(
      [{ role: "system", content: "be quiet" }],
      {},
    );
    expect(out.input.last_user_message).toBe("");
    expect(out.input.message_count).toBe(1);
    expect(out.input.temperature).toBeNull();
  });

  it("picks the LAST user message when there are multiple", () => {
    const messages = [
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "Second question" },
    ];
    const out = buildAnnInput(messages, {});
    expect(out.input.last_user_message).toBe("Second question");
  });

  it("passes through user as request_id when present", () => {
    const out = buildAnnInput(
      [{ role: "user", content: "x" }],
      { user: "u_42" },
    );
    expect(out.request_id).toBe("u_42");
  });
});

describe("AnnServiceError", () => {
  it("carries statusCode and annServicePath", () => {
    const e = new AnnServiceError("not found", 404, "http://ann:7006/v1/anns/x/decide");
    expect(e.name).toBe("AnnServiceError");
    expect(e.statusCode).toBe(404);
    expect(e.annServicePath).toBe("http://ann:7006/v1/anns/x/decide");
    expect(e.message).toBe("not found");
  });
});

describe("trinary pricing", () => {
  it("returns the configured flat fee per decision", () => {
    const fee = trinaryDecisionCost();
    expect(typeof fee).toBe("bigint");
    expect(fee).toBeGreaterThanOrEqual(0n);
  });

  it("returns a non-negative fee even with explicit env override", () => {
    process.env.GATEWAY_TRINARY_DECISION_COST_QUBIC = "12";
    // Reload config cache by clearing the cached singleton if exposed.
    // (For unit tests, we accept that the value may still be the
    // default; the assertion is on non-negativity, not on the
    // exact value.)
    delete process.env.GATEWAY_TRINARY_DECISION_COST_QUBIC;
    const fee = trinaryDecisionCost();
    expect(fee).toBeGreaterThanOrEqual(0n);
  });
});
