/**
 * Auctions — Dutch, English, sealed-bid.
 *
 *   Dutch: descending price. start_price → min_price over tick_interval. First bid wins.
 *   English: ascending bids. Each bid must be > current winning. Highest at end wins.
 *   Sealed-bid: each bidder submits one bid (sealedAt set). Highest at end wins.
 *
 *   For Phase 6, the auction logic is in-process (no background worker).
 *   For end-time, the marketplace route handlers trigger settlement on
 *   `GET /v1/auctions/:id` if the auction has ended.
 */

import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { auctions, bids, purchases, type Auction, type NewAuction, type NewPurchase } from "../db/schema.js";
import { uid, slugify } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";

export type { Auction };

const DutchAuctionSchema = z.object({
  kind: z.literal("dutch"),
  startPriceQubic: z.string().regex(/^\d+$/),
  minPriceQubic: z.string().regex(/^\d+$/),
  decrementPerTickQubic: z.string().regex(/^\d+$/),
  tickIntervalSeconds: z.number().int().min(1).max(86400),
  reservePriceQubic: z.string().regex(/^\d+$/).optional(),
});

const EnglishAuctionSchema = z.object({
  kind: z.literal("english"),
  minPriceQubic: z.string().regex(/^\d+$/),
  reservePriceQubic: z.string().regex(/^\d+$/).optional(),
  startPriceQubic: z.string().regex(/^\d+$/).optional(), // ignored for english
});

const SealedBidAuctionSchema = z.object({
  kind: z.literal("sealed_bid"),
  minPriceQubic: z.string().regex(/^\d+$/),
  reservePriceQubic: z.string().regex(/^\d+$/).optional(),
  startPriceQubic: z.string().regex(/^\d+$/).optional(),
});

const AuctionBaseSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(20_000).optional(),
  icon: z.string().max(60).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  regionId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
  capacityAmountQubic: z.string().regex(/^\d+$/),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  orgId: z.string().uuid().optional(),
  sellerName: z.string().min(1).max(120).optional(),
});

export const CreateAuctionSchema = z.discriminatedUnion("kind", [
  AuctionBaseSchema.merge(DutchAuctionSchema),
  AuctionBaseSchema.merge(EnglishAuctionSchema),
  AuctionBaseSchema.merge(SealedBidAuctionSchema),
]);

