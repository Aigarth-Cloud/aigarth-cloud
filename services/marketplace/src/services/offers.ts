/**
 * Offers — buyer's offer on a listing.
 *
 *   Lifecycle: pending → accepted | rejected | cancelled | expired
 *   On accept: create a purchase, decrement capacity, call services/billing.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { offers, listings, type Offer, type NewOffer } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { Offer };

export const CreateOfferSchema = z.object({
  listingId: z.string().uuid(),
  amountQubic: z.string().regex(/^\d+$/),
  message: z.string().max(2_000).optional(),
  expiresAt: z.coerce.date().optional(),
  orgId: z.string().uuid().optional(),
  buyerName: z.string().min(1).max(120).optional(),
});

export async function placeOffer(
  userId: string,
  input: z.infer<typeof CreateOfferSchema>,
): Promise<Offer> {
  const db = getDb();
  const listing = (await db.select().from(listings).where(eq(listings.id, input.listingId)).limit(1))[0];
  if (!listing) throw new Error("Listing not found.");
  if (listing.status !== "active") {
    throw new Error(`Cannot offer on a listing in status '${listing.status}'.`);
  }
  if (listing.sellerUserId === userId) {
    throw new Error("You cannot offer on your own listing.");
  }
  const amount = BigInt(input.amountQubic);
  if (amount <= 0n) throw new Error("Amount must be positive.");
  if (amount < listing.minPurchaseQubic) {
    throw new Error(
      `Amount ${amount.toString()} is below the minimum ${listing.minPurchaseQubic.toString()}.`,
    );
  }
  if (amount > listing.capacityRemainingQubic) {
    throw new Error(
      `Amount ${amount.toString()} exceeds remaining capacity ${listing.capacityRemainingQubic.toString()}.`,
    );
  }
  const totalPrice = amount * listing.pricePerUnitQubic;

  const id = uid();
  const inserted = await db
    .insert(offers)
    .values({
      id,
      listingId: input.listingId,
      buyerUserId: userId,
      buyerOrgId: input.orgId ?? null,
      buyerName: input.buyerName ?? userId,
      amountQubic: amount,
      totalPriceQubic: totalPrice,
      status: "pending",
      message: input.message ?? null,
      expiresAt: input.expiresAt ?? null,
    } satisfies NewOffer)
    .returning();

  await logActivity(db, {
    action: "offer.placed",
    actorUserId: userId,
    orgId: input.orgId ?? null,
    targetType: "offer",
    targetId: id,
    metadata: { listingId: input.listingId, amount: amount.toString(), totalPrice: totalPrice.toString() },
  });

  return inserted[0]!;
}

export async function acceptOffer(
  sellerUserId: string,
  offerId: string,
): Promise<Offer | null> {
  const db = getDb();
  const offer = (await db.select().from(offers).where(eq(offers.id, offerId)).limit(1))[0];
  if (!offer) return null;
  const listing = (await db.select().from(listings).where(eq(listings.id, offer.listingId)).limit(1))[0];
  if (!listing) return null;
  if (listing.sellerUserId !== sellerUserId) {
    throw new Error("Only the listing seller can accept this offer.");
  }
  if (offer.status !== "pending") {
    throw new Error(`Cannot accept an offer in status '${offer.status}'.`);
  }
  if (listing.status !== "active") {
    throw new Error(`Cannot accept an offer on a listing in status '${listing.status}'.`);
  }
  if (offer.amountQubic > listing.capacityRemainingQubic) {
    throw new Error(
      `Offer amount ${offer.amountQubic.toString()} exceeds remaining capacity ${listing.capacityRemainingQubic.toString()}.`,
    );
  }

  const updated = await db
    .update(offers)
    .set({ status: "accepted", respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(offers.id, offerId))
    .returning();

  // Decrement capacity
  const { decrementCapacity } = await import("./listings.js");
  await decrementCapacity(listing.id, offer.amountQubic);

  // Increment offer count
  await db
    .update(listings)
    .set({ totalOffers: sql`${listings.totalOffers} + 1` })
    .where(eq(listings.id, listing.id));

  await logActivity(db, {
    action: "offer.accepted",
    actorUserId: sellerUserId,
    targetType: "offer",
    targetId: offerId,
    metadata: { listingId: listing.id, amount: offer.amountQubic.toString() },
  });

  return updated[0] ?? null;
}

export async function rejectOffer(
  sellerUserId: string,
  offerId: string,
  reason?: string,
): Promise<Offer | null> {
  const db = getDb();
  const offer = (await db.select().from(offers).where(eq(offers.id, offerId)).limit(1))[0];
  if (!offer) return null;
  const listing = (await db.select().from(listings).where(eq(listings.id, offer.listingId)).limit(1))[0];
  if (!listing) return null;
  if (listing.sellerUserId !== sellerUserId) {
    throw new Error("Only the listing seller can reject this offer.");
  }
  if (offer.status !== "pending") {
    throw new Error(`Cannot reject an offer in status '${offer.status}'.`);
  }
  const updated = await db
    .update(offers)
    .set({ status: "rejected", respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(offers.id, offerId))
    .returning();
  await logActivity(db, {
    action: "offer.rejected",
    actorUserId: sellerUserId,
    targetType: "offer",
    targetId: offerId,
    metadata: { reason: reason ?? null },
  });
  return updated[0] ?? null;
}

export async function cancelOffer(
  buyerUserId: string,
  offerId: string,
): Promise<Offer | null> {
  const db = getDb();
  const offer = (await db.select().from(offers).where(eq(offers.id, offerId)).limit(1))[0];
  if (!offer) return null;
  if (offer.buyerUserId !== buyerUserId) {
    throw new Error("Only the offer's buyer can cancel it.");
  }
  if (offer.status !== "pending") {
    throw new Error(`Cannot cancel an offer in status '${offer.status}'.`);
  }
  const updated = await db
    .update(offers)
    .set({ status: "cancelled", respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(offers.id, offerId))
    .returning();
  return updated[0] ?? null;
}

export async function listOffers(
  listingId: string,
  status?: string,
  limit = 50,
): Promise<Offer[]> {
  const db = getDb();
  const filters = [eq(offers.listingId, listingId)];
  if (status) filters.push(eq(offers.status, status as Offer["status"]));
  return db
    .select()
    .from(offers)
    .where(filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(desc(offers.createdAt))
    .limit(limit);
}

export async function listMyOffers(userId: string, limit = 50): Promise<Offer[]> {
  const db = getDb();
  return db
    .select()
    .from(offers)
    .where(eq(offers.buyerUserId, userId))
    .orderBy(desc(offers.createdAt))
    .limit(limit);
}
