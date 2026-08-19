/**
 * Decision outcomes — Phase 19D.1.
 *
 * The "outcome" side of the decision feedback loop. The emit-side lives
 * in `trinary.ts` (writes to `ann_decisions`); this module records what
 * actually happened in the real world after a decision was emitted.
 *
 * One outcome per decision (enforced by the unique index on
 * `decision_id`). Outcomes are part of the audit log and follow the
 * same lifecycle as decisions: cascade-deleted with the parent ANN,
 * never soft-deleted by application code.
 *
 * This is the foundation for:
 *   - 19D.2: auto-retrain (uses `avgConfidenceInLabel` + `successRate`)
 *   - 19D.3: A/B tests (groups outcomes by ANN version)
 *   - 19D.4: Garden actual-vs-predicted (joins outcomes to en route confidence)
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  annDecisions,
  annDecisionOutcomes,
  annVersions,
  type AnnDecisionOutcomeRow,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { AnnDecisionOutcomeRow };

// ---------- Public schemas ----------

/**
 * Input for `POST /v1/anns/:idOrSlug/decisions/:decisionId/outcome`.
 * Callers report the real-world consequence of a decision. The
 * `confidence_in_label` is the reporter's self-rated confidence
 * (not the ANN's own `confidence` from the envelope).
 */
export const RecordOutcomeSchema = z.object({
  outcome: z.enum(["success", "failure", "reverted", "unknown"]),
  /** Reporter's confidence in their own label, 0-1. */
  confidenceInLabel: z.number().min(0).max(1).optional(),
  /** Free-form notes. Useful for A/B + retrain contexts. */
  notes: z.string().max(4_000).optional(),
  /** When the real-world outcome actually happened. Defaults to recordedAt. */
  outcomeAt: z.string().datetime({ offset: true }).optional(),
});
export type RecordOutcomeInput = z.infer<typeof RecordOutcomeSchema>;

/** Query for `GET /v1/anns/:idOrSlug/outcomes`. */
export const ListOutcomesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  /** Optional: only return outcomes of this type. */
  outcome: z.enum(["success", "failure", "reverted", "unknown"]).optional(),
});
export type ListOutcomesQuery = z.infer<typeof ListOutcomesQuerySchema>;

// ---------- Errors ----------

/** The decision_id does not exist (or was deleted). */
export class DecisionNotFoundError extends Error {
  constructor(decisionId: string) {
    super(`Decision '${decisionId}' not found.`);
    this.name = "DecisionNotFoundError";
  }
}

/** The decision exists but belongs to a different ANN than the one in the URL. */
export class AnnMismatchError extends Error {
  constructor(decisionId: string, expectedAnnId: string, actualAnnId: string) {
    super(
      `Decision '${decisionId}' does not belong to ANN '${expectedAnnId}' (actual: '${actualAnnId}').`,
    );
    this.name = "AnnMismatchError";
  }
}

/** The input was rejected (e.g. unknown outcome value, invalid ISO date). */
export class OutcomeInvalidError extends Error {
  constructor(reason: string) {
    super(`Invalid outcome: ${reason}`);
    this.name = "OutcomeInvalidError";
  }
}

// ---------- Mutations ----------

/**
 * Record an outcome for a decision. Idempotent: if an outcome already
 * exists for this decision_id, it is updated with the new fields.
 *
 * Returns `{ row, created }` so the route layer can pick the right
 * HTTP status (201 on first write, 200 on update).
 *
 * @throws DecisionNotFoundError if the decision doesn't exist
 * @throws AnnMismatchError if the decision belongs to a different ANN
 * @throws OutcomeInvalidError if the input fails schema validation
 */
