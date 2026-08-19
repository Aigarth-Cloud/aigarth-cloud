/**
 * Lineage — recursive-CTE descendants tree + fork.
 *
 *   GET  /v1/organisms/:slug/lineage -> recursive descendants tree
 *   POST /v1/organisms/:slug/fork    -> create a child organism
 *
 *   ADR 005 §5 (Lineage):
 *     - parent_id is the immediate parent (NULL for founders)
 *     - root_id   is the founder of the lineage (id on founders)
 *     - generation is the depth from the root (0 for founders)
 *
 *   The lineage tree is rooted at the requested organism and includes
 *   all descendants. The recursive CTE bounds depth at MAX_DEPTH (100)
 *   for defensive against pathological forks (a fork bomb of generations
 *   would otherwise balloon the response).
 *
 *   Cycles are impossible by construction:
 *     1. The DB enforces `parent_id <> id` (the CHECK constraint on
 *        `organisms`).
 *     2. The fork route validates the parent is not extinct or
 *        deprecated (terminal; can have no children).
 *     3. The root_id invariant is preserved on every insert: a child's
 *        root_id is set to the parent's root_id and never changes.
 *
 *   Fork idempotency: per ADR 005 §12 open question 6, the PEP §33 test
 *   says "same source = different children". The route does NOT dedupe
 *   forks; two POSTs to /fork from the same parent produce two distinct
 *   children. This matches the open-question call.
 */

import { and, eq, isNull, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  organisms,
  type Organism,
  type NewOrganism,
} from "../db/schema.js";
import { logActivity } from "../lib/audit.js";
import { uid } from "../lib/ids.js";
import { OrganismError, isTerminalStatus, getOrganismBySlug } from "./organisms.js";

/** Max depth of a lineage tree. 100 is defensive, not user-facing. */
export const MAX_LINEAGE_DEPTH = 100;

export const ForkSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(20_000).optional(),
  })
  .strict();

export type ForkInput = z.infer<typeof ForkSchema>;

/** Public shape of a lineage node. Matches the v0.2 §33 spec. */
export interface LineageNode {
  id: string;
  slug: string;
  name: string;
  generation: number;
  parent_id: string | null;
  children: LineageNode[];
}

// ---------- Lineage (recursive CTE) ----------

/**
 * Build the descendants tree of an organism, rooted at the requested
 * organism. Each node's `children` array is populated in JS from the
 * flat result of the recursive CTE.
 *
 * The CTE is bounded by `MAX_LINEAGE_DEPTH` (100) — see module header.
 * Soft-deleted organisms are excluded by the partial index on the
 * underlying table plus an explicit `deleted_at IS NULL` filter.
 */
export async function getLineage(slug: string): Promise<LineageNode> {
  const db = getDb();
  const root = await getOrganismBySlug(slug);
  if (!root) {
    throw new OrganismError("NOT_FOUND", `Organism '${slug}' not found.`);
  }

  // Recursive CTE on parent_id. The depth guard prevents pathological
  // responses if a misconfigured database ever contains an absurdly
  // deep tree.
  //
  // We return (id, slug, name, generation, parent_id, depth). The
  // depth is 0 for the root (the requested organism) and increments
  // by 1 per descent level.
  const result = await db.execute<{
    id: string;
    slug: string;
    name: string;
    generation: number;
    parent_id: string;
    depth: number;
  }>(sql`
    WITH RECURSIVE lineage_tree AS (
      SELECT id, slug, name, generation, parent_id, 0 AS depth
        FROM organisms
       WHERE id = ${root.id}
         AND deleted_at IS NULL
      UNION ALL
      SELECT o.id, o.slug, o.name, o.generation, o.parent_id, lt.depth + 1
        FROM organisms o
        INNER JOIN lineage_tree lt ON o.parent_id = lt.id
       WHERE o.deleted_at IS NULL
         AND lt.depth < ${MAX_LINEAGE_DEPTH}
    )
    SELECT id, slug, name, generation, parent_id, depth
      FROM lineage_tree
     ORDER BY depth ASC, generation ASC, id ASC
  `);

  const rows = result.rows ?? [];

  // Build a map: id -> LineageNode (with empty children).
  const byId = new Map<string, LineageNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      slug: r.slug,
      name: r.name,
      generation: r.generation,
      parent_id: r.parent_id,
      children: [],
    });
  }

  // Wire up children. Skip the root for the "no parent" case.
  for (const r of rows) {
    if (r.id === root.id) continue;
    const parent = byId.get(r.parent_id);
    if (parent) {
      parent.children.push(byId.get(r.id)!);
    }
  }

  // The root node is the requested organism.
  const rootNode = byId.get(root.id);
  if (!rootNode) {
    // Should be impossible — the CTE starts from root.id.
    throw new OrganismError("NOT_FOUND", `Lineage root '${slug}' disappeared mid-query.`);
  }
  return rootNode;
}

