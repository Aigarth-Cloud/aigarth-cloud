/**
 * Cost calculation. Per-model pricing in QUBIC per 1K tokens.
 *
 * Trinary decisions are priced per-decision rather than per-token
 * because the response is a single signed IntentEnvelope, not a
 * streamed text. The fee is set in `GATEWAY_TRINARY_DECISION_COST_QUBIC`.
 */

import { loadConfig } from "../config/index.js";
import type { GatewayModel } from "../db/schema.js";

export function chatCost(
  model: Pick<GatewayModel, "inputCostQubic" | "outputCostQubic">,
  promptTokens: number,
  completionTokens: number,
): bigint {
  // Ceiling division for tokens → 1K units
  const inputUnits = BigInt(Math.ceil(promptTokens / 1000) || 1);
  const outputUnits = BigInt(Math.ceil(completionTokens / 1000) || 1);
  return inputUnits * model.inputCostQubic + outputUnits * model.outputCostQubic;
}

export function embedCost(
  inputTokens: number,
): bigint {
  const cfg = loadConfig();
  const units = BigInt(Math.ceil(inputTokens / 1000) || 1);
  return units * cfg.GATEWAY_EMBED_COST_QUBIC;
}

export function imageCost(n: number): bigint {
  const cfg = loadConfig();
  return BigInt(n) * cfg.GATEWAY_IMAGE_COST_QUBIC;
}

/**
 * Phase 18C — flat fee per trinary decision. The intent envelope is
 * atomic (no streaming tokens), so per-token pricing is the wrong
 * model. A flat fee also encourages the platform's differentiator:
 * "AI systems that say *not yet*" — a 0-state decision is the same
 * price as a +1 or -1, so there's no incentive to force a non-zero
 * answer.
 */
export function trinaryDecisionCost(): bigint {
  return loadConfig().GATEWAY_TRINARY_DECISION_COST_QUBIC;
}