export async function recordOutcome(
  annId: string,
  decisionId: string,
  input: RecordOutcomeInput,
  userId: string,
): Promise<{ row: AnnDecisionOutcomeRow; created: boolean }> {
  // Validate the decision exists and belongs to the right ANN.
  const db = getDb();
  const decision = (
    await db
      .select({ id: annDecisions.id, annId: annDecisions.annId, annVersion: annDecisions.annVersion })
      .from(annDecisions)
      .where(eq(annDecisions.id, decisionId))
      .limit(1)
  )[0];
  if (!decision) throw new DecisionNotFoundError(decisionId);
  if (decision.annId !== annId) {
    throw new AnnMismatchError(decisionId, annId, decision.annId);
  }

  // Resolve the ann_version_id from the version text on the decision.
  // We don't fail if the version row is gone — annVersionId is denormalized
  // and the FK uses `on delete: set null`.
  const versionRow = (
    await db
      .select({ id: annVersions.id })
      .from(annVersions)
      .where(and(eq(annVersions.annId, annId), eq(annVersions.version, decision.annVersion)))
      .limit(1)
  )[0];
  const annVersionId = versionRow?.id ?? null;

  const now = new Date();
  const outcomeAt = input.outcomeAt ? new Date(input.outcomeAt) : now;

  // Upsert: if an outcome already exists for this decision, update it.
  // Otherwise insert a new one.
  const existing = (
    await db
      .select()
      .from(annDecisionOutcomes)
      .where(eq(annDecisionOutcomes.decisionId, decisionId))
      .limit(1)
  )[0];

  let row: AnnDecisionOutcomeRow;
  let created: boolean;
  if (existing) {
    const updated = await db
      .update(annDecisionOutcomes)
      .set({
        outcome: input.outcome,
        confidenceInLabel:
          input.confidenceInLabel !== undefined ? String(input.confidenceInLabel) : null,
        notes: input.notes ?? null,
        // Don't change recordedBy / source / recordedAt on update.
        // outcomeAt can be corrected on update (e.g. backfilled later).
        outcomeAt,
      })
      .where(eq(annDecisionOutcomes.id, existing.id))
      .returning();
    row = updated[0]!;
    created = false;
  } else {
    const id = uid();
    const inserted = await db
      .insert(annDecisionOutcomes)
      .values({
        id,
        decisionId,
        annId,
        annVersionId,
        outcome: input.outcome,
        confidenceInLabel:
          input.confidenceInLabel !== undefined ? String(input.confidenceInLabel) : null,
        notes: input.notes ?? null,
        recordedBy: userId,
        source: "manual",
        outcomeAt,
        recordedAt: now,
      })
      .returning();
    row = inserted[0]!;
    created = true;
  }

  await logActivity(db, {
    action: "ann.decision_outcome_recorded",
    actorUserId: userId,
    targetType: "ann_decision_outcome",
    targetId: row.id,
    metadata: {
      annId,
      decisionId,
      outcome: row.outcome,
      source: row.source,
    },
  });

  return { row, created };
}

// ---------- Reads ----------

