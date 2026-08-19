/**
 * SignalRef — a pointer to an observation that supports or conditions
 * an IntentEnvelope. Either a primary key into an upstream service
 * (e.g. an event id, a feature row, a market tick) or a content hash
 * for evidence payloads stored off-chain.
 *
 * Signals are deliberately lightweight: the protocol carries the
 * *reference*, not the *payload*. Payloads can be megabytes; references
 * are a few dozen bytes.
 */

import { z } from "zod";

/** Where the signal lives. */
export const SignalSourceSchema = z.enum([
  "ann_decision", // a previous IntentEnvelope from another ANN
  "event", // an event-stream entry (NATS, webhooks, etc.)
  "feature", // a feature-store row
  "market", // an external market / data tick
  "user", // a human-provided input
  "system", // an internal platform signal (rate limit, region health, ...)
  "external", // an off-platform reference (URL, CID, etc.)
]);
export type SignalSource = z.infer<typeof SignalSourceSchema>;

/** A signal reference. */
export const SignalRefSchema = z.object({
  /** What kind of source this is. */
  source: SignalSourceSchema,
  /**
   * Stable identifier for this signal within its source. Format is
   * source-specific (UUID, ULID, event id, tx hash, etc.). Required.
   */
  id: z.string().min(1).max(256),
  /**
   * SHA-256 hex of the signal's content, if the source is content-
   * addressed. Optional; only set when the producer can guarantee
   * reproducibility (training data hashes, evidence artefacts, etc.).
   */
  content_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "content_hash must be a lowercase sha-256 hex string")
    .optional(),
  /**
   * Free-form short label for human display. Not part of the
   * cryptographic surface.
   */
  label: z.string().min(1).max(120).optional(),
});
export type SignalRef = z.infer<typeof SignalRefSchema>;
