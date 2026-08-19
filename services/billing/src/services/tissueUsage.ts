/**
 * Tissue usage — Phase 18E.
 *
 *   Tissue decisions are a per-call metered product, separate from
 *   token-billed gateway usage. The tissue service POSTs a
 *   `TissueUsageEvent` here on every /decide (caller-pays model);
 *   the billing service aggregates these into a per-period total
 *   shown in /v1/billing/usage and rolled into invoice preview.
 *
 *   Storage model: append-only `tissue_usage_events` table. We do
 *   NOT mutate the user's credit balance on each call — billing is
 *   still period-based (monthly invoice). The event log is the
 *   authoritative source for invoice math.
 *
 *   v1: only count + total_qubic. Per-tissue breakdown is denormalized
 *       from the event log at query time.
 */

import { eq, and, gte, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { tissueUsageEvents } from "../db/schema.js";

export const TissueUsageEventSchema = z.object({
  userId: z.string().uuid(),
  orgId: z.string().uuid().optional(),
  tissueSlug: z.string().min(1).max(120),
  tissueVersion: z.string().min(1).max(40),
  tissueListingId: z.string().uuid().optional(),
  state: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  costQubic: z.string().regex(/^\d+$/),
  requestId: z.string().min(1).max(120),
  occurredAt: z.coerce.date().optional(),
});
export type TissueUsageEvent = z.infer<typeof TissueUsageEventSchema>;

export interface TissueUsageSummary {
  totalDecisions: number;
  totalCostQubic: bigint;
  byTissue: Array<{ tissueSlug: string; decisions: number; costQubic: bigint }>;
  byState: { minusOne: number; zero: number; plusOne: number };
  source: "live" | "unavailable";
}

export async function recordTissueUsage(event: TissueUsageEvent): Promise<void> {
  const db = getDb();
  await db.insert(tissueUsageEvents).values({
    id: crypto.randomUUID(),
    userId: event.userId,
    orgId: event.orgId ?? null,
    tissueSlug: event.tissueSlug,
    tissueVersion: event.tissueVersion,
    tissueListingId: event.tissueListingId ?? null,
    state: event.state,
    costQubic: BigInt(event.costQubic),
    requestId: event.requestId,
    occurredAt: event.occurredAt ?? new Date(),
  });
}

export async function getTissueUsage(
  userId: string,
  since?: Date,
): Promise<TissueUsageSummary> {
  const db = getDb();
  try {
    const whereExpr = since
      ? and(eq(tissueUsageEvents.userId, userId), gte(tissueUsageEvents.occurredAt, since))
      : eq(tissueUsageEvents.userId, userId);

    const totals = await db
      .select({
        count: sql<number>`count(*)::int`,
        cost: sql<string>`coalesce(sum(${tissueUsageEvents.costQubic}), 0)::text`,
      })
      .from(tissueUsageEvents)
      .where(whereExpr);

    const byTissueRows = await db
      .select({
        tissueSlug: tissueUsageEvents.tissueSlug,
        decisions: sql<number>`count(*)::int`,
        cost: sql<string>`coalesce(sum(${tissueUsageEvents.costQubic}), 0)::text`,
      })
      .from(tissueUsageEvents)
      .where(whereExpr)
      .groupBy(tissueUsageEvents.tissueSlug)
      .orderBy(desc(sql`count(*)`));

    const byStateRows = await db
      .select({
        state: tissueUsageEvents.state,
        n: sql<number>`count(*)::int`,
      })
      .from(tissueUsageEvents)
      .where(whereExpr)
      .groupBy(tissueUsageEvents.state);

    const byState = { minusOne: 0, zero: 0, plusOne: 0 };
    for (const r of byStateRows) {
      if (r.state === -1) byState.minusOne = r.n;
      else if (r.state === 0) byState.zero = r.n;
      else if (r.state === 1) byState.plusOne = r.n;
    }

    const totalRow = totals[0] ?? { count: 0, cost: "0" };
    return {
      totalDecisions: totalRow.count,
      totalCostQubic: BigInt(totalRow.cost),
      byTissue: byTissueRows.map((r) => ({
        tissueSlug: r.tissueSlug,
        decisions: r.decisions,
        costQubic: BigInt(r.cost),
      })),
      byState,
      source: "live",
    };
  } catch {
    return {
      totalDecisions: 0,
      totalCostQubic: 0n,
      byTissue: [],
      byState: { minusOne: 0, zero: 0, plusOne: 0 },
      source: "unavailable",
    };
  }
}
