/**
 * Trinary state — the three-value core of the protocol.
 *
 * Mirrors Neuraxon v2.0 §1 (trinary logic for excitatory / neutral /
 * inhibitory dynamics). The neutral state is a *first-class* decision,
 * not an absence of output: it means "withhold action, future context
 * matters." See ADR 003 — Trinary Protocol v1.
 *
 * The state number is the *wire* representation. The verb ontology is a
 * separate, human-meaningful layer that the platform can localize
 * without breaking the protocol contract.
 */

import { z } from "zod";

/** The three trinary states, as a frozen tuple for runtime use. */
export const TRINARY_STATES = [-1, 0, 1] as const;

/** A trinary state: -1 (inhibit), 0 (modulate), +1 (excite). */
export type TrinaryState = (typeof TRINARY_STATES)[number];

/** Zod schema: accepts exactly -1, 0, or 1. */
export const TrinaryStateSchema = z.union([
  z.literal(-1),
  z.literal(0),
  z.literal(1),
]);

/**
 * Verb ontology per state. The number is the *contract*; the verbs are
 * the *vocabulary* the platform and its users see. Localization, brand
 * voice, and per-domain mapping happen at this layer, never at the
 * number layer.
 */
export const VERBS_BY_STATE = {
  "-1": [
    "block",
    "suppress",
    "reject",
    "reduce_confidence",
    "prevent_execution",
    "signal_risk",
  ],
  "0": [
    "continue_observing",
    "gather_evidence",
    "delay_execution",
    "maintain_state",
    "prepare_for_activation",
    "remain_adaptive",
  ],
  "1": [
    "proceed",
    "increase_confidence",
    "promote",
    "execute",
    "allocate_resources",
    "support_peer",
  ],
} as const;

export type TrinaryVerb = (typeof VERBS_BY_STATE)[keyof typeof VERBS_BY_STATE][number];

/** Zod schema: any verb from the ontology. */
export const TrinaryVerbSchema = z.string().refine(
  (v): v is TrinaryVerb =>
    (VERBS_BY_STATE["-1"] as readonly string[]).includes(v) ||
    (VERBS_BY_STATE["0"] as readonly string[]).includes(v) ||
    (VERBS_BY_STATE["1"] as readonly string[]).includes(v),
  { message: "Not a recognised trinary verb" },
);

/** Type guard. */
export function isTrinaryState(n: number): n is TrinaryState {
  return n === -1 || n === 0 || n === 1;
}

/** Sign of a number as a trinary state. -1 → -1, 0 → 0, +1 → +1. */
export function signToTrinary(n: number): TrinaryState {
  if (n < 0) return -1;
  if (n > 0) return 1;
  return 0;
}

/** Negate a trinary state: +1 ↔ -1, 0 stays 0. */
export function negate(s: TrinaryState): TrinaryState {
  if (s === 0) return 0;
  return s === 1 ? -1 : 1;
}

/** Whether a verb belongs to the given state. */
export function verbMatchesState(verb: string, state: TrinaryState): boolean {
  const bucket = state === -1 ? VERBS_BY_STATE["-1"] : state === 0 ? VERBS_BY_STATE["0"] : VERBS_BY_STATE["1"];
  return (bucket as readonly string[]).includes(verb);
}
