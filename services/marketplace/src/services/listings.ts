/**
 * Listings — compute capacity listings (spot / reserved / futures).
 *
 *   Slug auto-gen from title. Capacity decrements as offers are accepted.
 *   Status: draft → active → paused / sold_out / closed.
 */

import { eq, and, or, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  listings,
  type Listing,
  type NewListing,
  mktCapacityKind,
} from "../db/schema.js";
import { uid, slugify } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { Listing };

export const CreateListingSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(20_000).optional(),
  icon: z.string().max(60).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  kind: z.enum(["spot", "reserved", "futures"]),
  regionId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
  capacityAmountQubic: z.string().regex(/^\d+$/),
  pricePerUnitQubic: z.string().regex(/^\d+$/),
  durationSeconds: z.string().regex(/^\d+$/),
  minPurchaseQubic: z.string().regex(/^\d+$/).default("0"),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  unlocksAt: z.coerce.date().optional(),
  orgId: z.string().uuid().optional(),
  sellerName: z.string().min(1).max(120).optional(),
});

export const UpdateListingSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(20_000).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  pricePerUnitQubic: z.string().regex(/^\d+$/).optional(),
  durationSeconds: z.string().regex(/^\d+$/).optional(),
  minPurchaseQubic: z.string().regex(/^\d+$/).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  status: z.enum(["draft", "active", "paused", "sold_out", "closed"]).optional(),
});

export const ListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  kind: z.enum(["spot", "reserved", "futures"]).optional(),
  status: z.enum(["draft", "active", "paused", "sold_out", "closed"]).default("active"),
  visibility: z.enum(["public", "unlisted"]).optional(),
  seller: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["newest", "oldest", "price_asc", "price_desc", "capacity_desc", "rating"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface ListResult {
  data: Listing[];
  total: number;
  limit: number;
  offset: number;
}

async function generateUniqueSlug(db: ReturnType<typeof getDb>, title: string): Promise<string> {
  const base = slugify(title) || "listing";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const candidate = `${base}${suffix}`;
    const existing = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.slug, candidate))
      .limit(1);
    if (!existing[0]) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createListing(
  userId: string,
  input: z.infer<typeof CreateListingSchema>,
): Promise<Listing> {
  const db = getDb();
  const slug = await generateUniqueSlug(db, input.title);
  const capacity = BigInt(input.capacityAmountQubic);
  const id = uid();

  const inserted = await db
    .insert(listings)
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
      capacityRemainingQubic: capacity,
      pricePerUnitQubic: BigInt(input.pricePerUnitQubic),
      durationSeconds: BigInt(input.durationSeconds),
      minPurchaseQubic: BigInt(input.minPurchaseQubic),
      visibility: input.visibility,
      status: "draft",
      totalRevenueQubic: 0n,
      unlocksAt: input.unlocksAt ?? null,
    } satisfies NewListing)
    .returning();

  await logActivity(db, {
    action: "listing.created",
    actorUserId: userId,
    orgId: input.orgId ?? null,
    targetType: "listing",
    targetId: id,
    metadata: { slug, kind: input.kind, capacity: capacity.toString() },
  });

  return inserted[0]!;
}

export async function updateListing(
  userId: string,
  listingId: string,
  input: z.infer<typeof UpdateListingSchema>,
): Promise<Listing | null> {
  const db = getDb();
  const existing = (await db.select().from(listings).where(eq(listings.id, listingId)).limit(1))[0];
  if (!existing) return null;
  if (existing.sellerUserId !== userId) {
    throw new Error("Only the seller can update this listing.");
  }
  if (existing.status === "closed") {
    throw new Error("Cannot update a closed listing.");
  }

  const updates: Partial<NewListing> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.pricePerUnitQubic !== undefined) updates.pricePerUnitQubic = BigInt(input.pricePerUnitQubic);
  if (input.durationSeconds !== undefined) updates.durationSeconds = BigInt(input.durationSeconds);
  if (input.minPurchaseQubic !== undefined) updates.minPurchaseQubic = BigInt(input.minPurchaseQubic);
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.status !== undefined) {
    if (input.status === "active" && existing.status === "draft" && !existing.publishedAt) {
      updates.publishedAt = new Date();
    }
    updates.status = input.status;
  }

  const updated = await db.update(listings).set(updates).where(eq(listings.id, listingId)).returning();
  await logActivity(db, {
    action: "listing.updated",
    actorUserId: userId,
    targetType: "listing",
    targetId: listingId,
    metadata: { fields: Object.keys(input) },
  });
  return updated[0] ?? null;
}

