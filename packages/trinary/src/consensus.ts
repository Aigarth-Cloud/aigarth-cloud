/**
 * Consensus algebra — the v1 default policies for combining several
 * IntentEnvelopes into a single tissue-level decision.
 *
 * Every policy is a *pure function* of (envelopes, weights, roles).
 * The tissue service (Phase 18D) calls these. The same algorithms
 * will be available to clients (e.g. SDK) for local preview.
 *
 * v1 ships four policies. They are deliberately minimal:
 *
 *  - `weighted_majority`  — sum(authority × sign(state)) over threshold
 *  - `veto_aware`         — any veto-role -1 blocks; otherwise weighted majority
 *  - `unanimous`          — all envelopes must agree; otherwise 0
 *  - `short_circuit`      — first authoritative non-zero state wins
 *
 * The output of every policy is a *partial* IntentEnvelope — it has
 * the consolidated state, weighted confidence, and reasoning, but it
 * has *no* signature. The tissue service is responsible for signing
 * its output envelope with its own service key. See ADR 003 §7.
 */

import { z } from "zod";
import type { IntentEnvelope } from "./envelope.js";
import type { TrinaryState } from "./state.js";
import { average, clamp01 } from "./internal/numeric.js";

/** A member's role in a tissue. */
export type TissueRole = "voting" | "veto" | "advisory";

/** A member with its per-call authority and role. */
export interface TissueMember {
  ann_id: string;
  /** Per-call authority override; falls back to envelope.authority. */
  authority?: number;
  role: TissueRole;
}

/** A typed policy. */
export type ConsensusPolicy =
  | { kind: "weighted_majority"; threshold: number }
  | { kind: "veto_aware"; threshold: number }
  | { kind: "unanimous" }
  | { kind: "short_circuit" };

/** Zod schema for ConsensusPolicy. Validates the four legal policy shapes. */
export const ConsensusPolicySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("weighted_majority"),
      threshold: z
        .number()
        .positive()
        .refine((n) => Number.isFinite(n), { message: "threshold must be a positive finite number" }),
    })
    .strict(),
  z
    .object({
      kind: z.literal("veto_aware"),
      threshold: z
        .number()
        .positive()
        .refine((n) => Number.isFinite(n), { message: "threshold must be a positive finite number" }),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unanimous"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("short_circuit"),
    })
    .strict(),
]);

/** A bundled envelope + member descriptor for the algebra. */
export interface ScoredEnvelope {
  envelope: IntentEnvelope;
  member: TissueMember;
}

/** A tissue-level decision (unsigned). */
export interface CombinedDecision {
  state: TrinaryState;
  /** Weighted average confidence of the *contributing* envelopes. */
  confidence: number;
  /** Reasoning string assembled from the contributing envelopes. */
  reasoning: string;
  /** Ids of the envelopes that contributed to the decision. */
  contributors: string[];
  /** Ids of envelopes that were ignored (e.g. unanimity-mismatched). */
  ignored: string[];
  /** Policy that produced the decision. */
  policy: ConsensusPolicy["kind"];
}

/** A empty decision (no envelopes). */
export const EMPTY_DECISION: CombinedDecision = Object.freeze({
  state: 0,
  confidence: 0,
  reasoning: "",
  contributors: [],
  ignored: [],
  policy: "unanimous",
}) as CombinedDecision;

/**
 * Combine a set of envelopes under a policy. Pure: same inputs → same
 * output. Order-independent for `weighted_majority` and `unanimous`.
 * Order-dependent for `short_circuit` (caller's responsibility to
 * pass envelopes in priority order).
 */
export function combine(policy: ConsensusPolicy, inputs: ScoredEnvelope[]): CombinedDecision {
  if (inputs.length === 0) return { ...EMPTY_DECISION, policy: policy.kind };

  switch (policy.kind) {
    case "weighted_majority":
      return weightedMajority(inputs, policy.threshold);
    case "veto_aware":
      return vetoAware(inputs, policy.threshold);
    case "unanimous":
      return unanimous(inputs);
    case "short_circuit":
      return shortCircuit(inputs);
  }
}

// ---------- Policies ----------

