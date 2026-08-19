/**
 * Qubic vault file import.
 *
 * Supports two on-disk formats:
 *
 *   1. **Encrypted Qubic Web Wallet vault file** (`.qubic-vault`,
 *      exported from wallet.qubic.org). A JSON document:
 *        { "salt": base64, "iv": base64, "cipher": base64 }
 *      The cipher decrypts to:
 *        { "privateKey": base64 (JWK-wrapped RSA private key),
 *          "publicKey": JsonWebKey,
 *          "configuration": { "name": "...", "seeds": [ ... ] } }
 *      Each seed is RSA-OAEP encrypted with the public key. The
 *      whole thing is the official Qubic Web Wallet format and is
 *      handled by `@qubic-lib/qubic-ts-vault-library`.
 *
 *   2. **Plain seed file**: a 55-character lowercase Latin string
 *      (the raw Qubic private key / seed). No encryption, no
 *      password. This is for users migrating from setups that
 *      didn't have a vault (e.g. mobile wallets, paper backups).
 *
 *   3. **Aigarth vault export** (round-trip with our own in-browser
 *      vault): JSON document:
 *        { "version": 1, "kind": "aigarth-vault",
 *          "address": "60-char",
 *          "kdf": { "name": "pbkdf2-sha256", "iterations": 200000,
 *                   "salt": "base64url-16-bytes" },
 *          "cipher": { "name": "aes-256-gcm",
 *                      "iv": "base64url-12-bytes",
 *                      "ciphertext": "base64url-bytes" },
 *          "createdAt": "ISO8601" }
 *      Same encryption scheme as the in-browser vault
 *      (PBKDF2-SHA-256 200k + AES-256-GCM). The user keeps the
 *      same password they used to encrypt it.
 *
 * The import returns a seed (when one is picked) and a publicId
 * (the 60-char address). The caller is responsible for loading
 * the seed into a session.
 */

import { QubicVault } from "@qubic-lib/qubic-ts-vault-library";

const PLAIN_SEED_REGEX = /^[a-z]{55}$/;

export interface QubicSeedInfo {
  /** 60-character uppercase Qubic public ID (address). */
  publicId: string;
  /** User-given alias inside the vault (e.g. "Main", "Cold"). */
  alias: string;
}

export type ImportKind = "qubic-web-vault" | "plain-seed" | "aigarth-vault" | "unknown";

export interface DetectedFormat {
  kind: ImportKind;
  /** When kind is "qubic-web-vault" or "aigarth-vault": requires a password. */
  needsPassword: boolean;
  /** When kind is "plain-seed": the seed itself. */
  seed?: string;
  /** When kind is "aigarth-vault" or "qubic-web-vault": the address (if known). */
  address?: string;
}

// ---------- Base64 helpers ----------

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  // base64 (with + and /) → binary string
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64uToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return b64ToBytes(padded);
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// ---------- Format detection ----------

/**
 * Read a file (or a string) and detect its on-disk format.
 * Does NOT decrypt: just returns enough info to render the
 * right UI (password prompt vs immediate load).
 */
export async function detectVaultFileFormat(
  file: File,
): Promise<DetectedFormat> {
  const text = await file.text();
  return detectVaultStringFormat(text);
}

export function detectVaultStringFormat(text: string): DetectedFormat {
  const trimmed = text.trim();

  // 1. Plain seed: 55 lowercase letters, no whitespace, no JSON.
  if (PLAIN_SEED_REGEX.test(trimmed)) {
    return { kind: "plain-seed", needsPassword: false, seed: trimmed };
  }

  // 2. JSON-shaped formats.
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "unknown", needsPassword: false };
  }
  if (!parsed || typeof parsed !== "object") {
    return { kind: "unknown", needsPassword: false };
  }
  const obj = parsed as Record<string, unknown>;

  // 2a. Aigarth vault: { version, kind: "aigarth-vault", kdf, cipher, address }
  if (
    obj.kind === "aigarth-vault" &&
    typeof obj.address === "string" &&
    typeof obj.kdf === "object" &&
    typeof obj.cipher === "object"
  ) {
    return {
      kind: "aigarth-vault",
      needsPassword: true,
      address: obj.address,
    };
  }

  // 2b. Qubic Web Wallet: { salt, iv, cipher }: all base64 strings.
  if (
    typeof obj.salt === "string" &&
    typeof obj.iv === "string" &&
    typeof obj.cipher === "string"
  ) {
    return { kind: "qubic-web-vault", needsPassword: true };
  }

  return { kind: "unknown", needsPassword: false };
}

