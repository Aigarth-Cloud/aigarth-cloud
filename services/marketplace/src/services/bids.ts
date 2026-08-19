/**
 * Bids — place, win, outbid, settle.
 *
 *   Dutch: bid must be >= current price. First bid wins.
 *   English: bid must be > current winning. Outbid previous.
 *   Sealed-bid: any bid >= min. Multiple bidders can bid. Highest wins at end.
 *
 *   On win (auction settles), the bid's status flips to "won" and a
 *   pseudo-purchase is created.
 */

import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { bids, auctions, type Bid, type NewBid, purchases, type NewPurchase } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { refreshDutchPrice } from "./auctions.js";
import { loadConfig } from "../config/index.js";

export type { Bid };

export const PlaceBidSchema = z.object({
  amountQubic: z.string().regex(/^\d+$/),
  orgId: z.string().uuid().optional(),
  bidderName: z.string().min(1).max(120).optional(),
});

export async function placeBid(
  userId: string,
  auctionId: string,
  input: z.infer<typeof PlaceBidSchema>,
): Promise<Bid> {
  const db = getDb();
  // Refresh Dutch price first
  const a = await refreshDutchPrice(auctionId);
  if (!a) throw new Error("Auction not found.");
  if (a.sellerUserId === userId) {
    throw new Error("You cannot bid on your own auction.");
  }

  const now = new Date();
  if (a.startsAt > now) throw new Error("Auction has not started yet.");
  if (a.endsAt <= now || a.status === "ended" || a.status === "settled" || a.status === "cancelled") {
    throw new Error("Auction has ended.");
  }
  if (a.status === "scheduled") {
    // Shouldn't happen given the startsAt check, but just in case
    throw new Error("Auction is not live.");
  }

  const amount = BigInt(input.amountQubic);
  if (amount < a.minPriceQubic) {
    throw new Error(`Bid must be at least minPrice ${a.minPriceQubic.toString()}.`);
  }
  if (a.reservePriceQubic && amount < a.reservePriceQubic) {
    throw new Error(`Bid must be at least reservePrice ${a.reservePriceQubic.toString()}.`);
  }

  if (a.kind === "dutch") {
    if (!a.currentPriceQubic) {
      throw new Error("Dutch auction missing current price.");
    }
    // First bid wins at the current price (we accept >= to be lenient)
    if (amount < a.currentPriceQubic) {
      throw new Error(`Dutch auction: bid must be >= current price ${a.currentPriceQubic.toString()}.`);
    }
    // Settle immediately
    const id = uid();
    const inserted = await db
      .insert(bids)
      .values({
        id,
        auctionId,
        bidderUserId: userId,
        bidderOrgId: input.orgId ?? null,
        bidderName: input.bidderName ?? userId,
        amountQubic: amount,
        status: "won",
        isWinning: true,
        sealedAt: null,
      } satisfies NewBid)
      .returning();
    // Settle auction
    await db
      .update(auctions)
      .set({
        status: "settled",
        settledAt: now,
        winnerUserId: userId,
        winningBidQubic: amount,
        updatedAt: now,
      })
      .where(eq(auctions.id, auctionId));
    // Create a pseudo-purchase
    const purchaseId = uid();
    const cfg = loadConfig();
    const platformFee = (amount * BigInt(cfg.MKT_PLATFORM_FEE_BPS)) / 10000n;
    await db.insert(purchases).values({
      id: purchaseId,
      listingId: null,
      offerId: null,
      buyerUserId: userId,
      buyerOrgId: input.orgId ?? null,
      sellerUserId: a.sellerUserId,
      amountQubic: a.capacityAmountQubic,
      totalPriceQubic: amount,
      platformFeeQubic: platformFee,
      status: "completed",
      completedAt: now,
    } as unknown as NewPurchase);
    await logActivity(db, {
      action: "bid.won",
      actorUserId: userId,
      orgId: input.orgId ?? null,
      targetType: "bid",
      targetId: id,
      metadata: { auctionId, amount: amount.toString() },
    });
    return inserted[0]!;
  } else if (a.kind === "english") {
    if (a.currentWinningBidQubic && amount <= a.currentWinningBidQubic) {
      throw new Error(
        `English auction: bid must be > current winning ${a.currentWinningBidQubic.toString()}.`,
      );
    }
    // Mark previous winning as outbid
    await db
      .update(bids)
      .set({ status: "outbid", isWinning: false, updatedAt: now })
      .where(and(eq(bids.auctionId, auctionId), eq(bids.isWinning, true)));
    const id = uid();
    const inserted = await db
      .insert(bids)
      .values({
        id,
        auctionId,
        bidderUserId: userId,
        bidderOrgId: input.orgId ?? null,
        bidderName: input.bidderName ?? userId,
        amountQubic: amount,
        status: "winning",
        isWinning: true,
      } satisfies NewBid)
      .returning();
    await db
      .update(auctions)
      .set({ currentWinningBidQubic: amount, updatedAt: now })
      .where(eq(auctions.id, auctionId));
    await logActivity(db, {
      action: "bid.placed",
      actorUserId: userId,
      orgId: input.orgId ?? null,
      targetType: "bid",
      targetId: id,
      metadata: { auctionId, amount: amount.toString() },
    });
    return inserted[0]!;
  } else {
    // sealed_bid
    // One bid per bidder
    const existing = (await db
      .select({ id: bids.id })
      .from(bids)
      .where(and(eq(bids.auctionId, auctionId), eq(bids.bidderUserId, userId)))
      .limit(1))[0];
    if (existing) {
      throw new Error("Sealed-bid: you have already placed a bid.");
    }
    const id = uid();
    const inserted = await db
      .insert(bids)
      .values({
        id,
        auctionId,
        bidderUserId: userId,
        bidderOrgId: input.orgId ?? null,
        bidderName: input.bidderName ?? userId,
        amountQubic: amount,
        status: "active",
        isWinning: false,
        sealedAt: now,
      } satisfies NewBid)
      .returning();
    await logActivity(db, {
      action: "bid.placed",
      actorUserId: userId,
      orgId: input.orgId ?? null,
      targetType: "bid",
      targetId: id,
      metadata: { auctionId, amount: amount.toString() },
    });
    return inserted[0]!;
  }
}

export async function listBids(auctionId: string, limit = 50): Promise<Bid[]> {
  const db = getDb();
  return db
    .select()
    .from(bids)
    .where(eq(bids.auctionId, auctionId))
    .orderBy(desc(bids.amountQubic))
    .limit(limit);
}

export async function listMyBids(userId: string, limit = 50): Promise<Bid[]> {
  const db = getDb();
  return db
    .select()
    .from(bids)
    .where(eq(bids.bidderUserId, userId))
    .orderBy(desc(bids.createdAt))
    .limit(limit);
}