// ---------- Fork ----------

/**
 * Create a child organism (fork).
 *
 *   - The parent must exist and be in a non-terminal status.
 *     (extinct / deprecated cannot have children, per ADR 005 §4
 *      terminal-state rules.)
 *   - The child's parent_id is the parent's id.
 *   - The child's root_id is the parent's root_id (preserved across
 *     the fork).
 *   - The child's generation is parent.generation + 1.
 *   - The child's genome is a deep copy of the parent's genome (the
 *     child can mutate later via /mutate).
 *   - The child's status is 'draft'.
 *   - The child's slug is auto-generated from the parent's slug with
 *     a 4-char suffix to disambiguate.
 *
 * Two concurrent /fork calls from the same parent produce two distinct
 * children (no dedupe), per ADR 005 §12 open question 6.
 */
export async function forkOrganism(
  userId: string,
  parentSlug: string,
  input: ForkInput = {},
): Promise<Organism> {
  const db = getDb();
  const parent = await getOrganismBySlug(parentSlug);
  if (!parent) {
    throw new OrganismError("NOT_FOUND", `Parent organism '${parentSlug}' not found.`);
  }
  if (parent.creatorId !== userId) {
    throw new OrganismError("FORBIDDEN", "Only the creator can fork this organism.");
  }
  if (isTerminalStatus(parent.status)) {
    throw new OrganismError(
      "INVALID_STATE_TRANSITION",
      `Cannot fork an organism in terminal status '${parent.status}'.`,
    );
  }

  // Generate a unique child slug. We append a 6-char base36 suffix to
  // disambiguate forks from the same parent. The slug uniqueness
  // constraint is enforced by the DB; we catch the duplicate and
  // retry up to 3 times.
  const base = `${parent.slug}-fork`;
  let childSlug = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const suffix = uid().replace(/-/g, "").slice(0, 6).toLowerCase();
    const candidate = `${base}-${suffix}`;
    const existing = await db
      .select({ id: organisms.id })
      .from(organisms)
      .where(eq(organisms.slug, candidate))
      .limit(1);
    if (!existing[0]) {
      childSlug = candidate;
      break;
    }
  }
  if (!childSlug) {
    // Astronomically unlikely (3 random uuids in a row collide). Surface
    // as a slug-taken error.
    throw new OrganismError("SLUG_TAKEN", "Could not generate a unique child slug; please retry.");
  }

  const childId = uid();
  const childName = input.name ?? `${parent.name} (fork)`;
  const childDescription = input.description ?? parent.description;

  const inserted = await db
    .insert(organisms)
    .values({
      id: childId,
      slug: childSlug,
      name: childName,
      description: childDescription,
      creatorId: userId,
      visibility: "private", // forks default to private; the creator can publish later
      status: "draft",
      kind: parent.kind,
      // Copy the genome. structuredClone gives a deep copy of the
      // JSONB payload so the child's later mutations don't bleed
      // into the parent.
      genome: structuredClone(parent.genome),
      environment: structuredClone(parent.environment),
      objective: structuredClone(parent.objective),
      fitness: null,
      parentId: parent.id,
      rootId: parent.rootId, // preserve the lineage root
      generation: parent.generation + 1,
      computeConsumed: {},
      birthAt: null,
      deathAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } satisfies NewOrganism)
    .returning();

  const row = inserted[0]!;

  await logActivity(db, {
    action: "organism.forked",
    actorUserId: userId,
    targetType: "organism",
    targetId: childId,
    metadata: {
      parentId: parent.id,
      parentSlug: parent.slug,
      childSlug: row.slug,
      generation: row.generation,
      rootId: row.rootId,
    },
  });

  return row;
}
