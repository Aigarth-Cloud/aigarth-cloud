/**
 * ANN benchmarks — verified accuracy / latency / cost numbers.
 *
 *   - Anyone (typically the creator) can add a benchmark for an ANN.
 *   - Each benchmark is tied to a (benchmark_name, version?) pair.
 *   - The most recent benchmark for a (name, version) wins on dedupe.
 */

import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { anns, annBenchmarks, type AnnBenchmark, type NewAnnBenchmark } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { AnnBenchmark };

export const AddBenchmarkSchema = z.object({
  versionId: z.string().uuid().optional(),
  benchmarkName: z.string().min(1).max(120),
  score: z.number().min(0).max(100),
  datasetHash: z.string().max(200).optional(),
  runner: z.string().max(60).default("internal"),
  metadata: z.record(z.unknown()).default({}),
});

export async function addBenchmark(
  userId: string,
  annId: string,
  input: z.infer<typeof AddBenchmarkSchema>,
): Promise<AnnBenchmark> {
  const db = getDb();
  const ann = (await db.select({ id: anns.id }).from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) throw new Error("ANN not found.");

  const id = uid();
  const inserted = await db
    .insert(annBenchmarks)
    .values({
      id,
      annId,
      versionId: input.versionId ?? null,
      benchmarkName: input.benchmarkName,
      score: String(input.score),
      datasetHash: input.datasetHash ?? null,
      runner: input.runner,
      metadata: input.metadata,
    } satisfies NewAnnBenchmark)
    .returning();

  await logActivity(db, {
    action: "ann.benchmark_added",
    actorUserId: userId,
    targetType: "ann",
    targetId: annId,
    metadata: { benchmarkName: input.benchmarkName, score: input.score },
  });

  return inserted[0]!;
}

export async function listBenchmarks(annId: string, limit = 50): Promise<AnnBenchmark[]> {
  const db = getDb();
  return db
    .select()
    .from(annBenchmarks)
    .where(eq(annBenchmarks.annId, annId))
    .orderBy(desc(annBenchmarks.verifiedAt))
    .limit(limit);
}
