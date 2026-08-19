/**
 * Reviews — 1-5 stars + optional text, on a listing/auction/user.
 *
 *   One review per (target_type, target_id, reviewer_user_id). Updates the
 *   denormalized `rating_average` and `rating_count` on the target row.
 */

import { eq, and, desc, sql, count } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { reviews, listings, auctions, type Review, type NewReview } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { Review };

export const AddReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(4_000).optional(),
});

async function recomputeListingRating(listingId: string): Promise<void> {
  const db = getDb();
  const result = await db
    .select({
      avg: sql<string | null>`AVG(${reviews.rating})::numeric(3,2)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.targetType, "listing"), eq(reviews.targetId, listingId)));
  const r = result[0] ?? { avg: null, count: 0 };
  await db
    .update(listings)
    .set({ ratingAverage: r.avg, ratingCount: r.count ?? 0, updatedAt: new Date() })
    .where(eq(listings.id, listingId));
}

export async function addReview(
  userId: string,
  targetType: "listing" | "auction" | "user",
  targetId: string,
  input: z.infer<typeof AddReviewSchema>,
  reviewerName?: string,
): Promise<Review> {
  const db = getDb();
  // Verify target exists
  if (targetType === "listing") {
    const listing = (await db.select({ id: listings.id }).from(listings).where(eq(listings.id, targetId)).limit(1))[0];
    if (!listing) throw new Error("Listing not found.");
  } else if (targetType === "auction") {
    const auction = (await db.select({ id: auctions.id }).from(auctions).where(eq(auctions.id, targetId)).limit(1))[0];
    if (!auction) throw new Error("Auction not found.");
  }
  // Upsert
  const existing = (await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.targetType, targetType),
        eq(reviews.targetId, targetId),
        eq(reviews.reviewerUserId, userId),
      ),
    )
    .limit(1))[0];

  let row: Review;
  if (existing) {
    const updated = await db
      .update(reviews)
      .set({ rating: input.rating, review: input.review ?? null, updatedAt: new Date() })
      .where(eq(reviews.id, existing.id))
      .returning();
    row = updated[0]!;
  } else {
    const id = uid();
    const inserted = await db
      .insert(reviews)
      .values({
        id,
        targetType,
        targetId,
        reviewerUserId: userId,
        reviewerName: reviewerName ?? userId,
        rating: input.rating,
        review: input.review ?? null,
      } satisfies NewReview)
      .returning();
    row = inserted[0]!;
  }

  if (targetType === "listing") {
    await recomputeListingRating(targetId);
  }

  await logActivity(db, {
    action: "review.added",
    actorUserId: userId,
    targetType: targetType === "listing" ? "listing" : targetType === "auction" ? "auction" : "user",
    targetId,
    metadata: { rating: input.rating },
  });

  return row;
}

export async function listReviews(
  targetType: "listing" | "auction" | "user",
  targetId: string,
  limit = 50,
): Promise<Review[]> {
  const db = getDb();
  return db
    .select()
    .from(reviews)
    .where(and(eq(reviews.targetType, targetType), eq(reviews.targetId, targetId)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}
