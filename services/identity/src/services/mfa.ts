/**
 * MFA service — TOTP (RFC 6238) and WebAuthn (stub).
 *
 * TOTP: HMAC-SHA1, 30s step, 6 digits, ±1 step window for clock drift.
 *   The secret is base32-encoded for QR-code compatibility.
 *
 * WebAuthn: real ceremony needs navigator.credentials in the browser.
 *   We provide the server-side endpoints that a real client would call.
 *   Credential storage is real; the actual assertion flow is stubbed
 *   until the dashboard client is built.
 */

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "../db/index.js";
import { mfaCredentials, users, type MfaCredential } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

// ---------- Schemas ----------

export const TotpEnrollStartSchema = z.object({
  label: z.string().trim().min(1).max(64).default("Authenticator"),
});

export const TotpEnrollVerifySchema = z.object({
  /** The 6-digit code from the user's authenticator app. */
  code: z.string().regex(/^\d{6}$/),
});

export const TotpVerifySchema = z.object({
  /** The user's id (the route knows this from the JWT, but for a service call we pass it). */
  userId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export const WebauthnRegisterStartSchema = z.object({
  label: z.string().trim().min(1).max(64).default("Security key"),
});

export const WebauthnRegisterFinishSchema = z.object({
  /** Base64url-encoded attestation/credential id. */
  credentialId: z.string().min(1).max(2048),
  /** Base64url-encoded public key (COSE). */
  publicKey: z.string().min(1).max(8192),
});

// ---------- TOTP base32 helpers ----------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 0x1f];
  return out;
}

function base32Decode(s: string): Buffer {
  const cleaned = s.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of cleaned) {
    const idx = B32.indexOf(c);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

function totpAt(secret: Buffer, t: number, digits = 6, step = 30): string {
  const counter = Math.floor(t / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, "0");
}

export function verifyTotp(secretBase32: string, code: string, window = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  const now = Math.floor(Date.now() / 1000);
  for (let w = -window; w <= window; w++) {
    const candidate = totpAt(secret, now + w * 30);
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return true;
  }
  return false;
}

function otpauthUrl(userEmail: string, secret: string, label: string): string {
  const issuer = "Aigarth";
  const enc = (s: string) => encodeURIComponent(s);
  return `otpauth://totp/${enc(issuer)}:${enc(userEmail)}?secret=${secret}&issuer=${enc(issuer)}&label=${enc(label)}`;
}

// ---------- TOTP enrollment ----------

export interface TotpEnrollment {
  /** The base32 secret. Shown ONCE — the user scans it into their authenticator. */
  secret: string;
  /** The otpauth:// URL. Render as a QR code on the client. */
  otpauthUrl: string;
  /** Pending credential id (use this when verifying the first code). */
  pendingId: string;
}

export async function startTotpEnrollment(
  userId: string,
  input: z.infer<typeof TotpEnrollStartSchema>,
): Promise<TotpEnrollment> {
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new Error("User not found.");

  // Generate a new 20-byte secret (160 bits, RFC 4226 recommendation)
  const secretBytes = randomBytes(20);
  const secret = base32Encode(secretBytes);

  // Store as a pending credential (revokedAt is null but verifiedAt is null)
  const id = uid();
  await db.insert(mfaCredentials).values({
    id,
    userId,
    type: "totp",
    label: input.label,
    totpSecret: secret,
  });

  return {
    secret,
    otpauthUrl: otpauthUrl(user.email, secret, input.label),
    pendingId: id,
  };
}

export async function completeTotpEnrollment(
  userId: string,
  pendingId: string,
  code: string,
): Promise<MfaCredential> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mfaCredentials)
    .where(and(eq(mfaCredentials.id, pendingId), eq(mfaCredentials.userId, userId)))
    .limit(1);
  const cred = rows[0];
  if (!cred || cred.type !== "totp" || !cred.totpSecret) throw new Error("Enrollment not found.");
  if (cred.lastUsedAt) throw new Error("Enrollment already completed.");

  if (!verifyTotp(cred.totpSecret, code)) {
    throw new Error("Invalid code. Try again.");
  }
  await db
    .update(mfaCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(mfaCredentials.id, pendingId));
  logActivity(db, {
    action: "mfa.enrolled",
    actorUserId: userId,
    targetType: "mfa_credential",
    targetId: pendingId,
    metadata: { type: "totp", label: cred.label },
  });
  const updated = await db
    .select()
    .from(mfaCredentials)
    .where(eq(mfaCredentials.id, pendingId))
    .limit(1);
  return updated[0]!;
}

/** Used during login to check a code against a user's enrolled TOTP credentials. */
export async function verifyTotpForUser(userId: string, code: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mfaCredentials)
    .where(and(eq(mfaCredentials.userId, userId), eq(mfaCredentials.type, "totp")));
  for (const cred of rows) {
    if (cred.revokedAt || !cred.totpSecret) continue;
    if (verifyTotp(cred.totpSecret, code)) {
      await db.update(mfaCredentials).set({ lastUsedAt: new Date() }).where(eq(mfaCredentials.id, cred.id));
      return true;
    }
  }
  return false;
}

// ---------- WebAuthn (stub) ----------

export interface WebauthnChallenge {
  challengeId: string;
  challenge: string; // base64url
  rpId: string;
  rpName: string;
  userId: string; // base64url-encoded
}

const RP_ID = process.env["WEBAUTHN_RP_ID"] ?? "aigarth.cloud";
const RP_NAME = "Aigarth Cloud";

export async function startWebauthnRegistration(
  userId: string,
  input: z.infer<typeof WebauthnRegisterStartSchema>,
): Promise<WebauthnChallenge> {
  const challenge = randomBytes(32).toString("base64url");
  // In a real impl, persist the challenge with a TTL. For the stub, return
  // a deterministic id and let the client echo the challenge in the finish call.
  return {
    challengeId: uid(),
    challenge,
    rpId: RP_ID,
    rpName: RP_NAME,
    userId: Buffer.from(userId).toString("base64url"),
  };
}

export async function completeWebauthnRegistration(
  userId: string,
  input: z.infer<typeof WebauthnRegisterFinishSchema>,
): Promise<MfaCredential> {
  // Real impl: verify the attestation using @simplewebauthn/server.
  // For now, just store what the client sent (assuming the browser did the dance).
  const id = uid();
  const db = getDb();
  const inserted = await db
    .insert(mfaCredentials)
    .values({
      id,
      userId,
      type: "webauthn",
      label: "Security key",
      webauthnCredentialId: input.credentialId,
      webauthnPublicKey: input.publicKey,
    })
    .returning();
  logActivity(db, {
    action: "mfa.enrolled",
    actorUserId: userId,
    targetType: "mfa_credential",
    targetId: id,
    metadata: { type: "webauthn" },
  });
  return inserted[0]!;
}

export async function listUserMfa(userId: string): Promise<MfaCredential[]> {
  const db = getDb();
  return db
    .select()
    .from(mfaCredentials)
    .where(eq(mfaCredentials.userId, userId));
}

export async function removeMfaCredential(
  userId: string,
  credentialId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(mfaCredentials)
    .set({ revokedAt: new Date() })
    .where(and(eq(mfaCredentials.id, credentialId), eq(mfaCredentials.userId, userId)));
  logActivity(db, {
    action: "mfa.removed",
    actorUserId: userId,
    targetType: "mfa_credential",
    targetId: credentialId,
  });
}

// Suppress unused imports
void createHash;
