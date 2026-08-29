/**
 * Result signer (ADR 007 §5.2).
 *
 * The result envelope is signed by Aigarth (not by Qubic). The
 * signature covers
 *
 *   invocation_hash || work_id || status || result
 *
 * The signing scheme in v1 is **HMAC-SHA-256** with the Aigarth OC
 * operator's private key. The ADR (§13 Open Question #1) names
 * Ed25519 / Schnorr as the v2 candidates; HMAC is sufficient for
 * Phase 29 because:
 *
 *   - The signature is not exposed to the Qubic chain. The Qubic
 *     smart contract verifies the result by re-deriving the same
 *     hash from the manifest + manifest_hash + ann_version +
 *     input_hash + target + canonicalise(output), which is the
 *     Aigarth-side result hash (see services/ann/.../result-hash.ts).
 *
 *   - The HMAC proves the result was produced by *this* Aigarth
 *     deployment. The Qubic side does not verify the HMAC in v1;
 *     it verifies the result_hash (which is part of the public
 *     work item record in services/work).
 *
 *   - Phase 30+ will swap HMAC for Ed25519 with a real Aigarth
 *     identity key. The interface below does not change.
 */

import { createHmac } from "node:crypto";
import { stableStringify } from "./canonicalize.js";

/** Aigarth OC operator's signing key. Loaded from env at startup. */
export interface AigarthSigningKey {
  /** The hex-encoded public key (advertised in the manifest). */
  publicKeyHex: string;
  /** The HMAC secret. Same length as the public key is fine; longer is better. */
  secret: string;
}

/**
 * Sign the canonical form. Returns the hex-encoded HMAC tag.
 *
 *   canonical = invocation_hash || work_id || status || canonicalise(result)
 *   signature = hex(hmac_sha256(secret, canonical))
 */
export function signResult(args: {
  signingKey: AigarthSigningKey;
  invocationHash: string;
  workId: string;
  status: "verified" | "disputed" | "failed";
  result: Record<string, unknown>;
}): string {
  const canonical = [
    args.invocationHash,
    args.workId,
    args.status,
    stableStringify(args.result),
  ].join("||");
  return createHmac("sha256", args.signingKey.secret).update(canonical).digest("hex");
}

/** Verify a result signature (used by the dashboard + test surface). */
export function verifyResultSignature(args: {
  signingKey: AigarthSigningKey;
  signature: string;
  invocationHash: string;
  workId: string;
  status: "verified" | "disputed" | "failed";
  result: Record<string, unknown>;
}): boolean {
  const expected = signResult(args);
  if (expected.length !== args.signature.length) return false;
  // Constant-time compare via sha256 length-equal pre-check.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ args.signature.charCodeAt(i);
  }
  return diff === 0;
}
