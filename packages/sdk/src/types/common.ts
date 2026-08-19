/**
 * Shared value types used across resources.
 */

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessageContentPartText {
  type: "text";
  text: string;
}

export interface ChatMessageContentPartImage {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
}

export type ChatMessageContentPart =
  | ChatMessageContentPartText
  | ChatMessageContentPartImage;

export type ChatMessageContent = string | ChatMessageContentPart[];

export interface ChatMessage {
  role: Role;
  content: ChatMessageContent | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  function_call?: { name: string; arguments: string };
  /**
   * Phase 18C — Aigarth extension. Present on the assistant
   * message of a `intent: "trinary"` chat completion. Carries
   * the typed IntentEnvelope so SDK consumers can read the
   * state, confidence, authority, and signature without
   * re-parsing `content` as JSON. The `content` field still
   * holds the same envelope as a JSON string, for OpenAI
   * clients that don't know about the extension.
   */
  aigarth_intent?: import("./aigarth.js").IntentEnvelopeLike;
}

export interface ResponseFormat {
  type: "text" | "json_object" | "json_schema";
  json_schema?: {
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface StreamOptions {
  include_usage?: boolean;
}

/** Reason the model stopped generating. */
export type FinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "function_call";

/** Token usage breakdown for a request. */
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** Aigarth extension: breakdown by ANNs used (when applicable). */
  by_ann?: Record<string, number>;
}

/** Standard error envelope (OpenAI-compatible). */
export interface ErrorEnvelope {
  error: {
    message: string;
    type: string;
    param?: string | null;
    code?: string | null;
  };
}