// ---------- Aigarth vault (our own format) ----------

async function decryptAigarthVault(
  text: string,
  password: string,
): Promise<{ seed: string; address: string }> {
  const parsed = JSON.parse(text) as {
    address: string;
    kdf: { name: string; iterations: number; salt: string };
    cipher: { name: string; iv: string; ciphertext: string };
  };
  if (parsed.kdf?.name !== "pbkdf2-sha256" || parsed.cipher?.name !== "aes-256-gcm") {
    throw new Error("Unsupported aigarth vault KDF / cipher.");
  }
  const salt = b64uToBytes(parsed.kdf.salt);
  const iv = b64uToBytes(parsed.cipher.iv);
  const ct = b64uToBytes(parsed.cipher.ciphertext);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: parsed.kdf.iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
  } catch {
    throw new Error("Wrong password.");
  }
  const seed = new TextDecoder().decode(pt);
  if (!PLAIN_SEED_REGEX.test(seed)) {
    throw new Error("Decrypted seed is not a valid 55-char Qubic seed.");
  }
  return { seed, address: parsed.address };
}

// ---------- Qubic Web Wallet vault ----------

export interface UnlockedQubicVault {
  /** Discovered seeds. Most vaults have 1; some have many. */
  seeds: QubicSeedInfo[];
  /** Reveal the plaintext 55-char seed for the chosen publicId. */
  revealSeed: (publicId: string) => Promise<string>;
  /** Tear down any side effects (the lib writes a `wallet-config` key to localStorage). */
  dispose: () => Promise<void>;
}

export async function unlockQubicWebVault(
  file: File,
  password: string,
): Promise<UnlockedQubicVault> {
  // The QubicVault class lives in the lib and uses `localStorage`
  // (key: "wallet-config") + globalThis.crypto. Browser-only.
  const vault = new QubicVault();
  try {
    await vault.importAndUnlock(true, password, null, file);
  } catch (err) {
    // The lib rejects with a string OR throws: normalise.
    const msg = (err as Error)?.message ?? String(err);
    throw new Error(
      msg.toLowerCase().includes("password")
        ? "Could not unlock vault: wrong password or corrupt file."
        : "Could not read vault file. Is it a Qubic Web Wallet export?",
    );
  }
  if (!vault.isWalletReady) {
    throw new Error("Vault unlocked but no wallets were loaded.");
  }
  const seeds: QubicSeedInfo[] = (vault.getSeeds() ?? []).map((s: { publicId: string; alias?: string }) => ({
    publicId: s.publicId,
    alias: s.alias || "Wallet",
  }));
  if (seeds.length === 0) {
    throw new Error("Vault is empty.");
  }
  return {
    seeds,
    revealSeed: (publicId: string) => vault.revealSeed(publicId),
    dispose: async () => {
      // Best-effort: drop the lib's `wallet-config` cache so a
      // discarded import doesn't linger in the user's localStorage.
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("wallet-config");
        }
      } catch {
        // ignore
      }
    },
  };
}

// ---------- Public top-level entrypoint ----------

export interface ImportResult {
  /** 55-char seed (plaintext, in memory only). */
  seed: string;
  /** 60-char public ID / address. */
  address: string;
  /** Where the seed came from: useful for the UI / audit log. */
  source: "qubic-web-vault" | "aigarth-vault" | "plain-seed";
  /** When more than one wallet was in the file, the user picked this one. */
  pickedAlias?: string;
  /** If we created a localStorage entry, this is the mode. */
  persistedAs?: "remember" | "session";
}

/**
 * High-level import: detect the format, ask for the password if
 * needed, list the available seeds if the file has multiple,
 * reveal the chosen seed. Returns the seed + address.
 */
