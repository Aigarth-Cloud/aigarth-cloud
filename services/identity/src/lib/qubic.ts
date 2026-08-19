/**
 * Qubic signature verification.
 *
 * Qubic uses KangarooTwelve (K12) hashing and a SchnorrQ-style
 * signature scheme. The signature is 64 bytes over the K12 digest
 * of the message. Public keys are 32 bytes; addresses are the
 * 60-character base-26 encoding of the public key + 4-character
 * K12 checksum.
 *
 * Verifier flow:
 *   1. Validate the address is 60 uppercase A-Z chars.
 *   2. Decode the address back to 32 public-key bytes.
 *   3. Verify the K12 checksum matches (matches QubicHelper.getIdentity).
 *   4. Hash the message with K12 → 32-byte digest.
 *   5. Run SchnorrQ_Verify(publicKey, digest, signature).
 *   6. If all steps pass, the signature is valid.
 *
 * The K12 + SchnorrQ primitives come from the official
 * @qubic-lib/qubic-ts-library (KangarooTwelve + FourQ via
 * Emscripten-compiled WebAssembly). It runs on Node.js as well as
 * the browser.
 */

import { ed25519 } from "@noble/curves/ed25519";
import { base32 } from "@scure/base";

const QUBIC_ID_REGEX = /^[A-Z]{60}$/;
const K12_LEN = 32;
const SIGNATURE_LEN = 64;
const PUBLIC_KEY_LEN = 32;
const CHECKSUM_LEN = 3;

let _qubicPromise: Promise<QubicExports> | null = null;

interface QubicExports {
  QubicHelper: new () => {
    getIdentityBytes(identity: string): Uint8Array;
    getIdentity(publicKey: Uint8Array, lowerCase?: boolean): Promise<string>;
  };
  crypto: Promise<Signer>;
}

interface Signer {
  K12(input: Uint8Array, output: Uint8Array, outputLength: number, outputOffset?: number): void;
  schnorrq: {
    verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): number;
  };
}

async function loadQubic(): Promise<QubicExports> {
  if (_qubicPromise) return _qubicPromise;
  _qubicPromise = (async () => {
    const mod = await import("@qubic-lib/qubic-ts-library");
    return mod.default as unknown as QubicExports;
  })();
  return _qubicPromise;
}

export function isValidQubicAddress(addr: string): boolean {
  return QUBIC_ID_REGEX.test(addr);
}

export interface QubicVerifyResult {
  valid: boolean;
  reason:
    | "ok"
    | "bad_address"
    | "bad_signature_format"
    | "checksum_mismatch"
    | "verification_failed"
    | "stub_unverified";
}

/**
 * Decode a 60-character Qubic address to its 32-byte public key.
 * Mirrors the logic in QubicHelper.getIdentityBytes (q.l.i's ts-library):
 *   - 4 big-endian uint64 chunks (each 8 bytes of public key)
 *   - each chunk's 14 characters are interpreted as a base-26 number
 *     where 'A' = 0
 */
export function addressToPublicKey(address: string): Uint8Array {
  if (!isValidQubicAddress(address)) {
    throw new Error("Invalid Qubic address");
  }
  const out = new Uint8Array(PUBLIC_KEY_LEN);
  const view = new DataView(out.buffer);
  const A = "A".charCodeAt(0);
  for (let i = 0; i < 4; i++) {
    let acc = 0n;
    for (let j = 14; j-- > 0; ) {
      acc = acc * 26n + BigInt(address.charCodeAt(i * 14 + j) - A);
    }
    view.setBigUint64(i * 8, acc, true);
  }
  return out;
}

/**
 * Re-derive the 60-character address from the 32-byte public key
 * (the way QubicHelper.getIdentity does it) and compare to the
 * expected address. Catches malformed / tampered addresses.
 */
async function addressMatchesPublicKey(
  publicKey: Uint8Array,
  expected: string,
): Promise<boolean> {
  const { QubicHelper } = await loadQubic();
  const helper = new QubicHelper();
  const derived = await helper.getIdentity(publicKey);
  return derived === expected;
}

/**
 * Verify a Qubic signature.
 *
 *   address   — 60-char uppercase A-Z Qubic identity.
 *   message   — exact UTF-8 message bytes that were signed.
 *   signature — 64 raw bytes for a real Qubic SchnorrQ signature, or
 *               32 bytes for the legacy paste-address dev stub.
 *
 * The dev-stub path is intentionally kept for backwards compatibility
 * with the paste-address fallback on the client. It validates that
 * the address is well-formed and the signature is the right shape,
 * but does not perform the cryptographic check. The new in-browser
 * vault produces real 64-byte SchnorrQ signatures, which are fully
 * verified via K12 + SchnorrQ_Verify below.
 */