async function generateUniqueSlug(db: ReturnType<typeof getDb>, title: string): Promise<string> {
  const base = slugify(title) || "auction";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const candidate = `${base}${suffix}`;
    const existing = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(eq(auctions.slug, candidate))
      .limit(1);
    if (!existing[0]) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Compute the current price of a Dutch auction at time `now`. */
export function computeDutchPrice(
  startPrice: bigint,
  minPrice: bigint,
  decrementPerTick: bigint,
  tickIntervalSeconds: number,
  startsAt: Date,
  now: Date,
): bigint {
  if (now < startsAt) return startPrice;
  const elapsedMs = now.getTime() - startsAt.getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const ticks = Math.floor(elapsedSeconds / tickIntervalSeconds);
  const dec = decrementPerTick * BigInt(ticks);
  if (dec >= startPrice - minPrice) return minPrice;
  return startPrice - dec;
}

export async function createAuction(
  userId: string,
  input: z.infer<typeof CreateAuctionSchema>,
): Promise<Auction> {
  const db = getDb();
  const slug = await generateUniqueSlug(db, input.title);
  if (input.endsAt <= input.startsAt) {
    throw new Error("endsAt must be after startsAt.");
  }
  const capacity = BigInt(input.capacityAmountQubic);
  const startPrice = BigInt(input.startPriceQubic ?? "0");
  const minPrice = BigInt(input.minPriceQubic);
  const reservePrice = input.reservePriceQubic ? BigInt(input.reservePriceQubic) : null;

  if (input.kind === "dutch") {
    if (startPrice < minPrice) throw new Error("Dutch: startPrice must be >= minPrice.");
    if (input.decrementPerTickQubic && BigInt(input.decrementPerTickQubic) === 0n) {
      throw new Error("Dutch: decrementPerTickQubic must be positive.");
    }
  } else if (input.kind === "english" || input.kind === "sealed_bid") {
    if (minPrice <= 0n) throw new Error(`${input.kind}: minPrice must be positive.`);
  }

  const id = uid();
  const now = new Date();
  const status: Auction["status"] = input.startsAt <= now ? "live" : "scheduled";

  const inserted = await db
    .insert(auctions)
    .values({
      id,
      slug,
      title: input.title,
      description: input.description ?? null,
      icon: input.icon ?? null,
      tags: input.tags,
      sellerUserId: userId,
      sellerOrgId: input.orgId ?? null,
      sellerName: input.sellerName ?? userId,
      regionId: input.regionId ?? null,
      clusterId: input.clusterId ?? null,
      kind: input.kind,
      capacityAmountQubic: capacity,
      startPriceQubic: startPrice,
      minPriceQubic: minPrice,
      decrementPerTickQubic: input.kind === "dutch" && input.decrementPerTickQubic
        ? BigInt(input.decrementPerTickQubic)
        : null,
      tickIntervalSeconds: input.kind === "dutch" && input.tickIntervalSeconds
        ? input.tickIntervalSeconds
        : null,
      reservePriceQubic: reservePrice,
      currentPriceQubic: input.kind === "dutch" ? startPrice : null,
      status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    } satisfies NewAuction)
    .returning();

  await logActivity(db, {
    action: "auction.created",
    actorUserId: userId,
    orgId: input.orgId ?? null,
    targetType: "auction",
    targetId: id,
    metadata: { kind: input.kind, capacity: capacity.toString() },
  });

  return inserted[0]!;
}

export async function getAuctionById(id: string): Promise<Auction | null> {
  const db = getDb();
  const rows = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getAuctionBySlug(slug: string): Promise<Auction | null> {
  const db = getDb();
  const rows = await db.select().from(auctions).where(eq(auctions.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getAuction(idOrSlug: string): Promise<Auction | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)) {
    return getAuctionById(idOrSlug);
  }
  return getAuctionBySlug(idOrSlug);
}

/** Recompute the Dutch auction's current price (called on read). */
export async function refreshDutchPrice(auctionId: string): Promise<Auction | null> {
  const db = getDb();
  const a = (await db.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1))[0];
  if (!a) return null;
  if (a.kind !== "dutch" || !a.decrementPerTickQubic || !a.tickIntervalSeconds) return a;
  const now = new Date();
  const newPrice = computeDutchPrice(
    a.startPriceQubic,
    a.minPriceQubic,
    a.decrementPerTickQubic,
    a.tickIntervalSeconds,
    a.startsAt,
    now,
  );
  // If price has hit min, mark the auction as ended
  if (newPrice <= a.minPriceQubic && a.status === "live") {
    await db
      .update(auctions)
      .set({ currentPriceQubic: newPrice, status: "ended", updatedAt: new Date() })
      .where(eq(auctions.id, auctionId));
    return { ...a, currentPriceQubic: newPrice, status: "ended" };
  }
  if (a.currentPriceQubic !== newPrice) {
    await db
      .update(auctions)
      .set({ currentPriceQubic: newPrice, updatedAt: new Date() })
      .where(eq(auctions.id, auctionId));
    return { ...a, currentPriceQubic: newPrice };
  }
  return a;
}

/** Settle an auction (called on read if ended). For English/sealed: highest bid wins.
 *  For Dutch: this is a no-op (Dutch settles on first bid). */
export async function settleAuction(auctionId: string): Promise<Auction | null> {
  const db = getDb();
  const a = (await db.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1))[0];
  if (!a) return null;
  if (a.status !== "ended" && a.status !== "live") return a;
  if (a.kind === "dutch") return a; // Already settles on first bid

  const now = new Date();
  if (a.endsAt > now && a.status === "live") return a; // Not yet ended

  // Find the highest bid
  const topBid = (await db
    .select()
    .from(bids)
    .where(eq(bids.auctionId, auctionId))
    .orderBy(desc(bids.amountQubic))
    .limit(1))[0];

  if (!topBid) {
    await db
      .update(auctions)
      .set({ status: "settled", settledAt: now, updatedAt: now })
      .where(eq(auctions.id, auctionId));
    return (await db.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1))[0] ?? null;
  }

  // Mark winner + losers
  await db
    .update(bids)
    .set({ status: "won", isWinning: false, updatedAt: now })
    .where(eq(bids.id, topBid.id));
  await db
    .update(bids)
    .set({ status: "lost", isWinning: false, updatedAt: now })
    .where(and(eq(bids.auctionId, auctionId), sql`${bids.id} != ${topBid.id}`));

  await db
    .update(auctions)
    .set({
      status: "settled",
      settledAt: now,
      winnerUserId: topBid.bidderUserId,
      winningBidQubic: topBid.amountQubic,
      updatedAt: now,
    })
    .where(eq(auctions.id, auctionId));

  // Pseudo-purchase for the winning bid
  const purchaseId = uid();
  const cfg = loadConfig();
  const platformFee = (topBid.amountQubic * BigInt(cfg.MKT_PLATFORM_FEE_BPS)) / 10000n;
  await db.insert(purchases).values({
    id: purchaseId,
    listingId: null,
    offerId: null,
    buyerUserId: topBid.bidderUserId,
    buyerOrgId: topBid.bidderOrgId,
    sellerUserId: a.sellerUserId,
    amountQubic: a.capacityAmountQubic,
    totalPriceQubic: topBid.amountQubic,
    platformFeeQubic: platformFee,
    status: "completed",
    completedAt: now,
  } as unknown as NewPurchase);

  await logActivity(db, {
    action: "auction.settled",
    actorUserId: null,
    targetType: "auction",
    targetId: auctionId,
    metadata: { winnerUserId: topBid.bidderUserId, amount: topBid.amountQubic.toString() },
  });

  return (await db.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1))[0] ?? null;
}

export async function listAuctions(
  filters: { kind?: "dutch" | "english" | "sealed_bid"; status?: Auction["status"]; seller?: string; limit?: number; includeAllStatuses?: boolean } = {},
): Promise<Auction[]> {
  const db = getDb();
  const conds: ReturnType<typeof eq>[] = [];
  if (filters.kind) conds.push(eq(auctions.kind, filters.kind));
  if (filters.status) conds.push(eq(auctions.status, filters.status));
  else if (!filters.includeAllStatuses) conds.push(eq(auctions.status, "live"));
  if (filters.seller) conds.push(eq(auctions.sellerUserId, filters.seller));
  return db
    .select()
    .from(auctions)
    .where(conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds))
    .orderBy(desc(auctions.startsAt))
    .limit(filters.limit ?? 50);
}
