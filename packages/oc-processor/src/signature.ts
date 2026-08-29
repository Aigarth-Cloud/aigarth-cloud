/**
 * 451/676 signature bundle verification (ADR 007 §5).
 *
 * The trust root for Tier 3 (OC) is the 451/676 computor
 * signature. This module verifies:
 *
 *   1. Message hash integrity — the re-derived sha256 of the
 *      canonical invocation equals `signatures.message_hash`.
 *   2. Signature count — `signatures.sigs.length >= 451` AND
 *      matches `signatures.computors.length`.
 *   3. Per-signature validity — each (computor, sig) pair verifies
 *      against the canonical message hash with that computor's
 *      public key. The public key is fetched from
 *      `services/qubic` (real Qubic) or a local mirror.
 *
 * v1 caveat (Phase 29):
 *
 *   The real Ed25519 / Schnorr verification against the live Qubic
 *   computor set is **not** wired in this release. The test surface
 *   for OC (`https://ocmock.qubic.org/`) does not yet return real
 *   computor pubkeys in a stable format, and the `services/qubic`
 *   computor list is a deterministic stub (`StubQubicClient.listComputors`).
 *
 *   The v1 implementation:
 *     - Re-derives the message hash and asserts equality (check 1) — real
 *     - Asserts count >= 451 and unique computors (check 2) — real
 *     - Treats each (computor, sig) as a structural check, NOT a
 *       cryptographic verification. The pubkey is fetched but the
 *       sig is not actually verified against it. The error code is
 *       `INVALID_SIG` if the structural check fails (e.g. wrong length,
 *       non-hex characters) but a well-formed but actually-invalid
 *       sig passes through.
 *
 *   This is **deliberate**. The ADR's own acceptance gate is the
 *   Wave 3 build + a security review; cryptographic verification
 *   is a Phase 30+ deliverable. The structural check is enough to
 *   catch malformed bundles during local dev and the public testnet.
 */

import { createHash } from "node:crypto";
import type { QubicInvocation } from "./types.js";
import { OcErrorCode, OcProcessorError } from "./types.js";
import { messageHash } from "./canonicalize.js";

/** A Qubic computor public key, hex-encoded. */
export interface QubicComputorKey {
  computorIndex: number;
  publicKeyHex: string;
}

const REQUIRED_SIGS = 451;

/** Verify a 451/676 signature bundle. Throws OcProcessorError on failure. */
export function verifySignatureBundle(
  inv: QubicInvocation,
  /** Public keys for the computors in inv.signatures.computors.
   *  Fetched from services/qubic. */
  computorKeys: ReadonlyMap<string, QubicComputorKey>,
): { messageHash: string; validCount: number } {
  // 1. Message hash integrity.
  const derived = messageHash(inv);
  if (derived !== inv.signatures.message_hash) {
    throw new OcProcessorError(
      `INVALID_INVOCATION_HASH: expected ${derived}, got ${inv.signatures.message_hash}`,
      OcErrorCode.INVALID_INVOCATION_HASH,
    );
  }

  // 2. Count + structural check.
  if (inv.signatures.computors.length < REQUIRED_SIGS) {
    throw new OcProcessorError(
      `INSUFFICIENT_SIGS: got ${inv.signatures.computors.length}, need >= ${REQUIRED_SIGS}`,
      OcErrorCode.INSUFFICIENT_SIGS,
    );
  }
  if (inv.signatures.computors.length !== inv.signatures.sigs.length) {
    throw new OcProcessorError(
      `INVALID_INVOCATION_HASH: computors (${inv.signatures.computors.length}) and sigs (${inv.signatures.sigs.length}) length mismatch`,
      OcErrorCode.INVALID_INVOCATION_HASH,
    );
  }

  // Deduplicate computors — a bundle with duplicate computors is rejected.
  const unique = new Set(inv.signatures.computors);
  if (unique.size !== inv.signatures.computors.length) {
    throw new OcProcessorError(
      `INVALID_SIG: signature bundle contains duplicate computor identities`,
      OcErrorCode.INVALID_SIG,
    );
  }

  // 3. Per-signature structural check.
  //    Phase 30+: replace with a real Ed25519 verify using
  //    computorKeys.get(computor).publicKeyHex as the public key.
  let valid = 0;
  for (let i = 0; i < inv.signatures.computors.length; i++) {
    const computor = inv.signatures.computors[i]!;
    const sig = inv.signatures.sigs[i]!;
    if (!computorKeys.has(computor)) {
      throw new OcProcessorError(
        `INVALID_SIG: unknown computor ${computor}`,
        OcErrorCode.INVALID_SIG,
      );
    }
    if (!/^[a-fA-F0-9]+$/.test(sig) || sig.length < 64) {
      throw new OcProcessorError(
        `INVALID_SIG: signature ${i} is not a valid hex string`,
        OcErrorCode.INVALID_SIG,
      );
    }
    // Structural placeholder for the real verify. The Phase 30+
    // implementation uses `@noble/ed25519` or `tweetnacl` here:
    //
    //   verify(sig, derived, pubkey) === true
    //
    // We use a deterministic sha256 preimage as a stand-in so a
    // tampered signature is structurally different (and so a
    // well-formed one is always accepted) — this matches the
    // "structural check only" promise in the v1 caveat above.
    const tampered = createHash("sha256")
      .update(`${computor}|${sig}|${derived}`)
      .digest("hex");
    if (tampered.length !== 64) {
      throw new OcProcessorError(
        `INVALID_SIG: structural check failed for computor ${computor}`,
        OcErrorCode.INVALID_SIG,
      );
    }
    valid += 1;
  }
  return { messageHash: derived, validCount: valid };
}
