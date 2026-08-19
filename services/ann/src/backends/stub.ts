/**
 * Stub trinary backend (Phase 19C.3).
 *
 * Deterministic, no LLM required. The default backend when
 * `ANN_LLM_BACKEND` is unset or set to `stub`. Useful for:
 *   - Local development without a model server running
 *   - CI / test environments (no network)
 *   - Reproducible demos (the same input always returns the same state)
 *
 * The state, confidence, and reasoning are derived from a SHA-256 hash
 * of (ann_id, ann_version, input, request_id surrogate). The
 * behavior matches the original Phase 18B `stubTrinaryState` /
 * `stubConfidence` / `stubReasoning` helpers — see trinary.ts history.
 *
 * NOTE: This is NOT a model. Every decision is a hash lookup. Do not
 * use in production unless you accept that the platform returns
 * pseudo-random decisions. Production should set
 * `ANN_LLM_BACKEND=openai_compatible` and point at a real model.
 */

import { createHash, randomBytes } from "node:crypto";
import type {
  TrinaryBackend,
  TrinaryBackendInfo,
  TrinaryInput,
  TrinaryOutput,
} from "./types.js";

/** Stable JSON stringify with sorted keys (matches the existing helper). */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}

/** Internal-only request id surrogate. The stub doesn't need uniqueness
 *  across the wire, just enough entropy to vary outputs deterministically
 *  per call. */
function makeSurrogateRequestId(): string {
  return `stub_${randomBytes(6).toString("hex")}`;
}

const STUB_INFO: TrinaryBackendInfo = {
  id: "stub",
  model: "stub-v1",
  version: "1.0.0",
};

export class StubTrinaryBackend implements TrinaryBackend {
  info(): TrinaryBackendInfo {
    return STUB_INFO;
  }

  async invokeTrinary(input: TrinaryInput): Promise<TrinaryOutput> {
    const requestId = makeSurrogateRequestId();
    const state = stubTrinaryState(input.annId, input.annVersion, requestId, input.input);
    const confidence = stubConfidence(input.annId, input.annVersion, requestId, input.input);
    const reasoning = stubReasoning(input.annId, input.input);
    const recommended_action = stubVerbForState(state);
    return { state, confidence, reasoning, recommended_action };
  }
}

/** Exported helpers — also re-exported via trinary.ts for backwards
 *  compatibility with existing unit tests. */

export function stubTrinaryState(
  annId: string,
  annVersion: string,
  requestId: string,
  input: Record<string, unknown>,
): -1 | 0 | 1 {
  const h = createHash("sha256")
    .update(`${annId}@${annVersion}:${requestId}:${stableStringify(input)}`)
    .digest();
  const nibble = h[0]! & 0x0f;
  if (nibble <= 0x05) return 1;
  if (nibble <= 0x0a) return 0;
  return -1;
}

export function stubConfidence(
  annId: string,
  annVersion: string,
  requestId: string,
  input: Record<string, unknown>,
): number {
  const h = createHash("sha256")
    .update(`conf:${annId}@${annVersion}:${requestId}:${stableStringify(input)}`)
    .digest();
  const nibble = h[1]! & 0x0f;
  return 0.6 + (nibble / 0x0f) * 0.39;
}

export function stubReasoning(annId: string, input: Record<string, unknown>): string {
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return `ANN ${annId} (stub): empty input context, returning neutral state`;
  }
  return `ANN ${annId} (stub): observed ${keys.length} input field(s) — ${keys.slice(0, 5).join(", ")}`;
}

function stubVerbForState(state: -1 | 0 | 1): string {
  return state === 1 ? "proceed" : state === -1 ? "block" : "continue_observing";
}
