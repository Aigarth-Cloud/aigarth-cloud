/**
 * ANN client — Phase 18D.
 *
 * Calls the ANN service's `/v1/anns/:slug/decide` endpoint on
 * behalf of the tissue service. Forwards the user's JWT so the
 * ANN service can attribute the decision correctly.
 *
 * Each call has a per-call timeout (TISSUE_DECISION_TIMEOUT_MS).
 * Errors do NOT throw — they return a `null` result so the
 * decision service can mark the member as ignored and continue
 * with the rest of the tissue. Throwing would abort the whole
 * decision; the user gets a more useful response when we
 * degrade gracefully.
 */

import { loadConfig } from "../config/index.js";

/** What the tissue sends to the ANN service. Matches the /decide body. */
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
  envelope: import("@aigarth/trinary").IntentEnvelope;
  persisted: boolean;
}

export type AnnCallResult =
  | { ok: true; response: AnnDecideResponse; latencyMs: number }
  | { ok: false; reason: string; latencyMs: number };

/** Build the URL for the ANN service's /decide endpoint. Exported for tests. */
export function buildAnnDecideUrl(annServiceUrl: string, annSlug: string): string {
  return `${annServiceUrl.replace(/\/$/, "")}/v1/anns/${encodeURIComponent(annSlug)}/decide`;
}

/**
 * Call the ANN service's /decide endpoint for one member.
 *
 * Never throws. Returns a discriminated AnnCallResult that the
 * decision service pattern-matches on.
 */
export async function callAnnDecide(
  annSlug: string,
  userBearerToken: string,
  body: AnnDecideRequestBody,
): Promise<AnnCallResult> {
  const cfg = loadConfig();
  const url = buildAnnDecideUrl(cfg.ANN_SERVICE_URL, annSlug);
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.TISSUE_DECISION_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${userBearerToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `HTTP ${res.status}: ${text.slice(0, 200)}`.trim() || `HTTP ${res.status}`,
        latencyMs,
      };
    }

    const data = (await res.json()) as AnnDecideResponse;
    return { ok: true, response: data, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, reason: `timed out after ${cfg.TISSUE_DECISION_TIMEOUT_MS}ms`, latencyMs };
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "unknown error",
      latencyMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build the input context that the ANN service consumes. Mirrors
 * the gateway's `buildAnnInput` shape so all callers use the same
 * convention.
 */
export function buildAnnInput(
  tissueInput: Record<string, unknown>,
  passthrough: {
    request_id?: string;
    reversibility?: "irreversible" | "soft" | "advisory";
    time_horizon?: "immediate" | "session" | "persistent";
  },
): AnnDecideRequestBody {
  return {
    request_id: passthrough.request_id,
    input: tissueInput,
    reversibility: passthrough.reversibility,
    time_horizon: passthrough.time_horizon,
  };
}
