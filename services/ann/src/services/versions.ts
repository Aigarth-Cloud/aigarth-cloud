/**
 * ANN versions — immutable history.
 *
 *   - First version is added by the creator. Must exist before publish.
 *   - Subsequent versions are added (e.g. after retraining). The new version
 *     is marked `isLatest=true` and the previous latest is flipped to false.
 *   - `ann.currentVersionId` is updated to point at the latest.
 *   - Versions are immutable: no update endpoint, no delete (cascade with ann).
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { anns, annVersions, type AnnVersion, type NewAnnVersion } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { AnnVersion };

export const CreateVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i, "version must be semver (e.g. 1.0.0)"),
  changelog: z.string().max(20_000).optional(),
  artifactUrl: z.string().url().optional(),
  artifactSizeBytes: z.string().regex(/^\d+$/).optional(),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  trainingComputeJobId: z.string().uuid().optional(),
  trainingDatasetHash: z.string().max(200).optional(),
  hyperparameters: z.record(z.unknown()).default({}),
  metrics: z.record(z.unknown()).default({}),
  signature: z.string().min(1).max(4096).optional(),
  /** Optional: if true, the new version becomes the latest AND `ann.currentVersionId` is updated. */
  setAsLatest: z.boolean().default(true),
});

export async function addVersion(
  userId: string,
  annId: string,
  input: z.infer<typeof CreateVersionSchema>,
): Promise<AnnVersion> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) throw new Error("ANN not found.");
  if (ann.creatorUserId !== userId) {
    throw new Error("Only the creator can add a version.");
  }
  if (ann.status === "suspended" || ann.status === "deprecated") {
    throw new Error(`Cannot add a version to a ${ann.status} ANN.`);
  }

  // Version must be unique per ANN (DB enforces via uniqueIndex)
  const existing = (await db.select({ id: annVersions.id }).from(annVersions).where(and(eq(annVersions.annId, annId), eq(annVersions.version, input.version))).limit(1))[0];
  if (existing) {
    throw new Error(`Version '${input.version}' already exists for this ANN.`);
  }

  // If this is the new latest, flip the previous one to isLatest=false
  if (input.setAsLatest) {
    await db
      .update(annVersions)
      .set({ isLatest: false })
      .where(and(eq(annVersions.annId, annId), eq(annVersions.isLatest, true)));
  }

  const id = uid();
  const inserted = await db
    .insert(annVersions)
    .values({
      id,
      annId,
      version: input.version,
      changelog: input.changelog ?? null,
      artifactUrl: input.artifactUrl ?? null,
      artifactSizeBytes: input.artifactSizeBytes ? BigInt(input.artifactSizeBytes) : null,
      artifactHash: input.artifactHash ?? null,
      trainingComputeJobId: input.trainingComputeJobId ?? null,
      trainingDatasetHash: input.trainingDatasetHash ?? null,
      hyperparameters: input.hyperparameters,
      metrics: input.metrics,
      signature: input.signature ?? null,
      isLatest: input.setAsLatest,
    } satisfies NewAnnVersion)
    .returning();

  // Update the ANN's currentVersionId + the denormalized accuracy from the new version's metrics
  if (input.setAsLatest) {
    const metrics = input.metrics as Record<string, unknown>;
    const updates: Partial<typeof anns.$inferInsert> = {
      currentVersionId: id,
      updatedAt: new Date(),
    };
    if (typeof metrics.accuracy === "number") {
      updates.accuracy = String(metrics.accuracy);
    } else if (typeof metrics.accuracy === "string") {
      updates.accuracy = metrics.accuracy;
    }
    if (typeof metrics.latency_p50_ms === "number") {
      updates.latencyP50Ms = metrics.latency_p50_ms;
    }
    if (typeof metrics.latency_p99_ms === "number") {
      updates.latencyP99Ms = metrics.latency_p99_ms;
    }
    await db.update(anns).set(updates).where(eq(anns.id, annId));
  }

  await logActivity(db, {
    action: "ann.version_added",
    actorUserId: userId,
    targetType: "ann_version",
    targetId: id,
    metadata: { annId, version: input.version, isLatest: input.setAsLatest },
  });

  return inserted[0]!;
}

export async function getVersion(id: string): Promise<AnnVersion | null> {
  const db = getDb();
  const rows = await db.select().from(annVersions).where(eq(annVersions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listVersions(annId: string): Promise<AnnVersion[]> {
  const db = getDb();
  return db
    .select()
    .from(annVersions)
    .where(eq(annVersions.annId, annId))
    .orderBy(desc(annVersions.createdAt));
}

export async function getLatestVersion(annId: string): Promise<AnnVersion | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(annVersions)
    .where(and(eq(annVersions.annId, annId), eq(annVersions.isLatest, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getVersionCount(annId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(annVersions)
    .where(eq(annVersions.annId, annId));
  return rows[0]?.n ?? 0;
}