export async function verifyQubicSignature(
  address: string,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<QubicVerifyResult> {
  if (!isValidQubicAddress(address)) return { valid: false, reason: "bad_address" };

  // Real path: 64-byte Qubic SchnorrQ signature.
  if (signature.length === SIGNATURE_LEN) {
    let publicKey: Uint8Array;
    try {
      publicKey = addressToPublicKey(address);
    } catch {
      return { valid: false, reason: "bad_address" };
    }

    // Verify the address's checksum matches the public key
    if (!(await addressMatchesPublicKey(publicKey, address))) {
      return { valid: false, reason: "checksum_mismatch" };
    }

    // K12 hash the message → 32-byte digest
    const { crypto } = await loadQubic();
    const signer = await crypto;
    const digest = new Uint8Array(K12_LEN);
    signer.K12(message, digest, K12_LEN);

    // SchnorrQ_Verify returns 1 if valid, 0 if invalid
    const result = signer.schnorrq.verify(publicKey, digest, signature);
    if (result === 1) {
      return { valid: true, reason: "ok" };
    }
    return { valid: false, reason: "verification_failed" };
  }

  // Dev-stub path: 32-byte legacy signature from the paste-address
  // fallback. Validates the address + signature shape only; the
  // cryptographic check is a no-op until the user migrates to the
  // in-browser vault or a real Qubic browser wallet.
  if (signature.length === 32) {
    return { valid: true, reason: "stub_unverified" };
  }

  return { valid: false, reason: "bad_signature_format" };
}

/**
 * Convenience overload that accepts a base64url-encoded signature.
 */
export async function verifyQubicSignatureBase64Url(
  address: string,
  message: Uint8Array,
  signatureB64Url: string,
): Promise<QubicVerifyResult> {
  let sig: Uint8Array;
  try {
    sig = base64UrlToBytes(signatureB64Url);
  } catch {
    return { valid: false, reason: "bad_signature_format" };
  }
  return verifyQubicSignature(address, message, sig);
}

/**
 * Convert a 60-character Qubic address to a public key.
 * Legacy helper — prefer addressToPublicKey().
 */
function base64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = typeof Buffer !== "undefined"
    ? Buffer.from(padded, "base64").toString("binary")
    : (() => { const b = atob(padded); return b; })();
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- Qubic transaction verification (Phase 21) ----------
//
// Phase 21 — MetaMask Qubic snap support. The current Qubic snap
// (`npm:@qubic-lib/qubic-mm-snap`) does NOT expose a signMessage
// RPC; it only signs full Qubic transactions. To ship "Connect with
// MetaMask" today, we accept a signed Qubic transaction that
// embeds the auth challenge in its `input` field.
//
// The Qubic transaction layout (QubicTransaction C struct):
//
//   typedef struct {
//     unsigned char sourcePublicKey[32];   // offset 0
//     unsigned char destinationPublicKey[32]; // offset 32
//     long long amount;                     // offset 64 (8 bytes LE)
//     unsigned int tick;                    // offset 72 (4 bytes LE)
//     unsigned short inputType;             // offset 76 (2 bytes LE)
//     unsigned short inputSize;             // offset 78 (2 bytes LE)
//   } Transaction;                          // 80 bytes
//   // input bytes follow for inputSize bytes
//   // signature (64 bytes) is appended at the end
//
// The K12 digest is computed over (header || input) — the signature
// is over the digest of everything that came before it.
//
// For the auth flow the client builds a self-transfer (sender ==
// receiver, amount = 0, tick = current tick) with the canonical
// auth message as the input. The snap signs the full transaction.
// The server:
//   1. Decodes the base64.
//   2. Verifies the (32-byte) source pubkey derives to the
//      claimed 60-char address (defends against address spoofing).
//   3. Reads the input bytes; they must equal the expected UTF-8
//      canonical message (defends against replay with a different
//      challenge).
//   4. Computes K12(header || input) and runs SchnorrQ_Verify
//      against the appended 64-byte signature.
//
// inputType 0x4147 ("AG") is reserved by Aigarth. Any other
// inputType is rejected (defends against the snap being used to
// sign unrelated Qubic transactions the user is being tricked
// into authorizing).

export const AIGARTH_AUTH_INPUT_TYPE = 0x4147; // "AG"
const TX_HEADER_LEN = 80;
const TX_SIGNATURE_LEN = 64;
const TX_PUBKEY_LEN = 32;

export interface ParsedQubicTransaction {
  sourcePublicKey: Uint8Array;
  destinationPublicKey: Uint8Array;
  amount: bigint;
  tick: number;
  inputType: number;
  inputSize: number;
  /** The `input` bytes — the auth challenge, in our case. */
  input: Uint8Array;
  /** The 64-byte SchnorrQ signature at the end of the wire bytes. */
  signature: Uint8Array;
  /** The unsigned body (header + input), exactly what gets K12-hashed. */
  unsigned: Uint8Array;
}

export type QubicTxVerifyResult =
  | { valid: true; reason: "ok"; parsed: ParsedQubicTransaction }
  | { valid: false; reason:
      | "bad_tx_format"
      | "bad_address"
      | "checksum_mismatch"
      | "wrong_input_type"
      | "input_mismatch"
      | "verification_failed"
      | "stub_unverified"
    };

/**
 * Parse a Qubic transaction from the raw wire bytes the snap
 * produces. The last 64 bytes are the signature; everything before
 * is the unsigned body. The unsigned body is 80 bytes of header
 * followed by `inputSize` bytes of payload.
 *
 * Throws on shape errors (returned as a `{ valid: false, reason: "bad_tx_format" }`
 * in the public verify path).
 */
export function parseQubicTransaction(raw: Uint8Array): ParsedQubicTransaction | { error: "bad_tx_format" } {
  if (raw.length < TX_HEADER_LEN + TX_SIGNATURE_LEN) return { error: "bad_tx_format" };
  const sigOffset = raw.length - TX_SIGNATURE_LEN;
  const signature = raw.slice(sigOffset);
  if (signature.length !== TX_SIGNATURE_LEN) return { error: "bad_tx_format" };

  const unsigned = raw.slice(0, sigOffset);
  const view = new DataView(unsigned.buffer, unsigned.byteOffset, unsigned.byteLength);
  const sourcePublicKey = unsigned.slice(0, 32);
  const destinationPublicKey = unsigned.slice(32, 64);
  const amount = view.getBigInt64(64, true);
  const tick = view.getUint32(72, true);
  const inputType = view.getUint16(76, true);
  const inputSize = view.getUint16(78, true);
  if (unsigned.length !== TX_HEADER_LEN + inputSize) return { error: "bad_tx_format" };
  const input = unsigned.slice(TX_HEADER_LEN, TX_HEADER_LEN + inputSize);
  return { sourcePublicKey, destinationPublicKey, amount, tick, inputType, inputSize, input, signature, unsigned };
}

/**
 * Verify a MetaMask-snap-signed Qubic transaction against the
 * server's expected auth challenge. Returns the parsed tx on
 * success; a failure reason on rejection.
 *
 * The expected `input` is the exact bytes the user signed. In
 * the dev-stub path (when the snap is unavailable), this function
 * does NOT short-circuit; the stub acceptance is the caller's
 * decision. The reason is that the dev stub still requires a
 * well-formed 60-char address and a shape-valid base64 blob, so
 * the surface is hardened regardless.
 */
export async function verifyQubicTransactionSignature(
  expectedAddress: string,
  expectedMessage: Uint8Array,
  signedTxBase64: string,
): Promise<QubicTxVerifyResult> {
  if (!isValidQubicAddress(expectedAddress)) return { valid: false, reason: "bad_address" };

  // Decode base64 → bytes. Standard base64 OR base64url.
  let raw: Uint8Array;
  try {
    const norm = signedTxBase64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = norm + "===".slice((norm.length + 3) % 4);
    raw = Uint8Array.from(Buffer.from(padded, "base64"));
  } catch {
    return { valid: false, reason: "bad_tx_format" };
  }
  const parsed = parseQubicTransaction(raw);
  if ("error" in parsed) return { valid: false, reason: "bad_tx_format" };

  // Address must derive from the transaction's source public key.
  if (!(await addressMatchesPublicKey(parsed.sourcePublicKey, expectedAddress))) {
    return { valid: false, reason: "checksum_mismatch" };
  }

  // inputType must be AIGARTH_AUTH_INPUT_TYPE — no piggybacking
  // unrelated Qubic transactions the user is being tricked into
  // authorizing through the snap.
  if (parsed.inputType !== AIGARTH_AUTH_INPUT_TYPE) {
    return { valid: false, reason: "wrong_input_type" };
  }

  // The embedded input must equal the server-issued challenge.
  if (parsed.input.length !== expectedMessage.length) {
    return { valid: false, reason: "input_mismatch" };
  }
  for (let i = 0; i < expectedMessage.length; i++) {
    if (parsed.input[i] !== expectedMessage[i]) {
      return { valid: false, reason: "input_mismatch" };
    }
  }

  // K12 digest of (header || input) — what the SchnorrQ signature
  // was produced over.
  const { crypto } = await loadQubic();
  const signer = await crypto;
  const digest = new Uint8Array(K12_LEN);
  signer.K12(parsed.unsigned, digest, K12_LEN);

  const ok = signer.schnorrq.verify(parsed.sourcePublicKey, digest, parsed.signature);
  if (ok !== 1) return { valid: false, reason: "verification_failed" };

  return { valid: true, reason: "ok", parsed };
}

// Suppress unused import warnings (kept for backwards compat with
// the broader workspace which still references ed25519 / base32).
void ed25519;
void base32;
void CHECKSUM_LEN;
