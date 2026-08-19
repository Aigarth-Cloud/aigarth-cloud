/**
 * Trinary model backend — pluggable interface (Phase 19C.3).
 *
 * Every LLM-backed trinary decision flows through a `TrinaryBackend`.
 * The default is the deterministic hash stub (preserves the Phase 18B
 * behavior, no model required). The production path is the OpenAI-
 * compatible client, which works with OpenAI, Anthropic-via-proxy,
 * Ollama, LM Studio, vLLM, and any other OpenAI-shape server.
 *
 * Contract:
 *   - `invokeTrinary()` returns a parsed trinary output or throws
 *     `TrinaryBackendError`. Callers MUST handle the throw and fall
 *     back to a neutral `state: 0` envelope — never let a model
 *     failure block the caller.
 *   - Backends are responsible for their own timeout. If a backend
 *     cannot honor a timeout, it should be wrapped at the call site.
 *   - The `system` prompt comes from the ANN's `trinaryPromptTemplate`
 *     (per-ANN, owned by the ANN producer). The `user` payload is the
 *     JSON-stringified input. The model is asked to emit a single
 *     JSON object — see `parser.ts` for the exact contract.
 *
 * Adding a new backend:
 *   1. Implement the `TrinaryBackend` interface.
 *   2. Register it in `backends/index.ts`.
 *   3. Add a config switch in `config/index.ts` (env var).
 *   4. Add tests in `tests/backends.test.ts`.
 */

import type { Reversibility, TimeHorizon, TrinaryState } from "@aigarth/trinary";

/** Parsed output of a trinary backend call. */
export interface TrinaryOutput {
  /** The trinary decision. Must be one of -1, 0, 1. */
  state: TrinaryState;
  /**
   * Calibrated confidence in [0, 1]. The backend is responsible for
   * clamping — the parser will clamp defensively, but backends should
   * not emit out-of-range values.
   */
  confidence: number;
  /**
   * Short, human-readable explanation. Max 8000 chars (envelope
   * schema limit). Backends should aim for 1-3 sentences.
   */
  reasoning: string;
  /**
   * Optional short verb from the trinary ontology. Used by
   * `recommended_action` in the envelope. Max 120 chars.
   */
  recommended_action?: string;
}

/**
 * Input to a trinary backend call.
 *
 * `reversibility` and `time_horizon` are passed in so the model can
 * produce a state that respects the caller's intent (e.g. lean toward
 * 0 when reversibility is "irreversible").
 */
export interface TrinaryInput {
  /** Per-ANN system prompt, from `anns.trinary_prompt_template`. */
  systemPrompt: string;
  /** Caller-supplied observation context (opaque JSON). */
  input: Record<string, unknown>;
  /** ANN id, for context. */
  annId: string;
  /** ANN semver, for context. */
  annVersion: string;
  /** Optional override of the ANN's default reversibility. */
  reversibility?: Reversibility;
  /** Optional override of the ANN's default time horizon. */
  timeHorizon?: TimeHorizon;
}

/** Backend identity — used in audit logs and decision metadata. */
export interface TrinaryBackendInfo {
  /** Short backend id (e.g. "stub", "openai_compatible"). */
  id: string;
  /** Human-readable model name (e.g. "llama3.1", "gpt-4o-mini", "stub-v1"). */
  model: string;
  /** Backend version, for cache-busting and rollbacks. */
  version: string;
}

/** The backend contract. */
export interface TrinaryBackend {
  info(): TrinaryBackendInfo;
  invokeTrinary(input: TrinaryInput): Promise<TrinaryOutput>;
}

/** Thrown by a backend when it cannot produce a valid trinary output. */
export class TrinaryBackendError extends Error {
  public override readonly cause?: unknown;
  public readonly backendId?: string;

  constructor(
    message: string,
    cause?: unknown,
    backendId?: string,
  ) {
    super(message);
    this.name = "TrinaryBackendError";
    this.cause = cause;
    this.backendId = backendId;
  }
}
