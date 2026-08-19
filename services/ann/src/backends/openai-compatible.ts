/**
 * OpenAI-compatible trinary backend (Phase 19C.3).
 *
 * Talks to any server that exposes an OpenAI-shaped
 * `POST /v1/chat/completions` endpoint. Works with:
 *
 *   - OpenAI (https://api.openai.com/v1)
 *   - Anthropic via a proxy (e.g. LiteLLM, OpenRouter)
 *   - Ollama (http://localhost:11434/v1)
 *   - LM Studio (http://localhost:1234/v1)
 *   - vLLM, TGI, llama.cpp's server mode
 *   - Any other OpenAI-compatible inference server
 *
 * The wire shape is exactly the OpenAI Chat Completions API. We send
 * a two-message conversation: a system prompt (the ANN's
 * trinaryPromptTemplate with an appended JSON contract) and a user
 * message (the JSON-stringified input). We parse the assistant
 * content through `parser.parseTrinaryOutput`.
 *
 * Failure handling:
 *   - Network errors, timeouts, non-2xx → TrinaryBackendError
 *   - Parsing errors → TrinaryParserError (subclass)
 *   - Callers in `trinary.ts` catch and substitute a neutral envelope
 *
 * The default `temperature: 0.0` makes outputs deterministic given
 * the same prompt. Set `ANN_LLM_TEMPERATURE` > 0 for varied outputs.
 */

import type {
  TrinaryBackend,
  TrinaryBackendInfo,
  TrinaryInput,
  TrinaryOutput,
} from "./types.js";
import { TrinaryBackendError } from "./types.js";
import { parseTrinaryOutput } from "./parser.js";

export interface OpenAICompatibleConfig {
  /** Base URL of the OpenAI-compatible server (no trailing slash). */
  baseUrl: string;
  /** Model name to request. */
  model: string;
  /** Optional API key (sent as `Authorization: Bearer ...`). */
  apiKey?: string;
  /** Per-request timeout in ms. Default 8000. */
  timeoutMs: number;
  /** Max tokens in the model's response. Default 512. */
  maxTokens: number;
  /** Sampling temperature. 0.0 = deterministic. Default 0.0. */
  temperature: number;
}

const JSON_CONTRACT_INSTRUCTIONS = `

You MUST respond with a single JSON object and nothing else. No prose, no markdown fence.

Schema:
{
  "state": -1 | 0 | 1,
  "confidence": number between 0.0 and 1.0,
  "reasoning": "1-3 sentence explanation",
  "recommended_action": "optional short verb (proceed | block | continue_observing | ...)"
}

State semantics:
  -1 = the action should be blocked (negative call, risk detected, refusal)
   0 = the situation is ambiguous, continue observing without acting
  +1 = the action should proceed (positive call, opportunity, clear pass)

Confidence is your CALIBRATED probability that the state is correct, not a verbose hedge.`;

export class OpenAICompatibleTrinaryBackend implements TrinaryBackend {
  constructor(private readonly cfg: OpenAICompatibleConfig) {}

  info(): TrinaryBackendInfo {
    return {
      id: "openai_compatible",
      model: this.cfg.model,
      version: "1.0.0",
    };
  }

  async invokeTrinary(input: TrinaryInput): Promise<TrinaryOutput> {
    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const systemPrompt = input.systemPrompt + JSON_CONTRACT_INSTRUCTIONS;
    const userPayload = JSON.stringify({
      ann_id: input.annId,
      ann_version: input.annVersion,
      reversibility: input.reversibility ?? null,
      time_horizon: input.timeHorizon ?? null,
      input: input.input,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.cfg.apiKey) {
      headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    }

    const body = {
      model: this.cfg.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPayload },
      ],
      temperature: this.cfg.temperature,
      max_tokens: this.cfg.maxTokens,
      // Some servers support this; ignored by those that don't.
      response_format: { type: "json_object" },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if ((e as { name?: string })?.name === "AbortError") {
        throw new TrinaryBackendError(
          `openai_compatible: request timed out after ${this.cfg.timeoutMs}ms`,
          e,
          this.info().id,
        );
      }
      throw new TrinaryBackendError(
        `openai_compatible: network error — ${(e as Error)?.message ?? String(e)}`,
        e,
        this.info().id,
      );
    }
    clearTimeout(timer);

    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch {
        // ignore
      }
      throw new TrinaryBackendError(
        `openai_compatible: HTTP ${res.status} ${res.statusText} — ${detail.slice(0, 500)}`,
        undefined,
        this.info().id,
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (e) {
      throw new TrinaryBackendError(
        `openai_compatible: response is not valid JSON`,
        e,
        this.info().id,
      );
    }

    const content = extractAssistantContent(json);
    if (content === null) {
      throw new TrinaryBackendError(
        `openai_compatible: response has no assistant content`,
        json,
        this.info().id,
      );
    }

    try {
      return parseTrinaryOutput(content);
    } catch (e) {
      // Re-throw with the raw content for debugging
      throw new TrinaryBackendError(
        `openai_compatible: failed to parse assistant content — ${(e as Error).message}`,
        { content: content.slice(0, 500), cause: e },
        this.info().id,
      );
    }
  }
}

/** Extract the assistant's text content from an OpenAI Chat Completions response. */
function extractAssistantContent(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const obj = json as Record<string, unknown>;
  const choices = obj.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return null;
  const message = (first as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as Record<string, unknown>).content;
  if (typeof content !== "string") return null;
  return content;
}
