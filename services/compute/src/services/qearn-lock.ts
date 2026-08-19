/**
 * Qearn lock wrapper — Phase 24.4.
 *
 * Tracks the Qearn lock created when a node reservation's deposit is
 * yield-opted-in. In Phase 24 this is a deterministic 5% APY linear
 * accrual stub. The real Qearn integration (Phase 25+) replaces this
 * with a wrapper around services/economy/src/services/locks.ts and
 * the qearn-watcher (services/qubic).
 *
 * Linear-accrual formula:
 *   yield = principal * apyBps * elapsedMs / (10_000 * 31_536_000_000)
 *
 * The 5% APY is generous vs current Qearn (~3%) so the marketing
 * claim "earn yield while you wait" lands above the floor when the
 * real integration ships. We'll tune when 20.6 lands.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { nodeYieldLock, type NodeYieldLock } from "../db/schema.js";
import { logActivity } from "../lib/audit.js";

const MS_PER_YEAR = 365n * 24n * 60n * 60n * 1000n; // 31_536_000_000

/**
 * Linear-accrual yield computation.
 *
 * yield = principal * apyBps * elapsedMs / (10_000 * MS_PER_YEAR)
 *
 * The `apyBps` is the annual rate in basis points. `elapsedMs` is
 * the time since the lock was created. Both `apyBps` and the
 * multiplier `10_000` are integers; the result is rounded down
 * (the user gets at most the actual yield, never more).
 */
export function computeLinearAccrual(
  principalQubic: bigint,
  apyBps: number,
  elapsedMs: number,
): bigint {
  if (principalQubic <= 0n || apyBps <= 0 || elapsedMs <= 0) return 0n;
  const elapsedMsBig = BigInt(elapsedMs);
  return (principalQubic * BigInt(apyBps) * elapsedMsBig) / (10_000n * MS_PER_YEAR);
}

export async function lockDeposit(input: {
  reservationId: string;
  userId: string;
  principalQubic: bigint;
  apyBps?: number;
}): Promise<NodeYieldLock> {
  const db = getDb();
  const inserted = await db
    .insert(nodeYieldLock)
    .values({
      reservationId: input.reservationId,
      userId: input.userId,
      principalQubic: input.principalQubic,
      apyBps: input.apyBps ?? 500,
    })
    .returning();
  logActivity(db, {
    action: "node_yield_lock.created",
    targetType: "node_yield_lock",
    targetId: inserted[0]!.id,
    metadata: {
      reservationId: input.reservationId,
      principalQubic: input.principalQubic.toString(),
      apyBps: input.apyBps ?? 500,
    },
  });
  return inserted[0]!;
}

/**
 * Compute the current yield (as of `now`) for a reservation's deposit.
 * If the lock doesn't exist, returns 0n.
 */
export async function getCurrentYield(
  reservationId: string,
  now: Date = new Date(),
): Promise<bigint> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeYieldLock)
    .where(eq(nodeYieldLock.reservationId, reservationId))
    .limit(1);
  const lock = rows[0];
  if (!lock) return 0n;
  const elapsedMs = now.getTime() - lock.lockedAt.getTime();
  if (elapsedMs <= 0) return 0n;
  return computeLinearAccrual(lock.principalQubic, lock.apyBps, elapsedMs);
}

/**
 * Release the lock and capture the yield at release time. Idempotent.
 * Returns the captured yield.
 */
export async function releaseLock(
  reservationId: string,
  now: Date = new Date(),
): Promise<bigint> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeYieldLock)
    .where(eq(nodeYieldLock.reservationId, reservationId))
    .limit(1);
  const lock = rows[0];
  if (!lock) return 0n;
  if (lock.releasedAt) return lock.yieldAtReleaseQubic ?? 0n;
  const elapsedMs = now.getTime() - lock.lockedAt.getTime();
  const yieldQubic = computeLinearAccrual(lock.principalQubic, lock.apyBps, elapsedMs);
  await db
    .update(nodeYieldLock)
    .set({
      releasedAt: now,
      yieldAtReleaseQubic: yieldQubic,
      updatedAt: now,
    })
    .where(eq(nodeYieldLock.reservationId, reservationId));
  logActivity(db, {
    action: "node_yield_lock.released",
    targetType: "node_yield_lock",
    targetId: lock.id,
    metadata: {
      principalQubic: lock.principalQubic.toString(),
      yieldQubic: yieldQubic.toString(),
    },
  });
  return yieldQubic;
}

export async function getLock(reservationId: string): Promise<NodeYieldLock | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeYieldLock)
    .where(eq(nodeYieldLock.reservationId, reservationId))
    .limit(1);
  return rows[0] ?? null;
}
