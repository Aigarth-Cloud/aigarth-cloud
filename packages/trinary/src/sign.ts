/**
 * Sign / verify — the v1 signing surface.
 *
 * v1 ships with HMAC-SHA-256 because:
 *  - It is universally supported via Node's `crypto` (no platform
 *    variance, no native build step)
 *  - It matches the "service-key signing" model: a per-ANN secret
 *    stored in `services/ann` config, used to sign every envelope the
 *    ANN emits
 *  - It is enough to prove *the platform* issued an envelope, which
 *    is the v1 trust assumption
 *
 * What v1 does *not* do, and v2 will:
 *  - Asymmetric (Ed25519) signing so a third party can verify without
 *    holding the secret — required for the "trust an ANN I didn't
 *    train" scenario the proposal calls out
 *  - Qubic-wallet-based signing using the creator's wallet key — the
 *    natural v3 once Qubic identity is the trust root
 *
 * v1 is an intentional stepping stone. The wire format leaves room:
 * the signature is a hex string, and any verifier can choose a
 * algorithm based on the key it holds. See ADR 003 §6.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { hashEnvelope } from "./canonicalize.js";
import type { IntentEnvelope } from "./envelope.js";

/** Hex-encoded HMAC-SHA-256 of the canonical envelope. */
export function signEnvelope(envelope: IntentEnvelope, key: string | Buffer): string {
  if (!key || (typeof key === "string" && key.length === 0)) {
    throw new Error("signEnvelope: key must be a non-empty string or Buffer");
  }
  const h = hashEnvelope(envelope);
  return createHmac("sha256", key).update(h, "utf8").digest("hex");
}

/**
 * Verify a signed envelope. Uses timing-safe comparison. Returns
 * `true` only if the signature matches the canonical form under the
 * given key.
 */
export function verifyEnvelope(envelope: IntentEnvelope, key: string | Buffer): boolean {
  const expected = signEnvelope(envelope, key);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(envelope.signature, "hex");
  // timingSafeEqual requires equal-length buffers; if lengths differ,
  // the signature cannot match.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
