/**
 * Fitness history — append-only read of the `organism_fitness_history`
 * table.
 *
 *   GET /v1/organisms/:slug/fitness?limit=&offset=
 *
 *   ADR 005 §7 (Fitness):
 *     - The truth is `organism_fitness_history`. The `organisms.fitness`
 *       column is a denormalization for fast read; consumers should
 *       read the history.
 *     - Rows are NEVER updated or deleted by application code. They
 *       cascade-delete only when the parent organism is hard-deleted.
 *     - Ordering: paginated by `recorded_at` DESC.
 *
 *   Write path: this module does NOT expose a "record a measurement"
 *   route in v1. The Work Runtime (ADR 006, port 7012) writes new
 *   rows directly to the table; the Organism routes only READ.
 *   Mutation of an Organism that triggers a fitness bump is done in
 *   mutation.ts (which inserts a history row in the same transaction
 *   as the genome update).
 *
 *   Pagination: offset/limit per the v0.2 §33 contract (the spec says
 *   "limit=50&offset=0", offset-based). Cursor pagination can come in
 *   a follow-up; offset is fine for v1 because the history is bounded
 *   by an organism's lifetime.
 */

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  organismFitnessHistory,
  type OrganismFitnessHistory,
} from "../db/schema.js";
import { OrganismError, getOrganismBySlug } from "./organisms.js";

export const FitnessQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type FitnessQuery = z.infer<typeof FitnessQuerySchema>;

export interface FitnessListResult {
  data: OrganismFitnessHistory[];
  nextOffset: number | null;
  limit: number;
  offset: number;
}

/**
 * Paginated fitness history for an organism, ordered by recorded_at DESC.
 *
 * Returns `{ data, nextOffset, limit, offset }` where `nextOffset` is
 * `offset + data.length` if more rows are likely, or `null` if this
 * page was the last.
 */
export async function listFitnessHistory(
  slug: string,
  query: FitnessQuery,
): Promise<FitnessListResult> {
  const db = getDb();
  const org = await getOrganismBySlug(slug);
  if (!org) {
    throw new OrganismError("NOT_FOUND", `Organism '${slug}' not found.`);
  }

  const rows = await db
    .select()
    .from(organismFitnessHistory)
    .where(eq(organismFitnessHistory.organismId, org.id))
    .orderBy(desc(organismFitnessHistory.recordedAt))
    .limit(query.limit + 1)
    .offset(query.offset);

  const data = rows.slice(0, query.limit);
  const nextOffset =
    rows.length > query.limit ? query.offset + data.length : null;

  return { data, nextOffset, limit: query.limit, offset: query.offset };
}
