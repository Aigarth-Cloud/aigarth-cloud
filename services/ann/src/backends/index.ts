/**
 * Backend factory (Phase 19C.3).
 *
 * Returns a single shared `TrinaryBackend` instance per process,
 * chosen by the `ANN_LLM_BACKEND` env var. The default is `stub`,
 * which is the deterministic hash backend (no model required).
 *
 * For production set:
 *
 *   ANN_LLM_BACKEND=openai_compatible
 *   ANN_LLM_BASE_URL=https://api.openai.com/v1
 *   ANN_LLM_MODEL=gpt-4o-mini
 *   ANN_LLM_API_KEY=sk-...
 *
 * Or for a local Ollama:
 *
 *   ANN_LLM_BACKEND=openai_compatible
 *   ANN_LLM_BASE_URL=http://localhost:11434/v1
 *   ANN_LLM_MODEL=llama3.1
 *
 * The factory is a single-flight cache — calling `getTrinaryBackend()`
 * multiple times returns the same instance, so we don't open multiple
 * HTTP clients or re-parse the config.
 */

import { loadConfig } from "../config/index.js";
import type { TrinaryBackend } from "./types.js";
import { StubTrinaryBackend } from "./stub.js";
import { OpenAICompatibleTrinaryBackend } from "./openai-compatible.js";

let cached: TrinaryBackend | null = null;

export function getTrinaryBackend(): TrinaryBackend {
  if (cached) return cached;
  const cfg = loadConfig();
  switch (cfg.ANN_LLM_BACKEND) {
    case "stub":
      cached = new StubTrinaryBackend();
      break;
    case "openai_compatible":
      cached = new OpenAICompatibleTrinaryBackend({
        baseUrl: cfg.ANN_LLM_BASE_URL,
        model: cfg.ANN_LLM_MODEL,
        apiKey: cfg.ANN_LLM_API_KEY || undefined,
        timeoutMs: cfg.ANN_LLM_TIMEOUT_MS,
        maxTokens: cfg.ANN_LLM_MAX_TOKENS,
        temperature: cfg.ANN_LLM_TEMPERATURE,
      });
      break;
    default: {
      // Should be unreachable — zod's enum check guards this.
      const _exhaustive: never = cfg.ANN_LLM_BACKEND;
      throw new Error(`Unknown LLM backend: ${String(_exhaustive)}`);
    }
  }
  return cached;
}

/** Test-only: reset the cache so unit tests can swap the backend. */
export function __resetTrinaryBackendForTests(): void {
  cached = null;
}

export type { TrinaryBackend, TrinaryInput, TrinaryOutput, TrinaryBackendInfo } from "./types.js";
export { TrinaryBackendError } from "./types.js";
export { parseTrinaryOutput, TrinaryParserError } from "./parser.js";
export { StubTrinaryBackend } from "./stub.js";
export { OpenAICompatibleTrinaryBackend } from "./openai-compatible.js";