/** Get the outcome for a single decision, or null. */
export async function getOutcome(decisionId: string): Promise<AnnDecisionOutcomeRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(annDecisionOutcomes)
    .where(eq(annDecisionOutcomes.decisionId, decisionId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Paginated list of outcomes for an ANN, newest first.
 * Optional `outcome` filter narrows to one bucket (e.g. "failure").
 */
export async function listOutcomesForAnn(
  annId: string,
  query: ListOutcomesQuery,
): Promise<{ data: AnnDecisionOutcomeRow[]; total: number; limit: number; offset: number }> {
  const db = getDb();
  const filters = [eq(annDecisionOutcomes.annId, annId)];
  if (query.outcome) {
    filters.push(eq(annDecisionOutcomes.outcome, query.outcome));
  }
  const where = and(...filters);

  const rows = await db
    .select()
    .from(annDecisionOutcomes)
    .where(where)
    .orderBy(desc(annDecisionOutcomes.recordedAt))
    .limit(query.limit)
    .offset(query.offset);

  const totalRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(annDecisionOutcomes)
    .where(where);
  const total = Number(totalRow[0]?.count ?? 0);

  return { data: rows, total, limit: query.limit, offset: query.offset };
}

// ---------- Stats ----------

/** Shape returned by `computeOutcomeStats`. */
export interface OutcomeStats {
  annId: string;
  totalOutcomes: number;
  successCount: number;
  failureCount: number;
  revertedCount: number;
  unknownCount: number;
  /** success / (success + failure + reverted). null if no graded outcomes. */
  successRate: number | null;
  /** Same ratio, but only over the most recent 100 graded outcomes. */
  recentSuccessRate: number | null;
  /** Mean of `confidence_in_label` for rows that have one. null if none. */
  avgConfidenceInLabel: number | null;
  /** ISO timestamp of the most recent outcome for this ANN, or null. */
  lastRecordedAt: string | null;
}

const RECENT_GRADED_WINDOW = 100;

/**
 * Compute aggregate outcome statistics for an ANN. Used by:
 *   - the public `/v1/anns/:idOrSlug/stats` endpoint (for marketplace)
 *   - 19D.2 (auto-retrain signal)
 *   - 19D.4 (garden actual-vs-predicted)
 *
 * Loads every outcome row for the ANN. For an ANN with thousands of
 * outcomes this is O(N) per call — acceptable for v1 (queries are
 * rare + the table is indexed on `ann_id`). v2 should add a
 * materialised counter table refreshed by a trigger.
 */
export async function computeOutcomeStats(annId: string): Promise<OutcomeStats> {
  const db = getDb();

  // Single pass: load every outcome for the ANN, ordered newest first.
  // (Drizzle doesn't have GROUP BY + counts in the same call as the
  // data fetch in a way that makes this simpler; just do it in JS.)
  const rows = await db
    .select()
    .from(annDecisionOutcomes)
    .where(eq(annDecisionOutcomes.annId, annId))
    .orderBy(desc(annDecisionOutcomes.recordedAt));

  let successCount = 0;
  let failureCount = 0;
  let revertedCount = 0;
  let unknownCount = 0;
  let confidenceSum = 0;
  let confidenceN = 0;
  let lastRecordedAt: Date | null = null;

  // Walk the rows (newest-first) to find the recent-graded window.
  let recentSuccess = 0;
  let recentFailure = 0;
  let recentReverted = 0;
  let recentFilled = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.outcome === "success") successCount++;
    else if (r.outcome === "failure") failureCount++;
    else if (r.outcome === "reverted") revertedCount++;
    else if (r.outcome === "unknown") unknownCount++;

    if (r.confidenceInLabel !== null) {
      confidenceSum += Number(r.confidenceInLabel);
      confidenceN++;
    }

    if (lastRecordedAt === null || r.recordedAt > lastRecordedAt) {
      lastRecordedAt = r.recordedAt;
    }

    // Recent window: only count the first RECENT_GRADED_WINDOW graded rows.
    if (recentFilled < RECENT_GRADED_WINDOW && r.outcome !== "unknown") {
      if (r.outcome === "success") recentSuccess++;
      else if (r.outcome === "failure") recentFailure++;
      else if (r.outcome === "reverted") recentReverted++;
      recentFilled++;
    }
  }

  const gradedTotal = successCount + failureCount + revertedCount;
  const recentGradedTotal = recentSuccess + recentFailure + recentReverted;

  return {
    annId,
    totalOutcomes: rows.length,
    successCount,
    failureCount,
    revertedCount,
    unknownCount,
    successRate: gradedTotal > 0 ? successCount / gradedTotal : null,
    recentSuccessRate: recentGradedTotal > 0 ? recentSuccess / recentGradedTotal : null,
    avgConfidenceInLabel: confidenceN > 0 ? confidenceSum / confidenceN : null,
    lastRecordedAt: lastRecordedAt ? lastRecordedAt.toISOString() : null,
  };
}
