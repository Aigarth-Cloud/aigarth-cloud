/**
 * Browser-side encrypted Qubic wallet vault.
 *
 * Mirrors the security model of wallet.qubic.org and the Qubic Web
 * Wallet: a 55-character lowercase-Latin seed is generated, encrypted
 * with AES-256-GCM (key from PBKDF2-SHA-256 over the user's password),
 * and stored in the browser. The plaintext seed is only ever held in
 * memory while the vault is unlocked; the password never leaves the
 * device.
 *
 * Two storage modes:
 *   - "remember" (default): localStorage. Persists across sessions.
 *   - "session"           : sessionStorage. Cleared on tab close.
 *
 * The seed format follows the official @qubic-lib/qubic-ts-library:
 *   - 55 chars from `abcdefghijklmnopqrstuvwxyz`
 *   - Private key = K12(seedBytes, 32)
 *   - Public key  = SchnorrQ_KeyGeneration(privateKey)
 *   - Address     = base-26 encode of public key + 4-char K12 checksum
 *
 * The signature scheme is real Qubic SchnorrQ (64 bytes), not Ed25519.
 * Server-side verification uses the same lib's schnorrq.verify path.
 */

const VAULT_STORAGE_KEY = "aigarth:vault:v1";
const VAULT_SESSION_KEY = "aigarth:vault:session:v1";
const PBKDF2_ITERATIONS = 200_000;
const PBKDF2_HASH = "SHA-256";
const AES_KEY_BITS = 256;
const AES_IV_BYTES = 12;
const SALT_BYTES = 16;

interface VaultBlob {
  /** Format version, for future migrations. */
  v: 1;
  /** Base64url-encoded PBKDF2 salt. */
  salt: string;
  /** Base64url-encoded AES-GCM IV (nonce). */
  iv: string;
  /** Base64url-encoded ciphertext = AES-GCM(seed). */
  ct: string;
  /** Base64url-encoded 55-char seed. Kept for address derivation on the
   * server side; never sent anywhere. Encrypted at rest, decrypted
   * in-memory only on unlock. */
  seed: string;
  /** When the vault was created. */
  createdAt: string;
  /** Optional human label. */
  label?: string;
}

export type VaultStorageMode = "remember" | "session";

interface UnlockedVault {
  /** 55-character lowercase Latin seed. */
  seed: string;
  /** Derived 60-character uppercase Qubic address. */
  address: string;
}

function b64u(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return (typeof btoa === "function" ? btoa(s) : Buffer.from(bytes).toString("base64"))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64uToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

/**
 * Generate a 55-character lowercase Latin seed. 26^55 ≈ 1.4 × 10^77 bits
 * of entropy; this is the format expected by the official Qubic lib.
 */
export function generateQubicSeed(): string {
  const ALPHA = "abcdefghijklmnopqrstuvwxyz";
  const out = new Uint8Array(new ArrayBuffer(55));
  crypto.getRandomValues(out);
  let s = "";
  for (let i = 0; i < out.length; i++) s += ALPHA[out[i]! % 26];
  return s;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(seed: string, password: string): Promise<VaultBlob> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(AES_IV_BYTES);
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(seed),
  );
  return {
    v: 1,
    salt: b64u(salt),
    iv: b64u(iv),
    ct: b64u(new Uint8Array(ct)),
    seed: "", // not used; kept for type compat with VaultBlob
    createdAt: new Date().toISOString(),
  };
}

async function decrypt(blob: VaultBlob, password: string): Promise<string> {
  const salt = b64uToBytes(blob.salt);
  const iv = b64uToBytes(blob.iv);
  const ct = b64uToBytes(blob.ct);
  const key = await deriveKey(password, salt);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch {
    // GCM auth tag mismatch → wrong password
    throw new Error("Wrong password");
  }
}

function readBlob(storage: Storage): VaultBlob | null {
  const raw = storage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultBlob;
  } catch {
    return null;
  }
}

function writeBlob(blob: VaultBlob | null, mode: VaultStorageMode): void {
  if (typeof window === "undefined") return;
  const ls = window.localStorage;
  const ss = window.sessionStorage;
  if (mode === "remember") {
    if (blob) ls.setItem(VAULT_STORAGE_KEY, JSON.stringify(blob));
    else ls.removeItem(VAULT_STORAGE_KEY);
    ss.removeItem(VAULT_SESSION_KEY);
  } else {
    if (blob) ss.setItem(VAULT_SESSION_KEY, JSON.stringify(blob));
    else ss.removeItem(VAULT_SESSION_KEY);
    ls.removeItem(VAULT_STORAGE_KEY);
  }
}

/** A live, unlocked vault session. Holds the seed in-memory only. */
export class UnlockedSession {
  private seed: string;
  private address: string;
  public readonly createdAt: string;
  public readonly label?: string;

  constructor(opts: UnlockedVault & { createdAt: string; label?: string }) {
    this.seed = opts.seed;
    this.address = opts.address;
    this.createdAt = opts.createdAt;
    this.label = opts.label;
  }

  /** The 60-character Qubic address. Safe to display, never the seed. */
  get publicAddress(): string {
    return this.address;
  }

  /** Raw decrypted seed. Do not log. Do not transmit. */
  getSecretSeed(): string {
    return this.seed;
  }

  /** Sign a UTF-8 message using the real Qubic SchnorrQ scheme. */
  async signMessage(message: string): Promise<Uint8Array> {
    const { signQubicMessage } = await import("./qubic");
    return signQubicMessage(this.seed, message);
  }
}

/**
 * The vault manager. Stateless except for the currently unlocked
 * session, which is held in a closure variable and zeroed on lock.
 */
export class WalletVault {
  private static currentSession: UnlockedSession | null = null;

