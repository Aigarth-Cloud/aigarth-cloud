/**
 * @aigarth/trinary — Trinary Intelligence Protocol v1.
 *
 * Public surface for the canonical IntentEnvelope, its state machine,
 * the consensus algebra, and the signing helpers. Every ANN, tissue,
 * and orchestrator on Aigarth Cloud reads and writes this shape.
 *
 * See ADR 003 for the full specification.
 */

// Core state
export {
  TRINARY_STATES,
  VERBS_BY_STATE,
  TrinaryStateSchema,
  TrinaryVerbSchema,
  isTrinaryState,
  signToTrinary,
  negate,
  verbMatchesState,
} from "./state.js";
export type { TrinaryState, TrinaryVerb } from "./state.js";

// Signal references
export { SignalSourceSchema, SignalRefSchema } from "./signal.js";
export type { SignalSource, SignalRef } from "./signal.js";

// Envelope (the wire shape)
export {
  SCHEMA_VERSION,
  SchemaVersionSchema,
  ReversibilitySchema,
  TimeHorizonSchema,
  IntentEnvelopeSchema,
  blankEnvelope,
} from "./envelope.js";
export type { Reversibility, TimeHorizon, IntentEnvelope } from "./envelope.js";

// Canonical encoding & hashing
export { canonicalizeEnvelope, canonicalizeValue, hashEnvelope } from "./canonicalize.js";

// Signing (v1: HMAC-SHA-256)
export { signEnvelope, verifyEnvelope } from "./sign.js";

// Consensus algebra
export { EMPTY_DECISION, combine, ConsensusPolicySchema } from "./consensus.js";
export type {
  TissueRole,
  TissueMember,
  ConsensusPolicy,
  ScoredEnvelope,
  CombinedDecision,
} from "./consensus.js";
