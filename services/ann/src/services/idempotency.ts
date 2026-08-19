/**
 * Idempotency service.
 *
 * Stores per-(user, key, route) responses for replay-with-same-key. A request
 * with an `Idempotency-Key` header will:
 *   1. Check the table for a cached response.
 *   2. If found, replay the response (same status + body).
 *   3. If not found, run the handler and store the result on success.
 *
 * If the same key is reused with a DIFFERENT request body, we return 422
 * (idempotency-key reuse with mismatched body). The request hash is sha256 of
 * the canonical JSON.
 *
 * Default TTL: 24 hours.
 */

import { eq, and, gt, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db/index.js";
import { idempotencyKeys, type IdempotencyKey } from "../db/schema.js";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function hashRequest(body: unknown): string {
  const canonical = JSON.stringify(body ?? null);
  return createHash("sha256").update(canonical).digest("hex");
}

export async function findExisting(
  userId: string,
  key: string,
  route: string,
): Promise<IdempotencyKey | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.idempotencyKey, key),
        eq(idempotencyKeys.route, route),
        gt(idempotencyKeys.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function store(
  userId: string,
  key: string,
  route: string,
  requestHash: string,
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  const db = getDb();
  await db
    .insert(idempotencyKeys)
    .values({
      userId,
      idempotencyKey: key,
      route,
      requestHash,
      responseStatus,
      responseBody: responseBody as Record<string, unknown>,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
    })
    .onConflictDoNothing();
}

export async function cleanup(): Promise<number> {
  const db = getDb();
  const res = await db.execute<{ n: number }>(
    sql`DELETE FROM ann_idempotency_keys WHERE expires_at < now() RETURNING 1 as n`,
  );
  return (res.rows ?? []).length;
}

export interface IdempotencyContext {
  key: string;
  route: string;
  userId: string;
  requestHash: string;
}

/** Extract the Idempotency-Key header. Returns null if absent. */
export function getIdempotencyKey(req: FastifyRequest): string | null {
  const h = req.headers["idempotency-key"];
  if (typeof h === "string" && h.length > 0 && h.length <= 200) return h;
  return null;
}
