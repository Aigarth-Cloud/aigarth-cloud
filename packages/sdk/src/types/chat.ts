import type {
  ChatMessage,
  FinishReason,
  FunctionDefinition,
  ResponseFormat,
  StreamOptions,
  Usage,
} from "./common.js";

/**
 * POST /v1/chat/completions — request body.
 *
 * Standard OpenAI surface. Aigarth adds optional `qubic_paid` to indicate
 * the request should be billed to a Qubic wallet rather than fiat credit.
 */
export interface ChatCompletionCreateParams {
  /** Model id, e.g. "aigarth-meridian-1" or "gpt-4o". */
  model: string;
  messages: ChatMessage[];
  /** Sampling temperature. Defaults to 1. */
  temperature?: number | null;
  /** Nucleus sampling. Defaults to 1. */
  top_p?: number | null;
  /** Number of choices to return. Defaults to 1. */
  n?: number | null;
  /** Stream responses as SSE. */
  stream?: boolean | null;
  /** Stop sequences. */
  stop?: string | string[] | null;
  /** Max tokens to generate. */
  max_tokens?: number | null;
  /** Presence penalty. */
  presence_penalty?: number | null;
  /** Frequency penalty. */
  frequency_penalty?: number | null;
  /** Logit bias. */
  logit_bias?: Record<string, number> | null;
  /** User identifier for abuse detection. */
  user?: string;
  /** Response format. */
  response_format?: ResponseFormat;
  /** Seed for deterministic sampling (best effort). */
  seed?: number | null;
  /** Tools (function calling). */
  tools?: Array<{ type: "function"; function: FunctionDefinition }>;
  /** Tool choice. */
  tool_choice?:
    | "none"
    | "auto"
    | "required"
    | { type: "function"; function: { name: string } };
  /** Whether to stream usage updates. */
  stream_options?: StreamOptions;
  /** Logprobs. */
  logprobs?: boolean | null;
  /** Top logprobs. */
  top_logprobs?: number | null;
  /** Aigarth extension: bill to Qubic wallet. */
  qubic_paid?: boolean;
  /** Aigarth extension: prefer routing to a specific ANN by id. */
  preferred_ann?: string;
  /** Aigarth extension: which region(s) to use. */
  regions?: string[];
  /**
   * Phase 18C — Aigarth extension. Selects the response protocol.
   *   - "openai" (default): standard OpenAI chat completion (text).
   *   - "trinary": the response is an IntentEnvelope, framed inside
   *     the OpenAI chat shape. The envelope is available in three
   *     places on the response: `choices[0].message.content` (as a
   *     JSON string), `choices[0].message.aigarth_intent` (typed),
   *     and as a streaming `aigarth_intent_delta` on each SSE chunk.
   *
   * Distinct from OpenAI's `response_format` (which is a separate
   * field). See ADR 003.
   */
  intent?: "openai" | "trinary";
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: FinishReason | null;
  logprobs?: unknown;
}

export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
  /** Aigarth extension: which ANN(s) actually served the request. */
  served_by?: { ann_id: string; ann_version: string; region: string }[];
  /** Aigarth extension: request id for tracing. */
  request_id?: string;
  /** Aigarth extension: Phase 18C — the trinary decision id (when `intent: "trinary"`). */
  decision_id?: string;
}

export interface ChatCompletionChunkDelta {
  role?: "assistant";
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
  /**
   * Phase 18C — Aigarth extension. Present on the first chunk of a
   * trinary-mode stream; carries the full IntentEnvelope. The chunk
   * with `finish_reason: "stop"` has the `decision_id` and
   * `request_id` on the chunk object itself.
   */
  aigarth_intent_delta?: import("./aigarth.js").IntentEnvelopeLike;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: FinishReason | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: Usage;
  /** Aigarth extension: Phase 18C — the trinary decision id (when `intent: "trinary"`). */
  decision_id?: string;
  /** Aigarth extension: Phase 18C — the trinary request id (when `intent: "trinary"`). */
  request_id?: string;
}
