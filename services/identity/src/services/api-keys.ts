/**
 * API key service.
 *
 * Each key is a pair: a public prefix (`ak_live_…`) and a secret
 * (returned once, hashed with sha256 at rest). The prefix identifies
 * the key; the secret authenticates.
 *
 * Lifecycle: active → rotated (replaced by a new key) → revoked.
 * Both rotation and revocation are append-only — the old key gets
 * a status flip, the new key gets its own row.
 */

import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getDb } from "../db/index.js";
import { apiKeys, type ApiKey } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

// ---------- Schemas ----------

export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.string().min(1).max(120)).max(64).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const RotateApiKeySchema = z.object({
  /** Optional grace period for the old key (in seconds, 0 = immediate). */
  gracePeriodSeconds: z.number().int().min(0).max(7 * 24 * 60 * 60).default(0),
});

export const RevokeApiKeySchema = z.object({
  reason: z.string().min(1).max(200),
});

// ---------- Issue ----------

export interface IssuedKey {
  id: string;
  prefix: string;
  /** The full secret. Returned ONCE; never stored in cleartext. */
  secret: string;
  name: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
}

const PREFIX = "ak_live";

export async function issueApiKey(
  orgId: string,
  createdByUserId: string,
  input: z.infer<typeof CreateApiKeySchema>,
): Promise<IssuedKey> {
  const db = getDb();
  const id = uid();
  // Prefix: 8 random base32-ish chars. Public, identifies the key.
  const prefix = `${PREFIX}_${randomBytes(6).toString("hex")}`;
  // Secret: 32 random bytes encoded as base64url (~43 chars)
  const secret = randomBytes(32).toString("base64url");
  const secretHash = await sha256Hex(secret);

  const inserted = await db
    .insert(apiKeys)
    .values({
      id,
      orgId,
      createdByUserId,
      prefix,
      secretHash,
      name: input.name,
      scopes: input.scopes ?? [],
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    })
    .returning();
  const row = inserted[0]!;

  logActivity(db, {
    action: "api_key.created",
    actorUserId: createdByUserId,
    orgId,
    targetType: "api_key",
    targetId: id,
    metadata: { name: input.name, prefix, scope_count: (input.scopes ?? []).length },
  });

  return {
    id: row.id,
    prefix: row.prefix,
    secret: `${prefix}.${secret}`,
    name: row.name,
    scopes: row.scopes ?? [],
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

// ---------- List ----------

export async function listApiKeys(orgId: string): Promise<
  Array<{
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    status: string;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    rotatedToId: string | null;
    revokedAt: Date | null;
    revokedReason: string | null;
  }>
> {
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.orgId, orgId))
    .orderBy(sql`${apiKeys.createdAt} DESC`);
  return rows.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes ?? [],
    status: k.status,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    createdAt: k.createdAt,
    rotatedToId: k.rotatedToId,
    revokedAt: k.revokedAt,
    revokedReason: k.revokedReason,
  }));
}

// ---------- Rotate ----------

export async function rotateApiKey(
  orgId: string,
  keyId: string,
  input: z.infer<typeof RotateApiKeySchema>,
  actorUserId: string,
): Promise<IssuedKey> {
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId)))
    .limit(1);
  const existing = rows[0];
  if (!existing) throw new Error("API key not found.");
  if (existing.status === "revoked") throw new Error("Cannot rotate a revoked key.");
  if (existing.status === "rotated") throw new Error("Key has already been rotated.");

  const issued = await issueApiKey(orgId, actorUserId, {
    name: `${existing.name} (rotated)`,
    scopes: existing.scopes ?? [],
    expiresAt: existing.expiresAt?.toISOString(),
  });

  // Mark the old key as rotated; point to the new one
  await db
    .update(apiKeys)
    .set({ status: "rotated", rotatedToId: issued.id })
    .where(eq(apiKeys.id, keyId));

  logActivity(db, {
    action: "api_key.rotated",
    actorUserId,
    orgId,
    targetType: "api_key",
    targetId: keyId,
    metadata: { newKeyId: issued.id, gracePeriodSeconds: input.gracePeriodSeconds },
  });

  return issued;
}

// ---------- Revoke ----------

export async function revokeApiKey(
  orgId: string,
  keyId: string,
  input: z.infer<typeof RevokeApiKeySchema>,
  actorUserId: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId)))
    .limit(1);
  const existing = rows[0];
  if (!existing) throw new Error("API key not found.");
  if (existing.status === "revoked") return; // idempotent
  await db
    .update(apiKeys)
    .set({ status: "revoked", revokedAt: new Date(), revokedReason: input.reason })
    .where(eq(apiKeys.id, keyId));
  logActivity(db, {
    action: "api_key.revoked",
    actorUserId,
    orgId,
    targetType: "api_key",
    targetId: keyId,
    metadata: { reason: input.reason, prefix: existing.prefix },
  });
}

// ---------- Verify (used by middleware in Phase 7) ----------

export interface VerifiedApiKey {
  id: string;
  orgId: string;
  createdByUserId: string;
  scopes: string[];
}

export async function verifyApiKey(secret: string): Promise<VerifiedApiKey | null> {
  // The full secret is `prefix.secret`. We split on the last dot.
  const lastDot = secret.lastIndexOf(".");
  if (lastDot < 0) return null;
  const prefix = secret.slice(0, lastDot);
  const rawSecret = secret.slice(lastDot + 1);
  if (!rawSecret || !prefix.startsWith(PREFIX)) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.prefix, prefix))
    .limit(1);
  const key = rows[0];
  if (!key) return null;
  if (key.status !== "active") return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  const expected = await sha256Hex(rawSecret);
  if (!timingSafeEqual(expected, key.secretHash)) return null;

  // Update lastUsedAt (best-effort, don't fail the request)
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {});

  return {
    id: key.id,
    orgId: key.orgId,
    createdByUserId: key.createdByUserId,
    scopes: key.scopes ?? [],
  };
}

// ---------- Helpers ----------

async function sha256Hex(input: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
