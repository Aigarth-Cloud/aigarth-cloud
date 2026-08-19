/**
 * Tissue listings — Phase 18E productization.
 *
 *   Separate from `listings.ts` (compute capacity) because:
 *     - different product shape (per-decision, not per-capacity)
 *     - different lifecycle (no offers, no auctions, no purchases)
 *     - different search facets (access model, tissue metadata)
 *
 *   A tissue listing binds a tissue (slug, version) to:
 *     - a price-per-decision in QUBIC
 *     - an access model (open vs licensed)
 *     - listing metadata (title, description, tags, icon)
 *
 *   Decisions are billed at the gateway/tissue-service level via
 *   a billing hook, not here. This service only tracks the
 *   listing-side revenue aggregate.
 */

import { eq, and, or, ilike, desc, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  tissueListings,
  type TissueListing,
  type NewTissueListing,
} from "../db/schema.js";
import { uid, slugify } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { TissueListing };

export const CreateTissueListingSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(20_000).optional(),
  icon: z.string().max(60).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  tissueSlug: z.string().min(1).max(120),
  tissueVersion: z.string().min(1).max(40).default("1.0.0"),
  tissueName: z.string().min(1).max(120),
  pricePerDecisionQubic: z.string().regex(/^\d+$/),
  access: z.enum(["open", "licensed"]).default("open"),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  orgId: z.string().uuid().optional(),
  sellerName: z.string().min(1).max(120).optional(),
});

export const UpdateTissueListingSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(20_000).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  pricePerDecisionQubic: z.string().regex(/^\d+$/).optional(),
  access: z.enum(["open", "licensed"]).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  status: z.enum(["draft", "active", "paused", "sold_out", "closed"]).optional(),
});

export const ListTissueListingsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(["draft", "active", "paused", "sold_out", "closed"]).default("active"),
  visibility: z.enum(["public", "unlisted"]).optional(),
  seller: z.string().uuid().optional(),
  tissueSlug: z.string().max(120).optional(),
  access: z.enum(["open", "licensed"]).optional(),
  sort: z.enum(["newest", "oldest", "price_asc", "price_desc", "rating"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface ListTissueListingsResult {
  data: TissueListing[];
  total: number;
  limit: number;
  offset: number;
}

async function generateUniqueTissueSlug(db: ReturnType<typeof getDb>, title: string): Promise<string> {
  const base = slugify(title) || "tissue-listing";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const candidate = `${base}${suffix}`;
    const existing = await db
      .select({ id: tissueListings.id })
      .from(tissueListings)
      .where(eq(tissueListings.slug, candidate))
      .limit(1);
    if (!existing[0]) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createTissueListing(
  userId: string,
  input: z.infer<typeof CreateTissueListingSchema>,
): Promise<TissueListing> {
  const db = getDb();
  const slug = await generateUniqueTissueSlug(db, input.title);
  const id = uid();

  const inserted = await db
    .insert(tissueListings)
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
      tissueSlug: input.tissueSlug,
      tissueVersion: input.tissueVersion,
      tissueName: input.tissueName,
      pricePerDecisionQubic: BigInt(input.pricePerDecisionQubic),
      access: input.access,
      visibility: input.visibility,
      status: "draft",
    } satisfies NewTissueListing)
    .returning();

  await logActivity(db, {
    action: "tissue_listing.created",
    actorUserId: userId,
    orgId: input.orgId ?? null,
    targetType: "tissue_listing",
    targetId: id,
    metadata: {
      slug,
      tissue_slug: input.tissueSlug,
      price_per_decision_qubic: input.pricePerDecisionQubic,
      access: input.access,
    },
  });

  return inserted[0]!;
}

export async function updateTissueListing(
  userId: string,
  listingId: string,
  input: z.infer<typeof UpdateTissueListingSchema>,
): Promise<TissueListing | null> {
  const db = getDb();
  const existing = (await db
    .select()
    .from(tissueListings)
    .where(eq(tissueListings.id, listingId))
    .limit(1))[0];
  if (!existing) return null;
  if (existing.sellerUserId !== userId) {
    throw new Error("Only the seller can update this tissue listing.");
  }
  if (existing.status === "closed") {
    throw new Error("Cannot update a closed tissue listing.");
  }

  const updates: Partial<NewTissueListing> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.pricePerDecisionQubic !== undefined) {
    updates.pricePerDecisionQubic = BigInt(input.pricePerDecisionQubic);
  }
  if (input.access !== undefined) updates.access = input.access;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.status !== undefined) {
    if (input.status === "active" && existing.status === "draft" && !existing.publishedAt) {
      updates.publishedAt = new Date();
    }
    updates.status = input.status;
  }

  const updated = await db
    .update(tissueListings)
    .set(updates)
    .where(eq(tissueListings.id, listingId))
    .returning();

  await logActivity(db, {
    action: "tissue_listing.updated",
    actorUserId: userId,
    targetType: "tissue_listing",
    targetId: listingId,
    metadata: { fields: Object.keys(input) },
  });
  return updated[0] ?? null;
}

