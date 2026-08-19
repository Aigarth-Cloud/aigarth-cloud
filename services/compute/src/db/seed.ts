/**
 * Seed the compute service with default regions + clusters.
 *
 *   1 region: "global" (all 676 computors)
 *   3 clusters:
 *     - general-pool      (every 4th computor: 0, 4, 8, ...)
 *     - training-pool     (first 100 computors)
 *     - inference-pool    (last 100 computors)
 *
 * Idempotent: re-running won't create duplicates.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { regions, clusters, clusterMembers } from "./schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

async function main() {
  const db = getDb();
  console.log("[compute] seeding default regions + clusters");

  // Region: global
  let global = (await db.select().from(regions).where(eq(regions.slug, "global")))[0];
  if (!global) {
    const id = uid();
    const inserted = await db
      .insert(regions)
      .values({
        id,
        name: "Global",
        slug: "global",
        description: "All 676 Qubic computors, region-agnostic.",
        computorCount: 676,
      })
      .returning();
    global = inserted[0]!;
    await logActivity(db, {
      action: "region.created",
      actorUserId: null,
      targetType: "region",
      targetId: id,
      metadata: { name: "Global", slug: "global" },
    });
    console.log("  region: Global (676 computors)");
  } else {
    console.log("  region: Global (already exists)");
  }

  // Region: eu-west (first 226 computors = 676/3)
  let eu = (await db.select().from(regions).where(eq(regions.slug, "eu-west")))[0];
  if (!eu) {
    const id = uid();
    const inserted = await db
      .insert(regions)
      .values({
        id,
        name: "EU West",
        slug: "eu-west",
        description: "European operator pool (illustrative; computors 0..225).",
        computorCount: 226,
      })
      .returning();
    eu = inserted[0]!;
    console.log("  region: EU West (226 computors)");
  } else {
    console.log("  region: EU West (already exists)");
  }

  // Cluster: general-pool (every 4th computor under global)
  const generalSpec = { regionId: global.id, name: "General Pool", slug: "general-pool", purpose: "general" as const, indices: Array.from({ length: 169 }, (_, i) => i * 4) };
  await ensureCluster(db, generalSpec);

  // Cluster: training-pool (first 100 under eu-west)
  const trainingSpec = { regionId: eu.id, name: "Training Pool", slug: "training-pool", purpose: "training" as const, indices: Array.from({ length: 100 }, (_, i) => i) };
  await ensureCluster(db, trainingSpec);

  // Cluster: inference-pool (last 100 under eu-west)
  const inferenceSpec = { regionId: eu.id, name: "Inference Pool", slug: "inference-pool", purpose: "inference" as const, indices: Array.from({ length: 100 }, (_, i) => 126 + i) };
  await ensureCluster(db, inferenceSpec);

  // Refresh region computor counts
  await db
    .update(regions)
    .set({ computorCount: sql`(select count(*)::int from compute_cluster_members cm join compute_clusters c on c.id = cm.cluster_id where c.region_id = compute_regions.id)` })
    .where(sql`true`);

  await closeDb();
  console.log("[compute] seed complete");
}

async function ensureCluster(
  db: ReturnType<typeof getDb>,
  spec: {
    regionId: string;
    name: string;
    slug: string;
    purpose: "general" | "training" | "inference";
    indices: number[];
  },
) {
  let cluster = (
    await db
      .select()
      .from(clusters)
      .where(and(eq(clusters.regionId, spec.regionId), eq(clusters.slug, spec.slug)))
  )[0];
  if (!cluster) {
    const id = uid();
    const inserted = await db
      .insert(clusters)
      .values({
        id,
        regionId: spec.regionId,
        name: spec.name,
        slug: spec.slug,
        purpose: spec.purpose,
        minComputors: 3,
      })
      .returning();
    cluster = inserted[0]!;
    await logActivity(db, {
      action: "cluster.created",
      actorUserId: null,
      targetType: "cluster",
      targetId: id,
      metadata: { name: spec.name, slug: spec.slug, purpose: spec.purpose },
    });
    console.log(`  cluster: ${spec.name} (${spec.indices.length} computors)`);
  } else {
    console.log(`  cluster: ${spec.name} (already exists)`);
  }
  // Add members
  let added = 0;
  for (const idx of spec.indices) {
    const existing = await db
      .select()
      .from(clusterMembers)
      .where(and(eq(clusterMembers.clusterId, cluster.id), eq(clusterMembers.computorIndex, idx)))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(clusterMembers).values({
      id: uid(),
      clusterId: cluster.id,
      computorIndex: idx,
    });
    added++;
  }
  if (added > 0) {
    console.log(`    + ${added} computors added`);
  }
}

main().catch((err) => {
  console.error("[compute] seed failed:", err);
  process.exit(1);
});
