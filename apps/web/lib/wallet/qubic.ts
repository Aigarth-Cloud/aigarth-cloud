/**
 * Qubic wallet primitives: address derivation and message signing.
 *
 * Wraps the official @qubic-lib/qubic-ts-library (K12 + SchnorrQ).
 * Loaded via dynamic import because the underlying lib ships an
 * Emscripten-compiled WebAssembly module that's browser-only.
 *
 * Threat model:
 *   - The seed is a 55-character lowercase Latin string (~268 bits of
 *     entropy from a CSPRNG).
 *   - The private key is derived deterministically: K12(seedBytes, 32).
 *   - The public key is derived from the private key via SchnorrQ_KeyGeneration.
 *   - The address is the 60-character uppercase base-26 encoding of
 *     the public key + a 4-character K12 checksum.
 *   - Signatures are 64-byte SchnorrQ signatures over K12(message).
 *
 * The lib import is async because the WASM runtime is loaded lazily
 * and resolved via `crypto.onRuntimeInitialized`. We cache the
 * resolved exports so the heavy work only happens once per page.
 */

let _exportsPromise: Promise<QubicExports> | null = null;
let _prewarmErrored = false;

/**
 * Start loading the Qubic WASM module without waiting for it.
 *
 * The official Qubic lib (`@qubic-lib/qubic-ts-library`) ships an
 * Emscripten-compiled WASM module that takes ~1-2s to initialise on
 * the first cold load. If we wait until the user clicks "Sign in",
 * that latency shows up as a multi-second pause before the wallet
 * dialog even appears.
 *
 * `prewarmQubic()` kicks off the load and caches the promise. It's
 * safe to call from anywhere: multiple calls share the same
 * in-flight promise. Call it from the auth layout's mount effect
 * so the WASM is ready by the time the user reaches the wallet
 * dialog.
 */
export function prewarmQubic(): void {
  if (_exportsPromise || _prewarmErrored) return;
  _exportsPromise = loadQubic().catch((err) => {
    // Allow a retry on the next interaction.
    _exportsPromise = null;
    _prewarmErrored = true;
    // eslint-disable-next-line no-console
    console.warn("[aigarth/wallet] prewarm failed, will retry on demand:", err);
    throw err;
  });
}

interface QubicExports {
  QubicHelper: new () => {
    createIdPackage(seed: string): Promise<{
      publicKey: Uint8Array;
      privateKey: Uint8Array;
      publicId: string;
    }>;
    verifyIdentity(identity: string): Promise<boolean>;
  };
  crypto: Promise<Signer>;
}

interface Signer {
  K12(input: Uint8Array, output: Uint8Array, outputLength: number, outputOffset?: number): void;
  schnorrq: {
    generatePublicKey(secretKey: Uint8Array): Uint8Array;
    sign(secretKey: Uint8Array, publicKey: Uint8Array, message: Uint8Array): Uint8Array;
    verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): number;
  };
}

async function loadQubic(): Promise<QubicExports> {
  if (_exportsPromise) return _exportsPromise;
  _exportsPromise = (async () => {
    // The lib's main entry re-exports QubicHelper and a `crypto` promise
    // that resolves to the WASM-backed K12 + SchnorrQ API. We use this
    // entry rather than deep imports so pnpm's strict-isolated linker
    // doesn't block us.
    const mod = await import("@qubic-lib/qubic-ts-library");
    return mod.default as unknown as QubicExports;
  })();
  return _exportsPromise;
}

/**
 * Derive the 60-character Qubic address from a 55-character seed.
 */
export async function deriveQubicAddress(seed: string): Promise<string> {
  if (!/^[a-z]{55}$/.test(seed)) {
    throw new Error("Seed must be 55 lowercase letters a-z.");
  }
  const { QubicHelper } = await loadQubic();
  const helper = new QubicHelper();
  const { publicId } = await helper.createIdPackage(seed);
  if (!/^[A-Z]{60}$/.test(publicId)) {
    throw new Error("Derived address has unexpected format.");
  }
  return publicId;
}

/**
 * Sign a UTF-8 message with the seed. Returns a 64-byte SchnorrQ
 * signature, which the server can verify with the matching public
 * key (derived from the address via getIdentityBytes).
 */
export async function signQubicMessage(seed: string, message: string): Promise<Uint8Array> {
  if (!/^[a-z]{55}$/.test(seed)) {
    throw new Error("Seed must be 55 lowercase letters a-z.");
  }
  const { QubicHelper, crypto } = await loadQubic();
  const helper = new QubicHelper();
  const signer = await crypto;
  const { privateKey, publicKey } = await helper.createIdPackage(seed);

  // Qubic signing convention: K12(message) → 32-byte digest,
  // then SchnorrQ_Sign(privateKey, publicKey, digest) → 64 bytes.
  const messageBytes = new TextEncoder().encode(message);
  const digest = new Uint8Array(32);
  signer.K12(messageBytes, digest, 32);
  const signature = signer.schnorrq.sign(privateKey, publicKey, digest);
  if (signature.length !== 64) {
    throw new Error(`Expected 64-byte signature, got ${signature.length}`);
  }
  return signature;
}

/**
 * Convert a 64-byte Qubic signature to base64url for transport.
 * The server's verifier accepts base64url-encoded signatures.
 */
export function signatureToBase64Url(sig: Uint8Array): string {
  let s = "";
  for (let i = 0; i < sig.length; i++) s += String.fromCharCode(sig[i]!);
  const b64 =
    typeof btoa === "function" ? btoa(s) : Buffer.from(sig).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
