/**
 * Contributors service — CRUD over `economy_contributor_shares`.
 *
 * The canonical store of "who gets what share of an ANN's revenue".
 * Pure CRUD plus a `replaceShares(annId, shares)` helper that does a
 * transactional replace (deactivate old, insert new) for the common
 * case of "the creator updated the contributor list."
 *
 * The sum-of-bps invariant (== 10000) is checked at the service layer
 * before writes hit the DB. The DB does not enforce this.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  contributorShares,
  type ContributorShare,
  type NewContributorShare,
} from "../db/schema.js";

export class ContributorShareError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ContributorShareError";
  }
}

export async function listShares(annId: string): Promise<ContributorShare[]> {
  const db = getDb();
  return db
    .select()
    .from(contributorShares)
    .where(and(eq(contributorShares.annId, annId), eq(contributorShares.isActive, true)));
}

export async function getShare(id: string): Promise<ContributorShare | null> {
  const db = getDb();
  const rows = await db.select().from(contributorShares).where(eq(contributorShares.id, id));
  return rows[0] ?? null;
}

export async function upsertShare(input: Omit<NewContributorShare, "id" | "createdAt" | "updatedAt">): Promise<ContributorShare> {
  if (input.bps < 0 || input.bps > 10_000) {
    throw new ContributorShareError(`bps out of range: ${input.bps}`, "BPS_OUT_OF_RANGE");
  }
  const db = getDb();
  const existing = await db
    .select()
    .from(contributorShares)
    .where(
      and(
        eq(contributorShares.annId, input.annId),
        eq(contributorShares.userId, input.userId),
      ),
    );
  if (existing[0]) {
    const row = existing[0];
    await db
      .update(contributorShares)
      .set({
        bps: input.bps,
        role: input.role,
        label: input.label,
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(contributorShares.id, row.id));
    return (await getShare(row.id))!;
  }
  const inserted = await db
    .insert(contributorShares)
    .values(input)
    .returning();
  return inserted[0]!;
}

/**
 * Replace the entire contributor list for an ANN in a single transaction.
 * Deactivates the old rows, inserts the new ones. Verifies that the
 * new bps sum is exactly 10_000 (100%).
 */
export async function replaceShares(
  annId: string,
  newShares: Array<Omit<NewContributorShare, "id" | "annId" | "createdAt" | "updatedAt">>,
): Promise<ContributorShare[]> {
  const bpsSum = newShares.reduce((s, c) => s + c.bps, 0);
  if (bpsSum !== 10_000) {
    throw new ContributorShareError(
      `bps sum must equal 10000, got ${bpsSum}`,
      "BPS_SUM_INVALID",
    );
  }
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx
      .update(contributorShares)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(contributorShares.annId, annId));
    if (newShares.length === 0) return [];
    const rows = newShares.map((c) => ({ ...c, annId }));
    const inserted = await tx.insert(contributorShares).values(rows).returning();
    return inserted;
  });
}
