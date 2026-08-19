/**
 * Region service.
 *
 * A region is a grouping of Qubic computors for routing purposes.
 * In production, regions map to geographic locations or operator
 * pools. For now, regions are admin-defined and computors are
 * added via clusters.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { regions, clusters, clusterMembers, type Region } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export const CreateRegionSchema = z.object({
  name: z.string().min(2).max(60),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase a-z, 0-9, and hyphens"),
  description: z.string().max(500).optional(),
  computorCount: z.number().int().min(0).max(676).optional(),
});

export type CreateRegionInput = z.infer<typeof CreateRegionSchema>;

export async function createRegion(input: CreateRegionInput, actorUserId: string): Promise<Region> {
  const db = getDb();
  const id = uid();
  const inserted = await db
    .insert(regions)
    .values({
      id,
      name: input.name,
      slug: input.slug,
      description: input.description,
      computorCount: input.computorCount ?? 0,
    })
    .returning();
  logActivity(db, {
    action: "region.created",
    actorUserId,
    targetType: "region",
    targetId: id,
    metadata: { name: input.name, slug: input.slug },
  });
  return inserted[0]!;
}

export async function listRegions(): Promise<Region[]> {
  const db = getDb();
  return db.select().from(regions).orderBy(regions.name);
}

export async function getRegion(id: string): Promise<Region | null> {
  const db = getDb();
  const rows = await db.select().from(regions).where(eq(regions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getRegionBySlug(slug: string): Promise<Region | null> {
  const db = getDb();
  const rows = await db.select().from(regions).where(eq(regions.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getRegionStats(regionId: string): Promise<{
  region: Region;
  clusterCount: number;
  computorCount: number;
  activeJobCount: number;
}> {
  const db = getDb();
  const region = await getRegion(regionId);
  if (!region) throw new Error("Region not found.");
  const clusterRows = await db.select().from(clusters).where(eq(clusters.regionId, regionId));
  const memberRows = await db
    .select()
    .from(clusterMembers)
    .innerJoin(clusters, eq(clusterMembers.clusterId, clusters.id))
    .where(eq(clusters.regionId, regionId));
  return {
    region,
    clusterCount: clusterRows.length,
    computorCount: memberRows.length,
    activeJobCount: 0, // computed in route handler for live data
  };
}
