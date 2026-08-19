/**
 * Cluster service.
 *
 * A cluster is a named pool of computors within a region, dedicated
 * to a specific purpose (training, inference, general). Clusters are
 * how users target compute — when submitting a job, the user picks
 * a cluster (or accepts the routing engine's choice).
 */

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  clusters,
  clusterMembers,
  regions,
  type Cluster,
  type ClusterMember,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export const CreateClusterSchema = z.object({
  regionId: z.string().uuid(),
  name: z.string().min(2).max(60),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase a-z, 0-9, and hyphens"),
  purpose: z.enum(["training", "inference", "general"]).default("general"),
  minComputors: z.number().int().min(1).max(676).default(3),
});

export type CreateClusterInput = z.infer<typeof CreateClusterSchema>;

export const AddMemberSchema = z.object({
  computorIndex: z.number().int().min(0).max(675),
});

export async function createCluster(
  input: CreateClusterInput,
  actorUserId: string,
): Promise<Cluster> {
  const db = getDb();
  // Verify region exists
  const regionRows = await db.select().from(regions).where(eq(regions.id, input.regionId)).limit(1);
  if (!regionRows[0]) throw new Error("Region not found.");
  const id = uid();
  const inserted = await db
    .insert(clusters)
    .values({
      id,
      regionId: input.regionId,
      name: input.name,
      slug: input.slug,
      purpose: input.purpose,
      minComputors: input.minComputors,
    })
    .returning();
  logActivity(db, {
    action: "cluster.created",
    actorUserId,
    targetType: "cluster",
    targetId: id,
    metadata: { regionId: input.regionId, name: input.name, purpose: input.purpose },
  });
  return inserted[0]!;
}

export async function listClusters(options: { regionId?: string } = {}): Promise<Cluster[]> {
  const db = getDb();
  if (options.regionId) {
    return db.select().from(clusters).where(eq(clusters.regionId, options.regionId));
  }
  return db.select().from(clusters);
}

export async function getCluster(id: string): Promise<Cluster | null> {
  const db = getDb();
  const rows = await db.select().from(clusters).where(eq(clusters.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listClusterMembers(clusterId: string): Promise<ClusterMember[]> {
  const db = getDb();
  return db.select().from(clusterMembers).where(eq(clusterMembers.clusterId, clusterId));
}

export async function addClusterMember(
  clusterId: string,
  computorIndex: number,
  actorUserId: string,
): Promise<ClusterMember> {
  const db = getDb();
  const cluster = await getCluster(clusterId);
  if (!cluster) throw new Error("Cluster not found.");
  // Idempotent: if a member with the same (cluster, computor) exists, return it.
  const existing = await db
    .select()
    .from(clusterMembers)
    .where(
      and(eq(clusterMembers.clusterId, clusterId), eq(clusterMembers.computorIndex, computorIndex)),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const id = uid();
  const inserted = await db
    .insert(clusterMembers)
    .values({ id, clusterId, computorIndex })
    .returning();
  // Update the region's computor count
  await db
    .update(regions)
    .set({ computorCount: cluster.regionId ? undefined : 0, updatedAt: new Date() })
    .where(eq(regions.id, cluster.regionId));
  logActivity(db, {
    action: "cluster.member_added",
    actorUserId,
    targetType: "cluster",
    targetId: clusterId,
    metadata: { computorIndex },
  });
  return inserted[0]!;
}

export async function removeClusterMember(
  clusterId: string,
  computorIndex: number,
  actorUserId: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(clusterMembers)
    .where(
      and(eq(clusterMembers.clusterId, clusterId), eq(clusterMembers.computorIndex, computorIndex)),
    );
  logActivity(db, {
    action: "cluster.member_removed",
    actorUserId,
    targetType: "cluster",
    targetId: clusterId,
    metadata: { computorIndex },
  });
}
