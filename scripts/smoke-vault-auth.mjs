/**
 * End-to-end smoke test for the encrypted Qubic browser vault.
 *
 * Drives the full server-side flow that the new in-browser vault
 * produces, using a Node harness so we can verify the server's
 * real K12 + SchnorrQ verifier accepts a vault-generated signature.
 *
 * Flow:
 *   1. POST /v1/auth/wallet/start with a fresh Qubic address.
 *   2. Server returns a nonce + canonical message.
 *   3. We use the vault primitives (same code the browser uses) to:
 *        - generate a 55-char seed
 *        - derive the matching 60-char address (K12 + SchnorrQ)
 *        - sign the canonical message with real 64-byte SchnorrQ
 *   4. POST /v1/auth/wallet/finish with address + signature.
 *   5. Server verifies with K12 + SchnorrQ_Verify and returns 200.
 *
 * The dev port for the identity service is 7001.
 */

import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// @qubic-lib/qubic-ts-library is declared in apps/web + services/identity
// (pnpm strict isolation — not in the root scripts dir). Resolve from
// the workspace's apps/web node_modules so the smoke can find it.
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const candidates = [
  resolve(root, "apps/web/node_modules/@qubic-lib/qubic-ts-library"),
  resolve(root, "services/identity/node_modules/@qubic-lib/qubic-ts-library"),
];
const libPath = candidates.find((p) => existsSync(p));
if (!libPath) {
  throw new Error(
    `@qubic-lib/qubic-ts-library not found. Looked in: ${candidates.join(", ")}`,
  );
}
const require = createRequire(import.meta.url);
const qubic = require(libPath).default;
const { QubicHelper, crypto: qubicCrypto } = qubic;

// Reuse the global Web Crypto for the vault's PBKDF2 + AES-GCM.
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const BASE = process.env.IDENTITY_URL || "http://localhost:7001";

// ---------- Helpers (mirror apps/web/lib/wallet/vault.ts) ----------

function randomBytes(n) {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

function generateSeed() {
  const ALPHA = "abcdefghijklmnopqrstuvwxyz";
  const out = new Uint8Array(new ArrayBuffer(55));
  crypto.getRandomValues(out);
  let s = "";
  for (let i = 0; i < out.length; i++) s += ALPHA[out[i] % 26];
  return s;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return Buffer.from(bytes).toString("base64url");
}

async function encryptSeed(seed, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(seed),
  );
  return {
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv),
    ct: bytesToBase64Url(new Uint8Array(ct)),
  };
}

async function decryptSeed(blob, password) {
  const salt = Buffer.from(blob.salt, "base64url");
  const iv = Buffer.from(blob.iv, "base64url");
  const ct = Buffer.from(blob.ct, "base64url");
  const key = await deriveKey(password, salt);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct,
  );
  return new TextDecoder().decode(pt);
}

// ---------- Qubic signing (mirror apps/web/lib/wallet/qubic.ts) ----------

async function deriveAddress(seed) {
  const helper = new QubicHelper();
  const { publicId } = await helper.createIdPackage(seed);
  return publicId;
}

async function signMessage(seed, message) {
  const helper = new QubicHelper();
  const signer = await qubicCrypto;
  const { privateKey, publicKey } = await helper.createIdPackage(seed);
  const messageBytes = new TextEncoder().encode(message);
  const digest = new Uint8Array(32);
  signer.K12(messageBytes, digest, 32);
  const sig = signer.schnorrq.sign(privateKey, publicKey, digest);
  if (sig.length !== 64) throw new Error(`expected 64-byte sig, got ${sig.length}`);
  return bytesToBase64Url(sig);
}

// ---------- The flow ----------

const log = (...args) => console.log("[smoke-vault]", ...args);

async function main() {
  // 1. Build a vault (mimics the in-browser create flow)
  const password = "supersecret-passphrase-123";
  const seed = generateSeed();
  const blob = await encryptSeed(seed, password);
  const address = await deriveAddress(seed);
  log("vault created", { address, seedLength: seed.length });

  // Sanity: a wrong password must fail to decrypt
  let wrongRejected = false;
  try {
    await decryptSeed(blob, "wrong");
  } catch {
    wrongRejected = true;
  }
  if (!wrongRejected) throw new Error("vault should reject wrong password");
  log("vault rejects wrong password ✓");

  // 2. Unlock + sign
  const recovered = await decryptSeed(blob, password);
  if (recovered !== seed) throw new Error("decrypt mismatch");
  log("vault unlocks with correct password ✓");

  // 3. /start
  const startRes = await fetch(`${BASE}/v1/auth/wallet/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`/start failed: ${startRes.status} ${text}`);
  }
  const start = await startRes.json();
  log("got nonce", { noncePrefix: start.nonce.slice(0, 8) });

  // 4. Sign the canonical message
  const signature = await signMessage(seed, start.message);
  log("signed (64-byte SchnorrQ) →", signature.length, "chars base64url");

  // 5. /finish
  const finishRes = await fetch(`${BASE}/v1/auth/wallet/finish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address,
      signature,
      nonce: start.nonce,
      label: "smoke-vault",
    }),
  });
  if (!finishRes.ok) {
    const text = await finishRes.text();
    throw new Error(`/finish failed: ${finishRes.status} ${text}`);
  }
  const finish = await finishRes.json();
  log("/finish ok", {
    created: finish.created,
    verification: finish.verification,
    user: finish.user?.name,
  });

  // 6. /start again with same address and try the dev-stub path
  //    (regression guard: legacy 32-byte paste-address still works)
  const start2 = await fetch(`${BASE}/v1/auth/wallet/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  }).then((r) => r.json());
  const stubSig = bytesToBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(start2.message))),
  );
  const finish2 = await fetch(`${BASE}/v1/auth/wallet/finish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address,
      signature: stubSig,
      nonce: start2.nonce,
      label: "smoke-stub",
    }),
  });
  if (!finish2.ok) {
    const text = await finish2.text();
    throw new Error(`legacy stub /finish failed: ${finish2.status} ${text}`);
  }
  const finish2Json = await finish2.json();
  log("legacy 32-byte dev-stub still accepted", {
    verification: finish2Json.verification,
  });
  if (finish2Json.verification?.reason !== "stub_unverified") {
    throw new Error("legacy path should report reason=stub_unverified");
  }

  log("ALL SMOKE CHECKS PASSED ✓");
}

main().catch((err) => {
  console.error("[smoke-vault] FAILED:", err);
  process.exit(1);
});
