/**
 * Locks service — CRUD over `economy_aigarth_locks`.
 *
 * The off-chain mirror of observed Qearn locks. The qearn-watcher
 * worker (`src/workers/qearn-watcher.ts`) writes here; the
 * compute-grant orchestration in `src/services/payouts.ts` reads from
 * here to refresh a user's compute allocation.
 *
 * State machine:
 *   observed → active → (unlocking →) ended | expired | failed
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  aigarthEconomyLocks,
  type AigarthEconomyLock,
  type NewAigarthEconomyLock,
} from "../db/schema.js";
import { computeGrantUnits } from "./splits.js";

export async function listLocksForUser(userId: string): Promise<AigarthEconomyLock[]> {
  const db = getDb();
  return db
    .select()
    .from(aigarthEconomyLocks)
    .where(eq(aigarthEconomyLocks.userId, userId))
    .orderBy(desc(aigarthEconomyLocks.createdAt));
}

export async function listActiveLocks(): Promise<AigarthEconomyLock[]> {
  const db = getDb();
  return db
    .select()
    .from(aigarthEconomyLocks)
    .where(eq(aigarthEconomyLocks.status, "active"))
    .orderBy(desc(aigarthEconomyLocks.createdAt));
}

export async function getLock(id: string): Promise<AigarthEconomyLock | null> {
  const db = getDb();
  const rows = await db.select().from(aigarthEconomyLocks).where(eq(aigarthEconomyLocks.id, id));
  return rows[0] ?? null;
}

export async function getLockByQearnId(qearnLockId: string): Promise<AigarthEconomyLock | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(aigarthEconomyLocks)
    .where(eq(aigarthEconomyLocks.qearnLockId, qearnLockId));
  return rows[0] ?? null;
}

/**
 * Record a newly observed Qearn lock. Idempotent on `qearnLockId`.
 * Computes the initial compute grant and stores it on the row.
 */
export async function recordLock(
  input: Omit<NewAigarthEconomyLock, "id" | "createdAt" | "updatedAt" | "computeGrantUnits">,
): Promise<AigarthEconomyLock> {
  const grantUnits = computeGrantUnits(input.amountQubic, input.totalWeeks);
  const db = getDb();
  const existing = await getLockByQearnId(input.qearnLockId);
  if (existing) return existing;
  const inserted = await db
    .insert(aigarthEconomyLocks)
    .values({ ...input, computeGrantUnits: grantUnits })
    .returning();
  return inserted[0]!;
}

/**
 * Mark a lock as ending (unlock intent broadcast, awaiting finality).
 * Idempotent.
 */
export async function markUnlocking(lockId: string, unlockTxHash: string): Promise<AigarthEconomyLock | null> {
  const db = getDb();
  const rows = await db
    .update(aigarthEconomyLocks)
    .set({ status: "unlocking", unlockTxHash, updatedAt: new Date() })
    .where(and(eq(aigarthEconomyLocks.id, lockId), eq(aigarthEconomyLocks.status, "active")))
    .returning();
  return rows[0] ?? null;
}

/**
 * Mark a lock as ended (unlock finalized). Stores the net reward and
 * penalty burned. Revokes the compute grant (sets it to 0).
 */
export async function markEnded(
  lockId: string,
  netRewardQubic: bigint,
  penaltyBurnedQubic: bigint,
): Promise<AigarthEconomyLock | null> {
  const db = getDb();
  const rows = await db
    .update(aigarthEconomyLocks)
    .set({
      status: "ended",
      netRewardQubic,
      penaltyBurnedQubic,
      computeGrantUnits: 0n,
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aigarthEconomyLocks.id, lockId))
    .returning();
  return rows[0] ?? null;
}

/**
 * Sum of active compute grants for a user. Used by services/compute
 * (or by the web app) to know "how much compute does this user have?"
 */
export async function totalActiveGrantForUser(userId: string): Promise<bigint> {
  const db = getDb();
  const rows = await db
    .select({ total: sql<bigint>`coalesce(sum(${aigarthEconomyLocks.computeGrantUnits}), 0)` })
    .from(aigarthEconomyLocks)
    .where(and(eq(aigarthEconomyLocks.userId, userId), eq(aigarthEconomyLocks.status, "active")));
  return rows[0]?.total ?? 0n;
}
