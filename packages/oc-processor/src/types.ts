/**
 * Public types — ADR 007 wire shapes.
 *
 *   `OcProcessorManifest` — the contract between Aigarth and the Qubic
 *                            network at registration time.
 *   `QubicInvocation`     — what Aigarth receives on every OC call.
 *   `QubicResult`         — what Aigarth returns.
 *   `OcErrorCode`         — canonical rejection codes (mapped to HTTP
 *                            status + Retry-After at the route layer).
 *
 * All shapes are JSON over HTTPS per ADR 007 §3.3.
 */

import { z } from "zod";

/** A Qubic-scoped algorithm slug. The OC processor advertises the
 *  algorithms it can serve; the Work Runtime uses these to look up
 *  the worker manifest. */
export const AlgorithmSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9_]*$/, "algorithm slug must be lowercase snake_case");

export type AlgorithmSlug = z.infer<typeof AlgorithmSlugSchema>;

/** The OC processor manifest. Immutable for the lifetime of the
 *  processor id. To change anything, register a new processor. */
export const OcProcessorManifestSchema = z
  .object({
    processor_id: z.string().min(1).max(120).regex(/^[a-z][a-z0-9-]*$/),
    capabilities: z.array(AlgorithmSlugSchema).min(1).max(64),
    fee_qubic: z.string().regex(/^\d+$/, "fee_qubic must be a Qu-bit integer string"),
    endpoint: z.string().url(),
    /** Hex-encoded Ed25519 / Schnorr public key. */
    result_pubkey: z.string().regex(/^[a-fA-F0-9]+$/),
    description: z.string().max(2000).optional(),
  })
  .strict();

export type OcProcessorManifest = z.infer<typeof OcProcessorManifestSchema>;

/** The OC invocation envelope. Sent by the Qubic computor's
 *  processor machine to the Aigarth processor endpoint. */
export const QubicInvocationSchema = z
  .object({
    kind: z.literal("invocation"),
    contract_index: z.number().int().nonnegative(),
    procedure: z.string().min(1).max(120),
    /** Hex-encoded 32-byte Qubic identity. */
    caller: z.string().regex(/^[a-fA-F0-9]{64}$/),
    /** Hex-encoded 32-byte Qubic identity. May differ from `caller`. */
    payer: z.string().regex(/^[a-fA-F0-9]{64}$/),
    fee_paid_qubit: z.string().regex(/^\d+$/),
    epoch: z.number().int().nonnegative(),
    nonce: z.string().min(1).max(120),
    payload: z.record(z.unknown()),
    signatures: z.object({
      computors: z.array(z.string().regex(/^[a-fA-F0-9]{64}$/)).min(1).max(676),
      sigs: z.array(z.string().regex(/^[a-fA-F0-9]+$/)).min(1).max(676),
      message_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    }),
  })
  .strict();

export type QubicInvocation = z.infer<typeof QubicInvocationSchema>;

/** The OC result envelope. Signed by Aigarth and returned to the
 *  Qubic computor's processor machine. */
export const QubicResultSchema = z
  .object({
    kind: z.literal("result"),
    invocation_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    work_id: z.string().min(1).max(120),
    status: z.enum(["verified", "disputed", "failed"]),
    result: z.record(z.unknown()),
    /** Hex-encoded signature over (invocation_hash || work_id || status || result). */
    aigarth_signature: z.string().regex(/^[a-fA-F0-9]+$/),
    aigarth_pubkey: z.string().regex(/^[a-fA-F0-9]+$/),
    timestamp_ms: z.number().int().nonnegative(),
  })
  .strict();

export type QubicResult = z.infer<typeof QubicResultSchema>;

/** Canonical rejection codes. Each maps to an HTTP status. */
export const OcErrorCode = {
  /** Bundle structure invalid (missing computors, bad message_hash, ...). */
  INVALID_INVOCATION_HASH: "INVALID_INVOCATION_HASH",
  /** Fewer than 451 unique signatures. */
  INSUFFICIENT_SIGS: "INSUFFICIENT_SIGS",
  /** At least one (computor, sig) pair did not verify. */
  INVALID_SIG: "INVALID_SIG",
  /** Rate limit fired (per-caller, per-processor, or per-epoch). */
  RATE_LIMITED_CALLER: "RATE_LIMITED_CALLER",
  RATE_LIMITED_PROCESSOR: "RATE_LIMITED_PROCESSOR",
  RATE_LIMITED_EPOCH: "RATE_LIMITED_EPOCH",
  /** Circuit breaker is OPEN. */
  PROCESSOR_PAUSED: "PROCESSOR_PAUSED",
  /** The Work Runtime is unreachable. */
  WORK_RUNTIME_UNAVAILABLE: "WORK_RUNTIME_UNAVAILABLE",
  /** The invocation handler threw. */
  HANDLER_FAILED: "HANDLER_FAILED",
  /** Catch-all. */
  INTERNAL: "INTERNAL",
} as const;

export type OcErrorCode = (typeof OcErrorCode)[keyof typeof OcErrorCode];

export class OcProcessorError extends Error {
  public override readonly name = "OcProcessorError";
  constructor(
    message: string,
    public readonly code: OcErrorCode,
    /** Optional Retry-After hint, in seconds. */
    public readonly retryAfterSec?: number,
  ) {
    super(message);
  }
}
