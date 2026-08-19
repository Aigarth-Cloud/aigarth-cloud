/**
 * Analytics for an ANN.
 *
 * Returns an aggregate view of an ANN's:
 *   - Denormalized counters (calls, revenue, downloads, rating)
 *   - Deployment history (active, stopped, total uptime)
 *   - Rating distribution (1-5 stars)
 *   - Benchmark rollup (avg score per benchmark name)
 *
 * Note: this is in-service analytics. Cross-service usage aggregation
 * (gateway + compute per-ANN) would require those services to record
 * ann_id on their request/job tables, which they don't yet. Tracked in TODO.
 */

import { eq, and, desc, sql, count } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  anns,
  annDeployments,
  annRatings,
  annBenchmarks,
} from "../db/schema.js";

export interface AnnAnalytics {
  annId: string;
  /** Denormalized counters (from the anns row). */
  totalCalls: string;
  monthlyCalls: string;
  totalRevenueQubic: string;
  downloads: string;
  ratingAverage: string | null;
  ratingCount: number;
  /** Deployment stats. */
  deployments: {
    total: number;
    running: number;
    stopped: number;
    failed: number;
    pending: number;
    deploying: number;
  };
  /** Rating distribution: 1-5 star counts. */
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  /** Benchmark rollup: average score per benchmark name. */
  benchmarks: Array<{
    name: string;
    avgScore: string;
    count: number;
    lastVerified: string;
  }>;
}

export async function getAnnAnalytics(annId: string): Promise<AnnAnalytics | null> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) return null;

  // Deployment stats
  const depRows = await db
    .select({ status: annDeployments.status, n: count() })
    .from(annDeployments)
    .where(eq(annDeployments.annId, annId))
    .groupBy(annDeployments.status);
  const deployments = {
    total: 0,
    running: 0,
    stopped: 0,
    failed: 0,
    pending: 0,
    deploying: 0,
  };
  for (const r of depRows) {
    deployments.total += r.n;
    if (r.status === "running") deployments.running = r.n;
    else if (r.status === "stopped") deployments.stopped = r.n;
    else if (r.status === "failed") deployments.failed = r.n;
    else if (r.status === "pending") deployments.pending = r.n;
    else if (r.status === "deploying") deployments.deploying = r.n;
  }

  // Rating distribution
  const ratingRows = await db
    .select({ rating: annRatings.rating, n: count() })
    .from(annRatings)
    .where(eq(annRatings.annId, annId))
    .groupBy(annRatings.rating);
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratingRows) {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingDistribution[r.rating as 1 | 2 | 3 | 4 | 5] = r.n;
    }
  }

  // Benchmark rollup
  const benchRows = await db
    .select({
      name: annBenchmarks.benchmarkName,
      avgScore: sql<string>`AVG(${annBenchmarks.score})::numeric(5,2)::text`,
      count: count(),
      lastVerified: sql<string>`MAX(${annBenchmarks.verifiedAt})::text`,
    })
    .from(annBenchmarks)
    .where(eq(annBenchmarks.annId, annId))
    .groupBy(annBenchmarks.benchmarkName);

  return {
    annId,
    totalCalls: ann.totalCalls.toString(),
    monthlyCalls: ann.monthlyCalls.toString(),
    totalRevenueQubic: ann.totalRevenueQubic.toString(),
    downloads: ann.downloads.toString(),
    ratingAverage: ann.ratingAverage,
    ratingCount: ann.ratingCount,
    deployments,
    ratingDistribution,
    benchmarks: benchRows.map((b) => ({
      name: b.name,
      avgScore: b.avgScore,
      count: b.count,
      lastVerified: b.lastVerified,
    })),
  };
}
