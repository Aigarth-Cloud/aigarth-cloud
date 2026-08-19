/**
 * Organism usage — Wave 3 / Phase B (Task 5).
 *
 *   Phase 26.C — per-Organism billable event log. Mirrors the
 *   tissueUsage pattern: append-only `organism_usage_events` table
 *   that the marketplace POSTs to on every successful fork of a
 *   marketplace listing. The billing service aggregates these per
 *   period and rolls the total into the invoice preview.
 *
 *   Storage model: append-only `billing_organism_usage_events` table.
 *   We do NOT mutate the user's credit balance on each call —
 *   billing is still period-based (monthly invoice). The event
 *   log is the authoritative source for invoice math.
 *
 *   v1: only count + total_qubic. Per-organism breakdown is
 *   denormalized from the event log at query time.
 */

import { eq, and, gte, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { organismUsageEvents } from "../db/schema.js";

export const OrganismUsageEventSchema = z.object({
  userId: z.string().uuid(),
  orgId: z.string().uuid().optional(),
  organismSlug: z.string().min(1).max(120),
  organismListingId: z.string().uuid().optional(),
  childOrganismSlug: z.string().min(1).max(120).optional(),
  parentGeneration: z.number().int().min(0).default(0),
  costQubic: z.string().regex(/^\d+$/),
  requestId: z.string().min(1).max(120),
  occurredAt: z.coerce.date().optional(),
});
export type OrganismUsageEvent = z.infer<typeof OrganismUsageEventSchema>;

export interface OrganismUsageSummary {
  totalForks: number;
  totalCostQubic: bigint;
  byOrganism: Array<{ organismSlug: string; forks: number; costQubic: bigint }>;
  source: "live" | "unavailable";
}

export async function recordOrganismUsage(event: OrganismUsageEvent): Promise<void> {
  const db = getDb();
  await db.insert(organismUsageEvents).values({
    id: crypto.randomUUID(),
    userId: event.userId,
    orgId: event.orgId ?? null,
    organismSlug: event.organismSlug,
    organismListingId: event.organismListingId ?? null,
    childOrganismSlug: event.childOrganismSlug ?? null,
    parentGeneration: event.parentGeneration,
    costQubic: BigInt(event.costQubic),
    requestId: event.requestId,
    occurredAt: event.occurredAt ?? new Date(),
  });
}

export async function getOrganismUsage(
  userId: string,
  since?: Date,
): Promise<OrganismUsageSummary> {
  const db = getDb();
  try {
    const whereExpr = since
      ? and(
          eq(organismUsageEvents.userId, userId),
          gte(organismUsageEvents.occurredAt, since),
        )
      : eq(organismUsageEvents.userId, userId);

    const totals = await db
      .select({
        count: sql<number>`count(*)::int`,
        cost: sql<string>`coalesce(sum(${organismUsageEvents.costQubic}), 0)::text`,
      })
      .from(organismUsageEvents)
      .where(whereExpr);

    const byOrganismRows = await db
      .select({
        organismSlug: organismUsageEvents.organismSlug,
        forks: sql<number>`count(*)::int`,
        cost: sql<string>`coalesce(sum(${organismUsageEvents.costQubic}), 0)::text`,
      })
      .from(organismUsageEvents)
      .where(whereExpr)
      .groupBy(organismUsageEvents.organismSlug)
      .orderBy(desc(sql`count(*)`));

    const totalRow = totals[0] ?? { count: 0, cost: "0" };
    return {
      totalForks: totalRow.count,
      totalCostQubic: BigInt(totalRow.cost),
      byOrganism: byOrganismRows.map((r) => ({
        organismSlug: r.organismSlug,
        forks: r.forks,
        costQubic: BigInt(r.cost),
      })),
      source: "live",
    };
  } catch {
    return {
      totalForks: 0,
      totalCostQubic: 0n,
      byOrganism: [],
      source: "unavailable",
    };
  }
}
