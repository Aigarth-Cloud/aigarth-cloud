/**
 * Qubic MetaMask snap integration.
 *
 * The official snap is `npm:@qubic-lib/qubic-mm-snap` from
 * github.com/qubic/qubic-mm-snap. It exposes:
 *
 *   getPublicId          → { accountIdx, confirm } → 60-char address
 *   signTransaction      → { base64Tx, offset, accountIdx, confirm }
 *                          → { signedTx } (SchnorrQ base64)
 *
 * The current snap is "designed for developers and integrators,
 * with end-user functionality coming soon." In particular it does
 * NOT expose a `signMessage` method: only `signTransaction` (with
 * a transaction base64 + offset). That means the snap can give us
 * the user's Qubic address, but for our auth nonce (an arbitrary
 * UTF-8 message) the snap can't sign it directly.
 *
 * Strategy here (Phase 21 — Option B):
 *   1. Detect the snap (via `wallet_getSnaps`).
 *   2. Use `getPublicId` to fetch the user's chosen Qubic address.
 *   3. Build a Qubic self-transfer transaction (sender == receiver,
 *      amount = 0) whose `input` field IS the canonical auth
 *      message, with `inputType = 0x4147` ("AG", reserved by
 *      Aigarth).
 *   4. Call the snap's `signTransaction` RPC. The snap returns a
 *      base64-encoded signed transaction (header || input ||
 *      signature).
 *   5. POST that to /v1/auth/wallet/finish with `kind: "transaction"`.
 *      The server's verifyQubicTransactionSignature checks:
 *        - source pubkey derives to the claimed address
 *        - inputType == 0x4147
 *        - input bytes equal the server-issued challenge
 *        - SchnorrQ_Verify over K12(header || input) succeeds
 *
 *   When a future version of the snap exposes `signMessage`, we
 *   swap to the cleaner path in `invokeSnapSignMessage`; the
 *   server already accepts `kind: "message"` and that schema is
 *   stable.
 */

const QUBIC_SNAP_ID = "npm:@qubic-lib/qubic-mm-snap";
const QUBIC_ADDRESS_REGEX = /^[A-Z]{60}$/;

/** Aigarth-reserved inputType. Server rejects any other. */
export const AIGARTH_AUTH_INPUT_TYPE = 0x4147; // "AG"

interface Eip1193Provider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

