/**
 * Sliding-window rate limiting.
 *
 * One minute buckets. Counter is incremented atomically via upsert
 * with ON CONFLICT (key, window). The window key is the current
 * minute in UTC.
 *
 * Limits are per-key. Defaults come from env, but per-key overrides
 * are honored.
 */

import { sql, eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { gatewayRateLimits, gatewayApiKeys } from "../db/schema.js";
import { loadConfig } from "../config/index.js";

export interface RateLimitDecision {
  allowed: boolean;
  rpm: { limit: number; used: number; remaining: number };
  tpm: { limit: number; used: number; remaining: number };
  retryAfterSec?: number;
}

export function currentMinuteWindow(date = new Date()): string {
  // YYYY-MM-DDTHH:MM in UTC
  return date.toISOString().slice(0, 16);
}

export async function checkAndIncrement(
  apiKeyId: string,
  tokensToAdd: number,
): Promise<RateLimitDecision> {
  const cfg = loadConfig();
  const db = getDb();
  const window = currentMinuteWindow();

  // Look up key for per-key overrides
  const key = (
    await db.select().from(gatewayApiKeys).where(eq(gatewayApiKeys.id, apiKeyId)).limit(1)
  )[0];
  const rpmLimit = key?.rateLimitRpm ?? cfg.GATEWAY_RPM_LIMIT;
  const tpmLimit = key?.rateLimitTpm ?? cfg.GATEWAY_TPM_LIMIT;

  // Atomic upsert: increment counts, return the row.
  const updated = await db
    .insert(gatewayRateLimits)
    .values({
      id: crypto.randomUUID(),
      apiKeyId,
      window,
      requestCount: 1,
      tokenCount: tokensToAdd,
    })
    .onConflictDoUpdate({
      target: [gatewayRateLimits.apiKeyId, gatewayRateLimits.window],
      set: {
        requestCount: sql`${gatewayRateLimits.requestCount} + 1`,
        tokenCount: sql`${gatewayRateLimits.tokenCount} + ${tokensToAdd}`,
      },
    })
    .returning();
  const row = updated[0]!;

  const allowed = row.requestCount <= rpmLimit && row.tokenCount <= tpmLimit;
  const retryAfterSec = allowed
    ? undefined
    : Math.max(0, 60 - (new Date().getUTCSeconds()));

  return {
    allowed,
    rpm: { limit: rpmLimit, used: row.requestCount, remaining: Math.max(0, rpmLimit - row.requestCount) },
    tpm: { limit: tpmLimit, used: row.tokenCount, remaining: Math.max(0, tpmLimit - row.tokenCount) },
    retryAfterSec,
  };
}