export async function closeListing(userId: string, listingId: string): Promise<Listing | null> {
  const db = getDb();
  const existing = (await db.select().from(listings).where(eq(listings.id, listingId)).limit(1))[0];
  if (!existing) return null;
  if (existing.sellerUserId !== userId) {
    throw new Error("Only the seller can close this listing.");
  }
  const updated = await db
    .update(listings)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(listings.id, listingId))
    .returning();
  await logActivity(db, {
    action: "listing.closed",
    actorUserId: userId,
    targetType: "listing",
    targetId: listingId,
  });
  return updated[0] ?? null;
}

export async function getListingById(id: string): Promise<Listing | null> {
  const db = getDb();
  const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const db = getDb();
  const rows = await db.select().from(listings).where(eq(listings.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getListing(idOrSlug: string): Promise<Listing | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)) {
    return getListingById(idOrSlug);
  }
  return getListingBySlug(idOrSlug);
}

/** Decrement remaining capacity (called from offers service on accept). */
export async function decrementCapacity(listingId: string, amountQubic: bigint): Promise<void> {
  const db = getDb();
  await db
    .update(listings)
    .set({
      capacityRemainingQubic: sql`GREATEST(0, ${listings.capacityRemainingQubic} - ${amountQubic})`,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));
  // Mark sold_out if capacity hit 0
  await db
    .update(listings)
    .set({ status: "sold_out" })
    .where(and(eq(listings.id, listingId), eq(listings.capacityRemainingQubic, 0n)));
}

export async function listListings(query: z.infer<typeof ListQuerySchema>): Promise<ListResult> {
  const db = getDb();
  const filters: ReturnType<typeof eq>[] = [];

  filters.push(eq(listings.status, query.status));
  if (query.visibility) {
    filters.push(eq(listings.visibility, query.visibility));
  } else {
    filters.push(eq(listings.visibility, "public"));
  }
  if (query.kind) {
    filters.push(eq(listings.kind, query.kind));
  }
  if (query.seller) {
    filters.push(eq(listings.sellerUserId, query.seller));
  }
  if (query.regionId) {
    filters.push(eq(listings.regionId, query.regionId));
  }
  if (query.clusterId) {
    filters.push(eq(listings.clusterId, query.clusterId));
  }
  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    const orCond = or(
      ilike(listings.title, needle),
      ilike(listings.description, needle),
    );
    if (orCond) filters.push(orCond);
  }
  if (query.minPrice !== undefined) {
    filters.push(sql`${listings.pricePerUnitQubic} >= ${BigInt(query.minPrice)}`);
  }
  if (query.maxPrice !== undefined) {
    filters.push(sql`${listings.pricePerUnitQubic} <= ${BigInt(query.maxPrice)}`);
  }

  const where = filters.length === 1 ? filters[0] : and(...filters);

  let orderBy;
  switch (query.sort) {
    case "oldest":
      orderBy = asc(listings.publishedAt);
      break;
    case "price_asc":
      orderBy = asc(listings.pricePerUnitQubic);
      break;
    case "price_desc":
      orderBy = desc(listings.pricePerUnitQubic);
      break;
    case "capacity_desc":
      orderBy = desc(listings.capacityRemainingQubic);
      break;
    case "rating":
      orderBy = desc(listings.ratingAverage);
      break;
    case "newest":
    default:
      orderBy = desc(listings.publishedAt);
  }

  const data = await db
    .select()
    .from(listings)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  const total = (await db.select({ id: listings.id }).from(listings).where(where)).length;

  return { data, total, limit: query.limit, offset: query.offset };
}
