/**
 * Manual genome mutation.
 *
 *   POST /v1/organisms/:slug/mutate
 *
 *   ADR 005 §6 (Memory) + §7 (Fitness):
 *     - Mutation bumps the genome's internal `version` field (a
 *       counter inside the JSONB, not a column).
 *     - The mutation is recorded in the organism's long-term memory
 *       as `{ event: 'mutation', old_version, new_version, diff }`.
 *       The diff is best-effort: a shallow JSON diff. We don't pull
 *       in a library (ADR 005 §6 hard rule: no new dependencies).
 *
 *   The "diff" we store is a list of leaf-level path → { before, after }
 *   entries. For v1, this is enough for an audit trail; the Proof Lab
 *   and Garden UI (Phase 26.D) render the genome + memory log and
 *   don't need a structural diff library.
 *
 *   Only the creator may mutate. Extinct / deprecated organisms are
 *   terminal and reject mutations.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  organisms,
  type Organism,
} from "../db/schema.js";
import { OrganismError, isTerminalStatus, getOrganismBySlug } from "./organisms.js";
import { writeMemory } from "./memory.js";

export const MutateSchema = z
  .object({
    /**
     * A partial genome. We MERGE this into the existing genome
     * (shallow at the top level). Nested objects are NOT deep-merged
     * in v1 — the caller passes the full nested object they want to
     * replace. This keeps the semantics obvious: a mutation replaces
     * the keys you specify.
     */
    genome: z.record(z.string(), z.unknown()),
  })
  .strict()
  .refine((v) => Object.keys(v.genome).length > 0, {
    message: "genome must contain at least one field to mutate",
    path: ["genome"],
  });

export type MutateInput = z.infer<typeof MutateSchema>;

// ---------- Diff ----------

interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

/**
 * Compute a leaf-level JSON diff between two values. Returns a list of
 * `{ path, before, after }` entries. For v1 we walk both sides
 * recursively, comparing scalars and recursing into objects; arrays
 * are compared as scalars (replace them wholesale if they differ).
 *
 * This is intentionally simple — no new dep, no fancy structural diff.
 * The audit trail in the memory entry is best-effort.
 */
function diffJson(
  before: unknown,
  after: unknown,
  basePath = "",
  out: DiffEntry[] = [],
): DiffEntry[] {
  // Same reference or same JSON value? Skip.
  if (before === after) return out;

  // Type mismatch (one is object, the other isn't): leaf.
  if (typeof before !== typeof after) {
    out.push({ path: basePath || "<root>", before, after });
    return out;
  }

  // Object: recurse into keys that exist on either side.
  if (
    before !== null &&
    after !== null &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const a = before as Record<string, unknown>;
    const b = after as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      diffJson(a[k], b[k], basePath ? `${basePath}.${k}` : k, out);
    }
    return out;
  }

  // Array or scalar: treat as a leaf.
  out.push({ path: basePath || "<root>", before, after });
  return out;
}

// ---------- Mutate ----------

/**
 * Apply a manual mutation to an organism's genome.
 *
 *   - Bumps `genome.version` by 1 (the internal counter inside the
 *     JSONB, not a column).
 *   - Merges the input genome into the existing genome at the top
 *     level (shallow). The caller passes the full nested object for
 *     any key they want to replace.
 *   - Records a `long_term` memory entry with the diff.
 *   - Returns the updated organism.
 *
 * The mutation is atomic with the memory write from the caller's
 * perspective: the route does both calls. v2 wraps them in a single
 * transaction when the DB session supports it.
 */
export async function mutateOrganism(
  userId: string,
  slug: string,
  input: MutateInput,
): Promise<Organism> {
  const db = getDb();
  const existing = await getOrganismBySlug(slug);
  if (!existing) {
    throw new OrganismError("NOT_FOUND", `Organism '${slug}' not found.`);
  }
  if (existing.creatorId !== userId) {
    throw new OrganismError("FORBIDDEN", "Only the creator can mutate this organism.");
  }
  if (isTerminalStatus(existing.status)) {
    throw new OrganismError(
      "TERMINAL_STATE",
      `Cannot mutate an organism in terminal status '${existing.status}'.`,
    );
  }

  const oldGenome = existing.genome as Record<string, unknown>;
  const oldVersion = typeof oldGenome["version"] === "number" ? (oldGenome["version"] as number) : 0;
  const newVersion = oldVersion + 1;

  // Shallow merge: the input's keys override the existing genome.
  // For nested objects (e.g. mutation, recombination), the caller
  // passes the full replacement.
  const newGenome: Record<string, unknown> = {
    ...oldGenome,
    ...input.genome,
    version: newVersion,
  };

  const updated = await db
    .update(organisms)
    .set({ genome: newGenome, updatedAt: new Date() })
    .where(eq(organisms.id, existing.id))
    .returning();

  const row = updated[0]!;

  // Record the mutation in long-term memory. The diff is best-effort.
  const diff = diffJson(oldGenome, newGenome);
  await writeMemory(userId, slug, {
    kind: "long_term",
    payload: {
      event: "mutation",
      old_version: oldVersion,
      new_version: newVersion,
      diff,
    },
  });

  return row;
}
