/**
 * Trinary client — Phase 18C.
 *
 * The gateway proxies trinary chat completions to the ANN service's
 * `/v1/anns/:model/decide` endpoint and frames the resulting
 * IntentEnvelope as an OpenAI-shaped chat completion. The user's
 * Bearer token is forwarded so the ANN service can attribute the
 * decision correctly.
 *
 * The framing is deliberately conservative: a trinary completion
 * still looks like an OpenAI chat completion to the caller. The
 * envelope appears in three places:
 *
 *   1. `choices[0].message.content` — the JSON-serialized envelope
 *   2. `choices[0].message.aigarth_intent` — the typed envelope (SDK convenience)
 *   3. `choices[0].message.role` — "assistant" (OpenAI shape)
 *
 * OpenAI clients that ignore `aigarth_intent` see a regular chat
 * response whose content is the envelope as a JSON string. SDK
 * clients that know about trinary mode can read `aigarth_intent`
 * directly.
 *
 * See ADR 003 §2.3 and §5 for the wire contract.
 */

import { loadConfig } from "../config/index.js";
import type { IntentEnvelope } from "@aigarth/trinary";

/** What we POST to the ANN service. Mirrors the /decide route's body. */
export interface AnnDecideRequestBody {
  request_id?: string;
  input: Record<string, unknown>;
  reversibility?: "irreversible" | "soft" | "advisory";
  time_horizon?: "immediate" | "session" | "persistent";
  supporting_signals?: Array<{
    source: "ann_decision" | "event" | "feature" | "market" | "user" | "system" | "external";
    id: string;
    content_hash?: string;
    label?: string;
  }>;
}

/** What the ANN service returns on /decide. */
export interface AnnDecideResponse {
  decision_id: string;
  envelope: IntentEnvelope;
  persisted: boolean;
}

export class AnnServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly annServicePath: string,
  ) {
    super(message);
    this.name = "AnnServiceError";
  }
}

/**
 * Call the ANN service's /decide endpoint on behalf of the user.
 *
 * Forwards the caller's Bearer token. The ANN service trusts the
 * same JWT_SECRET as the gateway, so a single token works across
 * both.
 *
 * Throws AnnServiceError on any non-2xx response. The caller is
 * expected to map that to the right HTTP status.
 */
export async function callAnnDecide(
  modelSlug: string,
  userBearerToken: string,
  body: AnnDecideRequestBody,
): Promise<AnnDecideResponse> {
  const cfg = loadConfig();
  const url = `${cfg.ANN_SERVICE_URL}/v1/anns/${encodeURIComponent(modelSlug)}/decide`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${userBearerToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AnnServiceError(
      `ANN service /decide failed: ${res.status} ${res.statusText} — ${text}`,
      res.status,
      url,
    );
  }

  const data = (await res.json()) as AnnDecideResponse;
  return data;
}

/**
 * Frame an IntentEnvelope as an OpenAI chat completion response.
 *
 * The envelope appears in three places (see file header). The usage
 * block is filled with 1 prompt token (the request id) and 1
 * completion token (the envelope) so OpenAI-shaped billing math
 * continues to work; the *real* cost is per-decision (see
 * `trinaryDecisionCost` in pricing.ts).
 */
export function frameAsChatCompletion(
  envelope: IntentEnvelope,
  decisionId: string,
  model: string,
  requestId?: string,
): {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
      aigarth_intent: IntentEnvelope;
    };
    finish_reason: "stop";
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  served_by: Array<{ ann_id: string; ann_version: string; region: string }>;
  request_id: string;
  decision_id: string;
} {
  return {
    id: `chatcmpl-${envelope.issued_at.replace(/[^0-9]/g, "").slice(0, 24)}`,
    object: "chat.completion",
    created: Math.floor(new Date(envelope.issued_at).getTime() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify(envelope),
          aigarth_intent: envelope,
        },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    served_by: [
      { ann_id: envelope.ann_id, ann_version: envelope.ann_version, region: "global" },
    ],
    request_id: requestId ?? "",
    decision_id: decisionId,
  };
}

/**
 * Frame an IntentEnvelope as a single SSE chunk for trinary streaming.
 *
 * Trinary decisions are atomic (no token-level streaming), so a
 * trinary stream is exactly two SSE events:
 *
 *   1. One chunk with `delta.aigarth_intent_delta` carrying the envelope
 *   2. One chunk with `finish_reason: "stop"`
 *
 * The `aigarth_intent_delta` field is namespaced (the `aigarth_`
 * prefix) to avoid collision with OpenAI's chunk delta schema.
 */
export function frameAsChatCompletionChunk(
  envelope: IntentEnvelope,
  decisionId: string,
  model: string,
  requestId: string | undefined,
): {
  first: {
    id: string;
    object: "chat.completion.chunk";
    created: number;
    model: string;
    choices: Array<{
      index: 0;
      delta: {
        role: "assistant";
        content: string;
        aigarth_intent_delta: IntentEnvelope;
      };
      finish_reason: null;
    }>;
  };
  done: {
    id: string;
    object: "chat.completion.chunk";
    created: number;
    model: string;
    choices: Array<{
      index: 0;
      delta: Record<string, never>;
      finish_reason: "stop";
    }>;
    request_id: string;
    decision_id: string;
  };
} {
  const id = `chatcmpl-${envelope.issued_at.replace(/[^0-9]/g, "").slice(0, 24)}`;
  const created = Math.floor(new Date(envelope.issued_at).getTime() / 1000);

  return {
    first: {
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: JSON.stringify(envelope),
            aigarth_intent_delta: envelope,
          },
          finish_reason: null,
        },
      ],
    },
    done: {
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        { index: 0, delta: {}, finish_reason: "stop" },
      ],
      request_id: requestId ?? "",
      decision_id: decisionId,
    },
  };
}

/**
 * Build the input context that the ANN service consumes. The
 * gateway converts the OpenAI-shaped `messages` array into a flat
 * `input` object that the ANN can reason over.
 *
 * Conventions:
 *   - `messages` is preserved as-is (the ANN can choose to look at it)
 *   - The last user message's content is set as `last_user_message`
 *     for the common case where the ANN only needs that
 *   - `temperature`, `top_p`, `n` are passed through (real ANNs use them)
 *   - `request_id` is set from the OpenAI `user` field, if present
 */
export function buildAnnInput(
  messages: Array<{ role: string; content: string }>,
  passthrough: {
    temperature?: number | null;
    top_p?: number | null;
    n?: number | null;
    user?: string;
  },
): AnnDecideRequestBody {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserMessage = typeof lastUser?.content === "string" ? lastUser.content : "";
  return {
    request_id: passthrough.user,
    input: {
      messages,
      last_user_message: lastUserMessage,
      message_count: messages.length,
      temperature: passthrough.temperature ?? null,
      top_p: passthrough.top_p ?? null,
      n: passthrough.n ?? null,
    },
  };
}