function weightedMajority(inputs: ScoredEnvelope[], threshold: number): CombinedDecision {
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("weighted_majority: threshold must be a positive finite number");
  }
  let score = 0;
  let totalAuthority = 0;
  let confidenceAccum = 0;
  const contributors: string[] = [];
  for (const { envelope, member } of inputs) {
    const a = effectiveAuthority(envelope, member);
    score += a * envelope.state;
    totalAuthority += a;
    confidenceAccum += a * envelope.confidence;
    contributors.push(envelopeKey(envelope));
  }
  const state: TrinaryState =
    score >= threshold ? 1 : score <= -threshold ? -1 : 0;
  const confidence = totalAuthority > 0 ? clamp01(confidenceAccum / totalAuthority) : 0;
  return {
    state,
    confidence,
    reasoning: summarise(inputs),
    contributors,
    ignored: [],
    policy: "weighted_majority",
  };
}

function vetoAware(inputs: ScoredEnvelope[], threshold: number): CombinedDecision {
  // Any veto-role -1 blocks immediately, regardless of score.
  for (const { envelope, member } of inputs) {
    if (member.role === "veto" && envelope.state === -1) {
      return {
        state: -1,
        confidence: clamp01(envelope.confidence),
        reasoning: `Blocked by veto from ${envelope.ann_id}@${envelope.ann_version}: ${envelope.reasoning || "(no reasoning)"}`,
        contributors: [envelopeKey(envelope)],
        ignored: inputs.filter((i) => i.envelope !== envelope).map((i) => envelopeKey(i.envelope)),
        policy: "veto_aware",
      };
    }
  }
  return weightedMajority(inputs, threshold);
}

function unanimous(inputs: ScoredEnvelope[]): CombinedDecision {
  const states = new Set(inputs.map((i) => i.envelope.state));
  if (states.size === 1) {
    const only = inputs[0]!;
    return {
      state: only.envelope.state,
      confidence: clamp01(average(inputs.map((i) => i.envelope.confidence))),
      reasoning: summarise(inputs),
      contributors: inputs.map((i) => envelopeKey(i.envelope)),
      ignored: [],
      policy: "unanimous",
    };
  }
  // Disagreement → 0 (the tissue "withholds").
  return {
    state: 0,
    confidence: 0,
    reasoning: `Unanimous policy failed: ${states.size} distinct states across ${inputs.length} envelopes`,
    contributors: [],
    ignored: inputs.map((i) => envelopeKey(i.envelope)),
    policy: "unanimous",
  };
}

function shortCircuit(inputs: ScoredEnvelope[]): CombinedDecision {
  // First non-zero state wins. Caller passes envelopes in priority order.
  for (const { envelope } of inputs) {
    if (envelope.state !== 0) {
      return {
        state: envelope.state,
        confidence: clamp01(envelope.confidence),
        reasoning: `Short-circuited by ${envelope.ann_id}@${envelope.ann_version}: ${envelope.reasoning || "(no reasoning)"}`,
        contributors: [envelopeKey(envelope)],
        ignored: inputs
          .filter((i) => i.envelope !== envelope)
          .map((i) => envelopeKey(i.envelope)),
        policy: "short_circuit",
      };
    }
  }
  // All 0 → tissue is 0.
  return {
    state: 0,
    confidence: clamp01(average(inputs.map((i) => i.envelope.confidence))),
    reasoning: summarise(inputs),
    contributors: inputs.map((i) => envelopeKey(i.envelope)),
    ignored: [],
    policy: "short_circuit",
  };
}

// ---------- Helpers ----------

function effectiveAuthority(envelope: IntentEnvelope, member: TissueMember): number {
  if (member.authority !== undefined) {
    return clamp01(member.authority);
  }
  return clamp01(envelope.authority);
}

function envelopeKey(envelope: IntentEnvelope): string {
  return `${envelope.ann_id}@${envelope.ann_version}:${envelope.issued_at}`;
}

function summarise(inputs: ScoredEnvelope[]): string {
  const parts: string[] = [];
  for (const { envelope, member } of inputs) {
    const a = effectiveAuthority(envelope, member);
    parts.push(
      `${envelope.ann_id}@${envelope.ann_version} state=${envelope.state} conf=${envelope.confidence.toFixed(2)} auth=${a.toFixed(2)} role=${member.role}`,
    );
  }
  return parts.join("; ");
}
