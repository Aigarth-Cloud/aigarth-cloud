/**
 * Organism listings — Wave 3 / Phase B (Task 5).
 *
 *   Phase 26.C — productization of the Organism primitive (ADR 005) on
 *   the marketplace. Mirrors the tissue_listings shape but priced per
 *   fork (a buyer "buys" the right to fork a child Organism from the
 *   listed one). Lifecycle: draft → active → paused / closed.
 *
 *   Why per-fork?
 *     - An Organism is a lineaged, stateful intelligence. The buyer's
 *       right is to instantiate a new lineage child with the listed
 *       parent's genome + environment, paid in QUBIC.
 *     - Subsequent forks of the same parent from the same listing are
 *       also billable; the marketplace records `total_forks` as the
 *       per-listing usage counter.
 *     - The billing event (`organism_usage_events`, services/billing)
 *       is fired by the marketplace's internal `recordOrganismFork`
 *       hook on each successful fork; the billing service aggregates
 *       these into the user's invoice.
 *
 *   The marketplace does NOT call services/ann to verify the parent
 *   Organism exists at create time. The slug is the join key; the
 *   listing is published optimistically and the ann service is
 *   consulted at fork time.
 */

import { eq, and, or, ilike, desc, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  organismListings,
  type OrganismListing,
  type NewOrganismListing,
} from "../db/schema.js";
import { uid, slugify } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { OrganismListing };

export const CreateOrganismListingSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(20_000).optional(),
  icon: z.string().max(60).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  organismSlug: z.string().min(1).max(120),
  organismGeneration: z.number().int().min(0).default(0),
  organismName: z.string().min(1).max(120),
  organismKind: z.enum([
    "researcher",
    "optimizer",
    "predictor",
    "synthetist",
    "custom",
  ]),
  pricePerForkQubic: z.string().regex(/^\d+$/),
  access: z.enum(["open", "licensed"]).default("open"),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  orgId: z.string().uuid().optional(),
  sellerName: z.string().min(1).max(120).optional(),
});

export const UpdateOrganismListingSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(20_000).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  pricePerForkQubic: z.string().regex(/^\d+$/).optional(),
  access: z.enum(["open", "licensed"]).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  status: z.enum(["draft", "active", "paused", "sold_out", "closed"]).optional(),
});

export const ListOrganismListingsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z
    .enum(["draft", "active", "paused", "sold_out", "closed"])
    .default("active"),
  visibility: z.enum(["public", "unlisted"]).optional(),
  seller: z.string().uuid().optional(),
  organismSlug: z.string().max(120).optional(),
  organismKind: z
    .enum(["researcher", "optimizer", "predictor", "synthetist", "custom"])
    .optional(),
  access: z.enum(["open", "licensed"]).optional(),
  sort: z
    .enum(["newest", "oldest", "price_asc", "price_desc", "rating", "forks_desc"])
    .default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface ListOrganismListingsResult {
  data: OrganismListing[];
  total: number;
  limit: number;
  offset: number;
}

async function generateUniqueOrganismSlug(
  db: ReturnType<typeof getDb>,
  title: string,
): Promise<string> {
  const base = slugify(title) || "organism-listing";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const candidate = `${base}${suffix}`;
    const existing = await db
      .select({ id: organismListings.id })
      .from(organismListings)
      .where(eq(organismListings.slug, candidate))
      .limit(1);
    if (!existing[0]) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createOrganismListing(
  userId: string,
  input: z.infer<typeof CreateOrganismListingSchema>,
): Promise<OrganismListing> {
  const db = getDb();
  const slug = await generateUniqueOrganismSlug(db, input.title);
  const id = uid();

  const inserted = await db
    .insert(organismListings)
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
      organismSlug: input.organismSlug,
      organismGeneration: input.organismGeneration,
      organismName: input.organismName,
      organismKind: input.organismKind,
      pricePerForkQubic: BigInt(input.pricePerForkQubic),
      access: input.access,
      visibility: input.visibility,
      status: "draft",
    } satisfies NewOrganismListing)
    .returning();

  await logActivity(db, {
    action: "organism_listing.created",
    actorUserId: userId,
    orgId: input.orgId ?? null,
    targetType: "organism_listing",
    targetId: id,
    metadata: {
      slug,
      organism_slug: input.organismSlug,
      organism_kind: input.organismKind,
      price_per_fork_qubic: input.pricePerForkQubic,
      access: input.access,
    },
  });

  return inserted[0]!;
}

export async function updateOrganismListing(
  userId: string,
  listingId: string,
  input: z.infer<typeof UpdateOrganismListingSchema>,
): Promise<OrganismListing | null> {
  const db = getDb();
  const existing = (
    await db
      .select()
      .from(organismListings)
      .where(eq(organismListings.id, listingId))
      .limit(1)
  )[0];
  if (!existing) return null;
  if (existing.sellerUserId !== userId) {
    throw new Error("Only the seller can update this organism listing.");
  }
  if (existing.status === "closed") {
    throw new Error("Cannot update a closed organism listing.");
  }

  const updates: Partial<NewOrganismListing> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.pricePerForkQubic !== undefined) {
    updates.pricePerForkQubic = BigInt(input.pricePerForkQubic);
  }
  if (input.access !== undefined) updates.access = input.access;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.status !== undefined) {
    if (
      input.status === "active" &&
      existing.status === "draft" &&
      !existing.publishedAt
    ) {
      updates.publishedAt = new Date();
    }
    updates.status = input.status;
  }

  const updated = await db
    .update(organismListings)
    .set(updates)
    .where(eq(organismListings.id, listingId))
    .returning();

  await logActivity(db, {
    action: "organism_listing.updated",
    actorUserId: userId,
    targetType: "organism_listing",
    targetId: listingId,
    metadata: { fields: Object.keys(input) },
  });
  return updated[0] ?? null;
}