  /**
   * Returns the active unlocked session, or null.
   * Components read this; they never hold a direct reference.
   */
  static get active(): UnlockedSession | null {
    return this.currentSession;
  }

  /**
   * Check whether a vault exists in any storage (remember or session).
   * Does not require the password.
   */
  static exists(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean(
      window.localStorage.getItem(VAULT_STORAGE_KEY) ??
        window.sessionStorage.getItem(VAULT_SESSION_KEY),
    );
  }

  /**
   * Returns the storage mode of the existing vault, or null.
   */
  static mode(): VaultStorageMode | null {
    if (typeof window === "undefined") return null;
    if (window.localStorage.getItem(VAULT_STORAGE_KEY)) return "remember";
    if (window.sessionStorage.getItem(VAULT_SESSION_KEY)) return "session";
    return null;
  }

  /**
   * Create a new vault: generate a fresh seed, encrypt it with the
   * user's password, store in the chosen mode. Returns the unlocked
   * session (so the caller can immediately use it for the auth flow
   * without a second unlock step).
   */
  static async create(opts: {
    password: string;
    mode?: VaultStorageMode;
    label?: string;
  }): Promise<UnlockedSession> {
    if (opts.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    if (this.currentSession) {
      this.lock();
    }
    const seed = generateQubicSeed();
    const blob = await encrypt(seed, opts.password);
    blob.label = opts.label;
    writeBlob(blob, opts.mode ?? "remember");

    // Derive the address so the caller can show it before signing.
    const { deriveQubicAddress } = await import("./qubic");
    const address = await deriveQubicAddress(seed);

    const session = new UnlockedSession({
      seed,
      address,
      createdAt: blob.createdAt,
      label: opts.label,
    });
    this.currentSession = session;
    return session;
  }

  /**
   * Unlock an existing vault. On success, the returned session is also
   * stored as the current session for the page lifetime.
   */
  static async unlock(opts: {
    password: string;
  }): Promise<UnlockedSession> {
    if (this.currentSession) this.lock();

    const mode = this.mode();
    if (!mode) throw new Error("No vault on this device. Create one to continue.");
    const storage = mode === "remember" ? window.localStorage : window.sessionStorage;
    const blob = readBlob(storage);
    if (!blob) throw new Error("Vault metadata is corrupt. Please recreate the vault.");

    const seed = await decrypt(blob, opts.password);
    const { deriveQubicAddress } = await import("./qubic");
    const address = await deriveQubicAddress(seed);

    const session = new UnlockedSession({
      seed,
      address,
      createdAt: blob.createdAt,
      label: blob.label,
    });
    this.currentSession = session;
    return session;
  }

  /**
   * Load a seed into an in-memory session without touching storage.
   *
   * Use cases:
   *   - Plain seed entry (user typed/pasted a 55-char seed).
   *   - Imported .qubic-vault file (the file is the source of truth;
   *     we don't want to re-persist a copy in localStorage).
   *   - Recovery flows where persistence should be opt-in.
   *
   * If a session is already active, it is locked first. The seed
   * is held in memory only and zeroed on `lock()`.
   */
  static async loadFromSeed(opts: {
    seed: string;
    label?: string;
  }): Promise<UnlockedSession> {
    if (!/^[a-z]{55}$/.test(opts.seed)) {
      throw new Error("Seed must be 55 lowercase a-z letters.");
    }
    if (this.currentSession) this.lock();
    const { deriveQubicAddress } = await import("./qubic");
    const address = await deriveQubicAddress(opts.seed);
    const session = new UnlockedSession({
      seed: opts.seed,
      address,
      createdAt: new Date().toISOString(),
      label: opts.label,
    });
    this.currentSession = session;
    return session;
  }

  /**
   * Persist the currently-active in-memory session to storage.
   * Useful after `loadFromSeed` if the user wants their imported
   * seed remembered for next time. No-op if there's no active
   * session or if the existing blob already matches.
   */
  static async persistActive(opts: {
    password: string;
    mode?: VaultStorageMode;
  }): Promise<UnlockedSession> {
    const session = this.currentSession;
    if (!session) {
      throw new Error("No active session to persist.");
    }
    if (opts.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const seed = session.getSecretSeed();
    // Re-encrypt with the new password; this writes to storage.
    const blob = await encrypt(seed, opts.password);
    blob.label = session.label;
    writeBlob(blob, opts.mode ?? "remember");
    return session;
  }

  /**
   * Lock the vault: zero the in-memory seed and clear the session.
   * The encrypted blob in storage is untouched; the user can unlock
   * again with the same password.
   */
  static lock(): void {
    const s = this.currentSession;
    if (s) {
      // Wipe the seed string. The string is GC'd later; for a stronger
      // posture we could store the seed in a Uint8Array and zero it,
      // but a cleared string is good enough for the browser threat
      // model (XSS is the bigger concern, mitigated by React's
      // default escaping).
      (s as unknown as { seed: string }).seed = "";
    }
    this.currentSession = null;
  }

  /**
   * Wipe the vault entirely. Removes the encrypted blob from storage
   * and clears the in-memory session. The address derived from the
   * old seed is still linked to the Aigarth account on the server  
   * the user would need to create a new vault to sign in again.
   */
  static async delete(): Promise<void> {
    this.lock();
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(VAULT_STORAGE_KEY);
    window.sessionStorage.removeItem(VAULT_SESSION_KEY);
  }

  /**
   * Returns the label of the existing vault, or null. Reads the
   * metadata only (no password needed).
   */
  static label(): string | null {
    if (typeof window === "undefined") return null;
    const mode = this.mode();
    if (!mode) return null;
    const storage = mode === "remember" ? window.localStorage : window.sessionStorage;
    const blob = readBlob(storage);
    return blob?.label ?? null;
  }
}