function getEthereum(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export interface SnapDetection {
  /** MetaMask is installed. */
  hasMetaMask: boolean;
  /** The Qubic snap is installed and reachable. */
  hasQubicSnap: boolean;
}

/**
 * Probe for MetaMask + the Qubic snap. Safe to call repeatedly;
 * no user-facing prompts.
 */
export async function detectQubicSnap(): Promise<SnapDetection> {
  const eth = getEthereum();
  if (!eth || !eth.isMetaMask) {
    return { hasMetaMask: false, hasQubicSnap: false };
  }
  try {
    const raw = await eth.request({ method: "wallet_getSnaps" });
    const snaps = (raw as Record<string, unknown> | null) ?? {};
    return {
      hasMetaMask: true,
      hasQubicSnap: Boolean(snaps[QUBIC_SNAP_ID]),
    };
  } catch {
    return { hasMetaMask: true, hasQubicSnap: false };
  }
}

/**
 * Prompt MetaMask to install the Qubic snap. The user has to
 * approve the install in the MetaMask UI. Resolves true on
 * success, false if rejected.
 */
export async function installQubicSnap(): Promise<boolean> {
  const eth = getEthereum();
  if (!eth || !eth.isMetaMask) return false;
  try {
    await eth.request({
      method: "wallet_requestSnaps",
      params: { [QUBIC_SNAP_ID]: {} },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the user's Qubic address from the snap. Triggers a
 * confirm dialog in MetaMask (`confirm: true`).
 */
export async function getQubicSnapAddress(accountIdx = 0): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask is not installed.");
  const result = await eth.request({
    method: "wallet_invokeSnap",
    params: {
      snapId: QUBIC_SNAP_ID,
      request: {
        method: "getPublicId",
        params: { accountIdx, confirm: true },
      },
    },
  });
  if (typeof result !== "string" || !QUBIC_ADDRESS_REGEX.test(result)) {
    throw new Error("Snap returned an invalid Qubic address.");
  }
  return result;
}

/**
 * Convert a 60-character Qubic address to its 32-byte public key.
 * Mirrors the inverse of QubicHelper.getIdentity:
 *   - 4 big-endian uint64 chunks (each 8 bytes of public key)
 *   - each chunk's 14 characters are interpreted as a base-26 number
 *     where 'A' = 0
 */
function addressToPublicKey(address: string): Uint8Array {
  if (!QUBIC_ADDRESS_REGEX.test(address)) {
    throw new Error("Invalid Qubic address");
  }
  const out = new Uint8Array(32);
  const view = new DataView(out.buffer);
  const A = "A".charCodeAt(0);
  const B26 = BigInt(26);
  for (let i = 0; i < 4; i++) {
    let acc = BigInt(0);
    for (let j = 14; j-- > 0; ) {
      acc = acc * B26 + BigInt(address.charCodeAt(i * 14 + j) - A);
    }
    view.setBigUint64(i * 8, acc, true);
  }
  return out;
}

/**
 * Build an unsigned Qubic self-transfer transaction whose
 * `input` field IS the auth challenge. The server only accepts
 * self-transfers with `inputType = 0x4147` ("AG") so the snap
 * can't be coerced into signing arbitrary Qubic payments.
 *
 * Wire format (80-byte header + inputSize input bytes):
 *   0..32    sourcePublicKey      (sender's 32-byte pubkey)
 *   32..64   destinationPublicKey (same as source — self transfer)
 *   64..72   amount               (int64 LE, 0 for auth)
 *   72..76   tick                 (uint32 LE — current tick)
 *   76..78   inputType            (uint16 LE, 0x4147 = "AG")
 *   78..80   inputSize            (uint16 LE)
 *   80..     input                (utf-8 bytes of the challenge)
 *
 * The 64-byte SchnorrQ signature is appended by the snap and
 * lives at the end of the wire bytes.
 */
export function buildQubicSelfTransfer(opts: {
  sourceAddress: string;
  challenge: string;
  tick?: number;
}): { base64: string; tick: number } {
  const tick = opts.tick ?? Math.floor(Date.now() / 1000);
  const sourcePub = addressToPublicKey(opts.sourceAddress);
  const inputBytes = new TextEncoder().encode(opts.challenge);

  const header = new Uint8Array(80);
  header.set(sourcePub, 0);
  header.set(sourcePub, 32); // destination = source (self-transfer)
  // amount: 0 (int64 LE) at offset 64
  const view = new DataView(header.buffer);
  view.setBigInt64(64, BigInt(0), true);
  // tick: uint32 LE at offset 72
  view.setUint32(72, tick >>> 0, true);
  // inputType: uint16 LE at offset 76
  view.setUint16(76, AIGARTH_AUTH_INPUT_TYPE, true);
  // inputSize: uint16 LE at offset 78
  view.setUint16(78, inputBytes.length, true);

  // Concatenate header + input
  const unsigned = new Uint8Array(80 + inputBytes.length);
  unsigned.set(header, 0);
  unsigned.set(inputBytes, 80);

  // Base64 encode (standard, NOT base64url — the snap API expects base64)
  const base64 = bytesToBase64(unsigned);
  return { base64, tick };
}

/**
 * Sign a Qubic self-transfer whose input field IS the canonical
 * auth challenge, using the MetaMask Qubic snap's
 * `signTransaction` RPC. The snap's offset is 0 because we
 * built the transaction from scratch in this function.
 *
 * Returns the snap's `signedTx` field (base64-encoded wire
 * bytes including the 64-byte SchnorrQ signature at the end).
 */
export async function signChallengeAsTransaction(opts: {
  challenge: string;
  accountIdx?: number;
  tick?: number;
}): Promise<{ signedTx: string; address: string }> {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask is not installed.");
  const accountIdx = opts.accountIdx ?? 0;

  // 1. Get the user's Qubic address (confirm prompt in MetaMask).
  const address = await getQubicSnapAddress(accountIdx);

  // 2. Build the unsigned self-transfer.
  const { base64 } = buildQubicSelfTransfer({
    sourceAddress: address,
    challenge: opts.challenge,
    tick: opts.tick,
  });

  // 3. Ask the snap to sign it (confirm prompt in MetaMask).
  const result = (await eth.request({
    method: "wallet_invokeSnap",
    params: {
      snapId: QUBIC_SNAP_ID,
      request: {
        method: "signTransaction",
        params: { base64Tx: base64, offset: 0, accountIdx, confirm: true },
      },
    },
  })) as { signedTx?: string } | string;

  // Snap returns { signedTx: "<base64>" } on success.
  let signedTx: string | undefined;
  if (typeof result === "string") signedTx = result;
  else if (result && typeof result === "object") signedTx = result.signedTx;

  if (!signedTx || typeof signedTx !== "string" || signedTx.length < 80) {
    throw new Error("Snap did not return a signed transaction.");
  }
  return { signedTx, address };
}

/**
 * Sign a message with the snap. Stub: the snap only signs
 * transactions, not arbitrary messages. If a future snap
 * version adds a signMessage RPC, wire it here. The server
 * already accepts `kind: "message"` and that schema is stable.
 *
 * For now callers should use `signChallengeAsTransaction`
 * (Option B).
 */
export async function invokeSnapSignMessage(
  _message: string,
  _accountIdx = 0,
): Promise<Uint8Array> {
  throw new Error(
    "The Qubic MetaMask snap only signs Qubic transactions, not arbitrary messages. " +
      "Aigarth uses Option B (signChallengeAsTransaction) as a workaround. " +
      "When the upstream snap ships a signMessage RPC, the call site can be flipped " +
      "with no server change.",
  );
}

export const QubicSnapIds = {
  prod: QUBIC_SNAP_ID,
} as const;

// ---------- Low-level base64 helpers (browser) ----------

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  // Both btoa (browser) and Buffer (Node) are reachable; btoa is what
  // the snap's MetaMask flow uses, since the snap is browser-only.
  if (typeof btoa === "function") return btoa(bin);
  // Fallback for SSR / test
  return Buffer.from(bytes).toString("base64");
}