export async function importQubicVault(
  file: File,
  opts: {
    /** Required when the detected format needs a password. */
    password?: string;
    /** When the file holds multiple seeds, which publicId to use. */
    pickPublicId?: string;
  },
): Promise<ImportResult> {
  const detected = await detectVaultFileFormat(file);
  if (detected.kind === "unknown") {
    throw new Error(
      "Unrecognized file. Expected a .qubic-vault export, an aigarth vault, or a 55-character seed.",
    );
  }
  if (detected.needsPassword && (!opts.password || opts.password.length === 0)) {
    throw new Error("Password is required to unlock this file.");
  }

  if (detected.kind === "plain-seed") {
    const seed = detected.seed!;
    // We need an address. The caller can derive it after: we don't
    // have a sign path here without the lib. But we can hand back the
    // seed; the consumer will derive the address via qubic.ts.
    return { seed, address: "", source: "plain-seed" };
  }

  if (detected.kind === "aigarth-vault") {
    const text = await file.text();
    const { seed, address } = await decryptAigarthVault(text, opts.password!);
    return { seed, address, source: "aigarth-vault" };
  }

  // qubic-web-vault
  const text = await file.text();
  const vault = await unlockQubicWebVault(file, opts.password!);
  try {
    if (vault.seeds.length === 1) {
      const only = vault.seeds[0]!;
      const seed = await vault.revealSeed(only.publicId);
      return { seed, address: only.publicId, source: "qubic-web-vault", pickedAlias: only.alias };
    }
    // Multi-seed vault: the caller must have provided a pick.
    if (!opts.pickPublicId) {
      const err = new Error("Multi-seed vault: pickPublicId required.");
      (err as Error & { seeds?: QubicSeedInfo[] }).seeds = vault.seeds;
      throw err;
    }
    const chosen = vault.seeds.find((s) => s.publicId === opts.pickPublicId);
    if (!chosen) throw new Error("That address is not in this vault.");
    const seed = await vault.revealSeed(chosen.publicId);
    return {
      seed,
      address: chosen.publicId,
      source: "qubic-web-vault",
      pickedAlias: chosen.alias,
    };
  } finally {
    await vault.dispose();
  }
}

// ---------- Aigarth vault export ----------
//
// Same encryption as the in-browser vault (PBKDF2-SHA-256 200k +
// AES-256-GCM), so a `.qubic-vault` file we export can be re-imported
// on any device with the same password. The schema is self-describing
// (`version`, `kind: "aigarth-vault"`) so the importer can route it
// without ambiguity.

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

function bytesToB64u(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function deriveVaultKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 200_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

export interface ExportedAigarthVault {
  version: 1;
  kind: "aigarth-vault";
  address: string;
  kdf: { name: "pbkdf2-sha256"; iterations: 200000; salt: string };
  cipher: { name: "aes-256-gcm"; iv: string; ciphertext: string };
  createdAt: string;
}

/**
 * Build a downloadable `.qubic-vault` file from a seed + password.
 * The seed is the raw 55-char string. The password is the same one
 * the user used (or will use) for the in-browser vault.
 */
export async function exportAigarthVault(opts: {
  seed: string;
  password: string;
  address: string;
}): Promise<ExportedAigarthVault> {
  if (!PLAIN_SEED_REGEX.test(opts.seed)) {
    throw new Error("Seed must be 55 lowercase a-z letters.");
  }
  if (opts.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveVaultKey(opts.password, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(opts.seed),
  );
  return {
    version: 1,
    kind: "aigarth-vault",
    address: opts.address,
    kdf: { name: "pbkdf2-sha256", iterations: 200_000, salt: bytesToB64u(salt) },
    cipher: {
      name: "aes-256-gcm",
      iv: bytesToB64u(iv),
      ciphertext: bytesToB64u(new Uint8Array(ct)),
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Trigger a browser download of an aigarth vault file.
 * Returns the filename that was used.
 */
export function downloadAigarthVault(vault: ExportedAigarthVault): string {
  const filename = `aigarth-vault-${vault.address.slice(0, 8).toLowerCase()}.qubic-vault.json`;
  const json = JSON.stringify(vault, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
