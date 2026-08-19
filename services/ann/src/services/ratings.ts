/**
 * ANN ratings — peer reviews (1-5 stars + optional text).
 *
 *   - One rating per (ann, user). Subsequent rates update the existing row.
 *   - `verifiedUse` is set if the user has ever deployed this ANN.
 *   - The denormalized `anns.rating_average` and `anns.rating_count` are
 *     recomputed after every rate via `recomputeRatingAggregates`.
 */

import { eq, and, desc, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { anns, annRatings, annDeployments, type AnnRating } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { recomputeRatingAggregates } from "./anns.js";

export type { AnnRating };

export const RateAnnSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(4_000).optional(),
});

export async function rateAnn(
  userId: string,
  annId: string,
  input: z.infer<typeof RateAnnSchema>,
): Promise<AnnRating> {
  const db = getDb();
  const ann = (await db.select({ id: anns.id, status: anns.status }).from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) throw new Error("ANN not found.");
  if (ann.status !== "published") {
    throw new Error("Can only rate a published ANN.");
  }

  // Check if the user has ever deployed this ANN (for verifiedUse)
  const deployed = (await db
    .select({ id: annDeployments.id })
    .from(annDeployments)
    .where(and(eq(annDeployments.annId, annId), eq(annDeployments.ownerUserId, userId)))
    .limit(1))[0];
  const verifiedUse = !!deployed;

  // Upsert
  const existing = (await db
    .select()
    .from(annRatings)
    .where(and(eq(annRatings.annId, annId), eq(annRatings.userId, userId)))
    .limit(1))[0];

  let row: AnnRating;
  if (existing) {
    const updated = await db
      .update(annRatings)
      .set({
        rating: input.rating,
        review: input.review ?? null,
        verifiedUse,
        updatedAt: new Date(),
      })
      .where(eq(annRatings.id, existing.id))
      .returning();
    row = updated[0]!;
  } else {
    const id = uid();
    const inserted = await db
      .insert(annRatings)
      .values({
        id,
        annId,
        userId,
        rating: input.rating,
        review: input.review ?? null,
        verifiedUse,
      })
      .returning();
    row = inserted[0]!;
  }

  await recomputeRatingAggregates(annId);

  await logActivity(db, {
    action: "ann.rating_added",
    actorUserId: userId,
    targetType: "ann",
    targetId: annId,
    metadata: { rating: input.rating, verifiedUse },
  });

  return row;
}

export async function listRatings(annId: string, limit = 50): Promise<AnnRating[]> {
  const db = getDb();
  return db
    .select()
    .from(annRatings)
    .where(eq(annRatings.annId, annId))
    .orderBy(desc(annRatings.createdAt))
    .limit(limit);
}

export async function getMyRating(userId: string, annId: string): Promise<AnnRating | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(annRatings)
    .where(and(eq(annRatings.annId, annId), eq(annRatings.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteRating(userId: string, annId: string): Promise<boolean> {
  const db = getDb();
  const res = await db
    .delete(annRatings)
    .where(and(eq(annRatings.annId, annId), eq(annRatings.userId, userId)))
    .returning({ id: annRatings.id });
  if (res.length > 0) {
    await recomputeRatingAggregates(annId);
    return true;
  }
  return false;
}
