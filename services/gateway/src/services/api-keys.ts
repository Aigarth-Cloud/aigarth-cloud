/**
 * API key management.
 *
 * Format: `ak_live_<8char-prefix>.<43char-secret>`
 * Storage: prefix + sha256(secret) + last4 of secret.
 *
 * Keys can be issued by JWT-authenticated users (via the /v1/keys
 * endpoint) and used to call /v1/chat/completions etc. via Bearer.
 */

import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { gatewayApiKeys, type GatewayApiKey } from "../db/schema.js";
import { uid, generateApiKey, sha256Hex } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { GatewayApiKey };

export const API_KEY_PREFIX = "ak_live_";

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(60),
  scopes: z.array(z.string()).default(["chat", "embeddings", "images"]),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
  rateLimitRpm: z.number().int().min(1).max(10_000).optional(),
  rateLimitTpm: z.number().int().min(100).max(10_000_000).optional(),
});

export interface CreateApiKeyResult {
  key: GatewayApiKey;
  /** The full API key, returned ONCE. Not stored. */
  fullKey: string;
}

export async function createApiKey(
  userId: string,
  orgId: string | null,
  input: z.infer<typeof CreateApiKeySchema>,
): Promise<CreateApiKeyResult> {
  const db = getDb();
  const { key, secret, full } = generateApiKey(API_KEY_PREFIX);
  const secretHash = sha256Hex(secret);
  const secretLast4 = secret.slice(-4);

  const id = uid();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const inserted = await db
    .insert(gatewayApiKeys)
    .values({
      id,
      userId,
      orgId,
      name: input.name,
      prefix: key,
      secretHash,
      secretLast4,
      scopes: input.scopes,
      rateLimitRpm: input.rateLimitRpm ?? null,
      rateLimitTpm: input.rateLimitTpm ?? null,
      expiresAt,
    })
    .returning();

  await logActivity(db, {
    action: "key.issued",
    actorUserId: userId,
    orgId,
    targetType: "api_key",
    targetId: id,
    metadata: { name: input.name, prefix: key },
  });

  return { key: inserted[0]!, fullKey: full };
}

export async function listApiKeys(userId: string): Promise<GatewayApiKey[]> {
  const db = getDb();
  return db
    .select()
    .from(gatewayApiKeys)
    .where(eq(gatewayApiKeys.userId, userId))
    .orderBy(desc(gatewayApiKeys.createdAt));
}

export async function revokeApiKey(userId: string, id: string, reason?: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(gatewayApiKeys)
    .where(and(eq(gatewayApiKeys.id, id), eq(gatewayApiKeys.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("API key not found.");
  if (rows[0].status === "revoked") throw new Error("API key is already revoked.");
  await db
    .update(gatewayApiKeys)
    .set({ status: "revoked", revokedAt: new Date(), revokedReason: reason ?? null })
    .where(eq(gatewayApiKeys.id, id));
  await logActivity(db, {
    action: "key.revoked",
    actorUserId: userId,
    targetType: "api_key",
    targetId: id,
    metadata: { reason: reason ?? null },
  });
}

/**
 * Verify a Bearer API key.
 * Returns the key record if valid, null otherwise.
 */
export async function verifyApiKey(
  fullKey: string,
): Promise<GatewayApiKey | null> {
  if (!fullKey.startsWith(API_KEY_PREFIX)) return null;
  const rest = fullKey.slice(API_KEY_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot < 0) return null;
  const prefix = rest.slice(0, dot);
  const secret = rest.slice(dot + 1);
  if (!prefix || !secret) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(gatewayApiKeys)
    .where(eq(gatewayApiKeys.prefix, prefix))
    .limit(1);
  const key = rows[0];
  if (!key) return null;
  if (key.status !== "active") return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;
  const expectedHash = sha256Hex(secret);
  if (expectedHash !== key.secretHash) return null;
  return key;
}

export async function touchApiKey(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(gatewayApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(gatewayApiKeys.id, id));
}