export async function closeTissueListing(
  userId: string,
  listingId: string,
): Promise<TissueListing | null> {
  const db = getDb();
  const existing = (await db
    .select()
    .from(tissueListings)
    .where(eq(tissueListings.id, listingId))
    .limit(1))[0];
  if (!existing) return null;
  if (existing.sellerUserId !== userId) {
    throw new Error("Only the seller can close this tissue listing.");
  }
  const updated = await db
    .update(tissueListings)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(tissueListings.id, listingId))
    .returning();
  await logActivity(db, {
    action: "tissue_listing.closed",
    actorUserId: userId,
    targetType: "tissue_listing",
    targetId: listingId,
  });
  return updated[0] ?? null;
}

export async function getTissueListingById(id: string): Promise<TissueListing | null> {
  const db = getDb();
  const rows = await db.select().from(tissueListings).where(eq(tissueListings.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getTissueListingBySlug(slug: string): Promise<TissueListing | null> {
  const db = getDb();
  const rows = await db.select().from(tissueListings).where(eq(tissueListings.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getTissueListing(idOrSlug: string): Promise<TissueListing | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)) {
    return getTissueListingById(idOrSlug);
  }
  return getTissueListingBySlug(idOrSlug);
}

/**
 * Increment a tissue listing's decision counter. Called by the
 * tissue service on every successful /decide (so the marketplace
 * can show live "decisions per minute" stats).
 */
export async function recordTissueDecision(
  listingId: string,
  revenueQubic: bigint,
): Promise<void> {
  const db = getDb();
  await db
    .update(tissueListings)
    .set({
      totalDecisions: sql`${tissueListings.totalDecisions} + 1`,
      totalRevenueQubic: sql`${tissueListings.totalRevenueQubic} + ${revenueQubic}`,
      updatedAt: new Date(),
    })
    .where(eq(tissueListings.id, listingId));
}

export async function listTissueListings(
  query: z.infer<typeof ListTissueListingsQuerySchema>,
): Promise<ListTissueListingsResult> {
  const db = getDb();
  const filters: ReturnType<typeof eq>[] = [];

  filters.push(eq(tissueListings.status, query.status));
  if (query.visibility) {
    filters.push(eq(tissueListings.visibility, query.visibility));
  } else {
    filters.push(eq(tissueListings.visibility, "public"));
  }
  if (query.seller) {
    filters.push(eq(tissueListings.sellerUserId, query.seller));
  }
  if (query.tissueSlug) {
    filters.push(eq(tissueListings.tissueSlug, query.tissueSlug));
  }
  if (query.access) {
    filters.push(eq(tissueListings.access, query.access));
  }
  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    const orCond = or(
      ilike(tissueListings.title, needle),
      ilike(tissueListings.description, needle),
      ilike(tissueListings.tissueName, needle),
    );
    if (orCond) filters.push(orCond);
  }

  const where = filters.length === 1 ? filters[0] : and(...filters);

  let orderBy;
  switch (query.sort) {
    case "oldest":
      orderBy = asc(tissueListings.publishedAt);
      break;
    case "price_asc":
      orderBy = asc(tissueListings.pricePerDecisionQubic);
      break;
    case "price_desc":
      orderBy = desc(tissueListings.pricePerDecisionQubic);
      break;
    case "rating":
      orderBy = desc(tissueListings.ratingAverage);
      break;
    case "newest":
    default:
      orderBy = desc(tissueListings.publishedAt);
  }

  const data = await db
    .select()
    .from(tissueListings)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  const total = (await db.select({ id: tissueListings.id }).from(tissueListings).where(where)).length;

  return { data, total, limit: query.limit, offset: query.offset };
}
