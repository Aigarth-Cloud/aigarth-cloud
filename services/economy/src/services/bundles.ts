/**
 * Bundles service — CRUD over `economy_bundle_listings`.
 *
 * A bundle is a marketplace listing that contains N ANNs. The
 * "intelligence index" / "ETF" use case lives here, reframed as a
 * curated marketplace construct (not a tradable share, per ADR 001).
 */

import { eq, desc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  bundleListings,
  type BundleListing,
  type NewBundleListing,
} from "../db/schema.js";

export async function listBundles(): Promise<BundleListing[]> {
  const db = getDb();
  return db.select().from(bundleListings).orderBy(desc(bundleListings.createdAt));
}

export async function getBundle(id: string): Promise<BundleListing | null> {
  const db = getDb();
  const rows = await db.select().from(bundleListings).where(eq(bundleListings.id, id));
  return rows[0] ?? null;
}

export async function getBundleByListing(listingId: string): Promise<BundleListing | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(bundleListings)
    .where(eq(bundleListings.listingId, listingId));
  return rows[0] ?? null;
}

export interface CreateBundleInput {
  listingId: string;
  kind?: "collection" | "starter_pack" | "curated";
  annIds: string[];
  bundlePriceQubic: bigint;
  discountBps?: number;
  notes?: string | null;
}

export async function createBundle(input: CreateBundleInput): Promise<BundleListing> {
  if (input.annIds.length === 0) {
    throw new Error("bundle must contain at least one ANN");
  }
  if (input.bundlePriceQubic < 0n) {
    throw new Error(`bundlePriceQubic must be >= 0, got ${input.bundlePriceQubic}`);
  }
  const discountBps = input.discountBps ?? 0;
  if (discountBps < 0 || discountBps > 10_000) {
    throw new Error(`discountBps must be 0–10000, got ${discountBps}`);
  }
  const db = getDb();
  const existing = await getBundleByListing(input.listingId);
  if (existing) throw new Error(`bundle already exists for listing ${input.listingId}`);
  const inserted = await db.insert(bundleListings).values({
    listingId: input.listingId,
    kind: input.kind ?? "collection",
    annIds: input.annIds,
    bundlePriceQubic: input.bundlePriceQubic,
    discountBps,
    notes: input.notes ?? null,
  }).returning();
  return inserted[0]!;
}

export async function updateBundle(
  id: string,
  patch: Partial<Omit<NewBundleListing, "id" | "createdAt">>,
): Promise<BundleListing | null> {
  const db = getDb();
  const rows = await db
    .update(bundleListings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(bundleListings.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteBundle(id: string): Promise<void> {
  const db = getDb();
  await db.delete(bundleListings).where(eq(bundleListings.id, id));
}
