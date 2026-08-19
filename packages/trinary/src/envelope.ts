/**
 * IntentEnvelope — the wire shape of a trinary decision.
 *
 * This is the single most important type in the protocol. Every ANN,
 * every tissue, every orchestrator on Aigarth Cloud reads and writes
 * this shape. Changes are breaking: they require a schema_version bump
 * and a coordinated rollout.
 *
 * Design principles:
 *  - The signed canonical form is the source of truth; everything else
 *    is a presentation.
 *  - Confidence is bounded [0, 1] and represents a *calibrated*
 *    probability that the state is the right call. Calibration is the
 *    ANN producer's responsibility.
 *  - Authority is bounded [0, 1] and represents the *tissue operator's*
 *    trust assignment for this ANN. Default 0.5; tissues override.
 *  - Reversibility tells downstream consumers how recoverable an
 *    execution of this state would be. Used by safety policies.
 *  - Time horizon tells downstream consumers when this state is meant
 *    to be acted on. "immediate" expires at the next orchestration
 *    tick; "persistent" survives across sessions.
 *  - `signature` is computed over the canonical JSON of the envelope
 *    *excluding* the signature field itself. See canonicalize.ts.
 *
 * See ADR 003 for the full specification.
 */

import { z } from "zod";
import { SignalRefSchema } from "./signal.js";
import { TrinaryStateSchema } from "./state.js";

/** Protocol version this envelope shape was authored under. */
export const SCHEMA_VERSION = 1 as const;
export const SchemaVersionSchema = z.literal(SCHEMA_VERSION);

/** How reversible the action implied by this state would be. */
export const ReversibilitySchema = z.enum(["irreversible", "soft", "advisory"]);
export type Reversibility = z.infer<typeof ReversibilitySchema>;

/** How long the state remains actionable. */
export const TimeHorizonSchema = z.enum(["immediate", "session", "persistent"]);
export type TimeHorizon = z.infer<typeof TimeHorizonSchema>;

/** The full envelope. */
export const IntentEnvelopeSchema = z
  .object({
    schema_version: SchemaVersionSchema,
    /** Stable ANN id. */
    ann_id: z.string().min(1).max(64),
    /** ANN version (semver) the decision was produced under. */
    ann_version: z.string().regex(/^\d+\.\d+\.\d+$/, "ann_version must be semver"),
    /** The trinary decision. */
    state: TrinaryStateSchema,
    /**
     * Calibrated confidence in the state, [0, 1]. 0.0 = no idea,
     * 1.0 = fully certain. Producers must not emit NaN.
     */
    confidence: z
      .number()
      .min(0)
      .max(1)
      .refine((n) => Number.isFinite(n), { message: "confidence must be a finite number" }),
    /**
     * Authority weight the *tissue operator* assigns to this ANN,
     * [0, 1]. Default 0.5; tissues may override. The ANN does not
     * set this — it is part of the *envelope* but produced upstream
     * of the ANN's own signing key.
     */
    authority: z
      .number()
      .min(0)
      .max(1)
      .refine((n) => Number.isFinite(n), { message: "authority must be a finite number" }),
    /** Human-readable explanation. Free text. */
    reasoning: z.string().min(0).max(8000),
    /** Optional short verb from the trinary ontology. */
    recommended_action: z.string().min(1).max(120).optional(),
    /** Observations that support this state. */
    supporting_signals: z.array(SignalRefSchema).max(64).default([]),
    /** Observations the ANN would need to act more confidently. */
    required_future_signals: z.array(SignalRefSchema).max(64).default([]),
    /** How reversible an execution of this state would be. */
    reversibility: ReversibilitySchema,
    /** How long the state remains actionable. */
    time_horizon: TimeHorizonSchema,
    /**
     * Signature over the canonical JSON of the envelope with this
     * field set to the empty string. Format is signing-scheme
     * specific; default scheme is HMAC-SHA-256, hex-encoded.
     * See sign.ts.
     */
    signature: z.string().regex(/^[a-f0-9]*$/i, "signature must be a hex string").max(256),
    /** ISO 8601 timestamp of when the envelope was produced. */
    issued_at: z.string().datetime({ offset: true }),
    /** Optional ISO 8601 expiry. If unset, the state lives for the horizon. */
    expires_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export type IntentEnvelope = z.infer<typeof IntentEnvelopeSchema>;

/** Sensible defaults for an unsigned, unsignalled envelope. */
export function blankEnvelope(input: {
  ann_id: string;
  ann_version: string;
  state: -1 | 0 | 1;
  confidence: number;
  authority?: number;
  reasoning?: string;
  recommended_action?: string;
  supporting_signals?: Array<z.infer<typeof SignalRefSchema>>;
  required_future_signals?: Array<z.infer<typeof SignalRefSchema>>;
  reversibility?: Reversibility;
  time_horizon?: TimeHorizon;
  issued_at?: string;
  expires_at?: string;
}): IntentEnvelope {
  return IntentEnvelopeSchema.parse({
    schema_version: SCHEMA_VERSION,
    ann_id: input.ann_id,
    ann_version: input.ann_version,
    state: input.state,
    confidence: input.confidence,
    authority: input.authority ?? 0.5,
    reasoning: input.reasoning ?? "",
    recommended_action: input.recommended_action,
    supporting_signals: input.supporting_signals ?? [],
    required_future_signals: input.required_future_signals ?? [],
    reversibility: input.reversibility ?? "advisory",
    time_horizon: input.time_horizon ?? "session",
    signature: "",
    issued_at: input.issued_at ?? new Date().toISOString(),
    expires_at: input.expires_at,
  });
}