export async function closeOrganismListing(
  userId: string,
  listingId: string,
): Promise<OrganismListing | null> {
  const db = getDb();
  const existing = (
    await db
      .select()
      .from(organismListings)
      .where(eq(organismListings.id, listingId))
      .limit(1)
  )[0];
  if (!existing) return null;
  if (existing.sellerUserId !== userId) {
    throw new Error("Only the seller can close this organism listing.");
  }
  const updated = await db
    .update(organismListings)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(organismListings.id, listingId))
    .returning();
  await logActivity(db, {
    action: "organism_listing.closed",
    actorUserId: userId,
    targetType: "organism_listing",
    targetId: listingId,
  });
  return updated[0] ?? null;
}

export async function getOrganismListingById(
  id: string,
): Promise<OrganismListing | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(organismListings)
    .where(eq(organismListings.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrganismListingBySlug(
  slug: string,
): Promise<OrganismListing | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(organismListings)
    .where(eq(organismListings.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrganismListing(
  idOrSlug: string,
): Promise<OrganismListing | null> {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlug,
    )
  ) {
    return getOrganismListingById(idOrSlug);
  }
  return getOrganismListingBySlug(idOrSlug);
}

/**
 * Roll-up analytics for a single listing. Returns:
 *   - the listing's own denormalized counters
 *   - per-fork revenue
 *   - lineage breadth (number of children; 0 if not tracked here)
 *   - fitness max (null; the marketplace does not own the
 *     organism_fitness_history table — that's in services/ann)
 *
 *   The shape is the Phase 26.C contract from the v0.2 PEP
 *   §33 Task 5 (`total_forks`, `lineage_size`, `fitness_max`).
 */
export interface OrganismListingAnalytics {
  listingId: string;
  totalForks: bigint;
  totalRevenueQubic: bigint;
  lineageSize: number;
  fitnessMax: number | null;
}

export async function getOrganismListingAnalytics(
  listingId: string,
): Promise<OrganismListingAnalytics | null> {
  const listing = await getOrganismListingById(listingId);
  if (!listing) return null;
  return {
    listingId,
    totalForks: listing.totalForks,
    totalRevenueQubic: listing.totalRevenueQubic,
    // Lineage breadth is unknown to the marketplace (lives in
    // services/ann). We report 0 as the conservative answer; the
    // UI can fetch the real number from /v1/organisms/:slug/lineage.
    lineageSize: 0,
    // Fitness max is unknown to the marketplace. The ann service
    // owns organism_fitness_history; we report null and let the
    // caller hydrate from there.
    fitnessMax: null,
  };
}

/**
 * Increment an organism listing's fork counter. Called by the
 * marketplace's own /forks internal hook when a buyer creates a
 * child organism from a listing. The companion billing event is
 * fired by the calling layer (see routes/organismListings.ts).
 */
export async function recordOrganismFork(
  listingId: string,
  revenueQubic: bigint,
): Promise<void> {
  const db = getDb();
  await db
    .update(organismListings)
    .set({
      totalForks: sql`${organismListings.totalForks} + 1`,
      totalRevenueQubic: sql`${organismListings.totalRevenueQubic} + ${revenueQubic}`,
      updatedAt: new Date(),
    })
    .where(eq(organismListings.id, listingId));
}

export async function listOrganismListings(
  query: z.infer<typeof ListOrganismListingsQuerySchema>,
): Promise<ListOrganismListingsResult> {
  const db = getDb();
  const filters: ReturnType<typeof eq>[] = [];

  filters.push(eq(organismListings.status, query.status));
  if (query.visibility) {
    filters.push(eq(organismListings.visibility, query.visibility));
  } else {
    filters.push(eq(organismListings.visibility, "public"));
  }
  if (query.seller) {
    filters.push(eq(organismListings.sellerUserId, query.seller));
  }
  if (query.organismSlug) {
    filters.push(eq(organismListings.organismSlug, query.organismSlug));
  }
  if (query.organismKind) {
    filters.push(eq(organismListings.organismKind, query.organismKind));
  }
  if (query.access) {
    filters.push(eq(organismListings.access, query.access));
  }
  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    const orCond = or(
      ilike(organismListings.title, needle),
      ilike(organismListings.description, needle),
      ilike(organismListings.organismName, needle),
    );
    if (orCond) filters.push(orCond);
  }

  const where = filters.length === 1 ? filters[0] : and(...filters);

  let orderBy;
  switch (query.sort) {
    case "oldest":
      orderBy = asc(organismListings.publishedAt);
      break;
    case "price_asc":
      orderBy = asc(organismListings.pricePerForkQubic);
      break;
    case "price_desc":
      orderBy = desc(organismListings.pricePerForkQubic);
      break;
    case "rating":
      orderBy = desc(organismListings.ratingAverage);
      break;
    case "forks_desc":
      orderBy = desc(organismListings.totalForks);
      break;
    case "newest":
    default:
      orderBy = desc(organismListings.publishedAt);
  }

  const data = await db
    .select()
    .from(organismListings)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  const total = (
    await db
      .select({ id: organismListings.id })
      .from(organismListings)
      .where(where)
  ).length;

  return { data, total, limit: query.limit, offset: query.offset };
}
