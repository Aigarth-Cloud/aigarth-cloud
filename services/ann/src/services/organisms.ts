/**
 * Organisms — the canonical registry for the Organism primitive (Phase 26).
 *
 *   The Organism is a stateful, evolving, lineage-tracked computational
 *   intelligence. It extends the Trinary primitive (Phase 18) the way
 *   a process extends a function: by adding persistent state.
 *
 *   This module owns the CRUD surface:
 *     - createOrganism        POST /v1/organisms
 *     - getOrganismBySlug     GET  /v1/organisms/:slug
 *     - listOrganisms         GET  /v1/organisms
 *     - updateOrganism        PATCH /v1/organisms/:slug
 *     - activateOrganism      POST /v1/organisms/:slug/activate
 *     - pauseOrganism         POST /v1/organisms/:slug/pause
 *
 *   Lineage, memory, and mutation live in their own modules
 *   (lineage.ts, memory.ts, mutation.ts). Fitness reads live in
 *   fitness.ts.
 *
 *   Lifecycle (per ADR 005 §4):
 *     draft -> active -> paused -> active (re-activate) -> deprecated/extinct
 *     draft -> deprecated/extinct is forbidden
 *     paused -> extinct is forbidden (must reactivate first)
 *     extinct/deprecated are terminal
 *
 *   Slug format: ^[a-z0-9][a-z0-9-]{2,62}$ (3-63 chars total). Slugs are
 *   the natural external identifier; the id (uuid) is internal.
 *
 *   Visibility default is "private" (creator-first; explicit publish to
 *   public), per ADR 005 §3 / §12 open question 7.
 */

import { and, asc, desc, eq, isNull, sql, lt, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  organisms,
  type Organism,
  type NewOrganism,
  type OrganismStatus,
  type OrganismVisibility,
} from "../db/schema.js";
import { logActivity } from "../lib/audit.js";
import { uid } from "../lib/ids.js";

export type { Organism, OrganismStatus, OrganismVisibility } from "../db/schema.js";

// ---------- Slug + kind regex ----------

/**
 * Slug format: lowercase alphanumeric + hyphens, 3-63 chars, must start
 * with an alphanumeric (per the v0.2 §33 Task 2 contract).
 *
 *   test       -> invalid (too short)
 *   test-org   -> valid
 *   Test-Org   -> invalid (uppercase)
 *   test--org  -> valid (consecutive hyphens are allowed)
 *   -test-org  -> invalid (must not start with hyphen)
 *   test-org-  -> valid (the regex doesn't anchor trailing chars; we
 *                     strip trailing hyphens via slugify if we generate)
 */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{2,62}$/;

/**
 * Kind values from ADR 005 §3 / §4. Note: ADR 005 spells it `synthetist`
 * (one T, IST suffix); the v0.2 PEP §6 spells it `synthesist`. The task
 * spec uses `synthetist` and that is the route-layer enforcement. The DB
 * does not enforce a CHECK on `organisms.kind` (the migration's CHECK is
 * on `organism_memories.kind` only) so the route is the source of truth
 * for v1.
 */
export const ORGANISM_KINDS = [
  "researcher",
  "optimizer",
  "predictor",
  "synthetist",
  "custom",
] as const;
export type OrganismKind = (typeof ORGANISM_KINDS)[number];

// ---------- Object schemas (genome / environment / objective) ----------

/**
 * A JSONB column that must be a non-null, non-array object. We use
 * `z.record(z.string(), z.unknown())` to require string keys, then a
 * refine to reject arrays and null. Primitives (string/number/boolean)
 * are rejected by `z.record` because they don't have string keys.
 */
const JsonObjectSchema = z
  .record(z.string(), z.unknown())
  .refine((v) => v !== null && typeof v === "object" && !Array.isArray(v), {
    message: "must be a JSON object (not array, not null, not primitive)",
  });

// ---------- Request schemas (Zod) ----------

export const CreateOrganismSchema = z
  .object({
    slug: z.string().regex(SLUG_REGEX, "slug must be 3-63 chars, lowercase alphanumeric and hyphens, must start with alphanumeric"),
    name: z.string().min(1).max(200),
    description: z.string().max(20_000).optional(),
    kind: z.enum(ORGANISM_KINDS),
    genome: JsonObjectSchema,
    environment: JsonObjectSchema,
    objective: JsonObjectSchema,
    visibility: z.enum(["public", "unlisted", "private"]).default("private"),
  })
  .strict(); // reject unknown fields (the v0.2 §33 Task 2 requirement)

export const UpdateOrganismSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(20_000).nullable().optional(),
    visibility: z.enum(["public", "unlisted", "private"]).optional(),
    objective: JsonObjectSchema.optional(),
  })
  .strict();

export const ListOrganismsSchema = z.object({
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  kind: z.enum(ORGANISM_KINDS).optional(),
  /** Cursor for descending pagination. The opaque cursor is the row id. */
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateOrganismInput = z.infer<typeof CreateOrganismSchema>;
export type UpdateOrganismInput = z.infer<typeof UpdateOrganismSchema>;
export type ListOrganismsQuery = z.infer<typeof ListOrganismsSchema>;

// ---------- Result types ----------

export interface ListResult {
  data: Organism[];
  nextCursor: string | null;
  limit: number;
}

// ---------- Domain errors ----------

/**
 * Domain-level errors for the organism routes. Each carries a code
 * the route layer maps to an HTTP status.
 */
export class OrganismError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "SLUG_TAKEN"
      | "INVALID_STATE_TRANSITION"
      | "TERMINAL_STATE"
      | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "OrganismError";
  }
}

// ---------- Helpers ----------

function mapRow(r: Organism): Organism {
  return r;
}

// ---------- CRUD ----------

/**
 * Create a new draft Organism. The slug must be unique across the table
 * (the unique index `organisms_slug_idx` enforces this; we surface a
 * 409-style error on collision).
 *
 * The `root_id` is set to the new row's id (founder invariant), and
 * `generation` defaults to 0. `parent_id` is null. The status is
 * 'draft' (the only valid initial state).
 */
export async function createOrganism(
  userId: string,
  input: CreateOrganismInput,
): Promise<Organism> {
  const db = getDb();

  // Insert with explicit id; we need the id before we can set root_id.
  const id = uid();
  const inserted = await db
    .insert(organisms)
    .values({
      id,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      creatorId: userId,
      visibility: input.visibility,
      status: "draft",
      kind: input.kind,
      genome: input.genome,
      environment: input.environment,
      objective: input.objective,
      fitness: null,
      parentId: null,
      rootId: id, // founder: root_id = self
      generation: 0,
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
    action: "organism.created",
    actorUserId: userId,
    targetType: "organism",
    targetId: id,
    metadata: {
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      visibility: row.visibility,
    },
  });

  return mapRow(row);
}

export async function getOrganismBySlug(slug: string): Promise<Organism | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(organisms)
    .where(and(eq(organisms.slug, slug), isNull(organisms.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * List organisms, cursor-paginated by id desc. The visibility filter
 * is layered with the creator filter:
 *
 *   Anonymous:      visibility = 'public'
 *   Authenticated:  (visibility = 'public')
 *                OR (creator_id = :user)   -- creator sees their own anything
 *
 * Cursor format: the row id (uuid). Use `id < :cursor` for descending
 * pagination per the v0.2 §33 contract.
 */
export async function listOrganisms(
  query: ListOrganismsQuery,
  userId: string | null,
): Promise<ListResult> {
  const db = getDb();

  // Build the WHERE clause incrementally.
  const conds = [isNull(organisms.deletedAt)];

  if (query.visibility) {
    // Explicit visibility filter (e.g. unlisted by direct slug lookup).
    conds.push(eq(organisms.visibility, query.visibility));
  } else if (userId) {
    // Public + own-anything.
    conds.push(
      or(eq(organisms.visibility, "public"), eq(organisms.creatorId, userId))!,
    );
  } else {
    // Anonymous: public only.
    conds.push(eq(organisms.visibility, "public"));
  }

  if (query.kind) {
    conds.push(eq(organisms.kind, query.kind));
  }

  if (query.cursor) {
    // Cursor: fetch rows with id < cursor (descending).
    conds.push(lt(organisms.id, query.cursor));
  }

  const where = and(...conds);
  const rows = await db
    .select()
    .from(organisms)
    .where(where)
    .orderBy(desc(organisms.id))
    .limit(query.limit + 1); // +1 to detect "has more"

  const data = rows.slice(0, query.limit);
  const nextCursor = rows.length > query.limit ? data[data.length - 1]!.id : null;

  return { data, nextCursor, limit: query.limit };
}

/**
 * Update an Organism. Only the creator may PATCH. The lifecycle
 * status is NOT updatable via PATCH — that's activate/pause/extinct.
 */
export async function updateOrganism(
  userId: string,
  slug: string,
  input: UpdateOrganismInput,
): Promise<Organism> {
  const db = getDb();
  const existing = await getOrganismBySlug(slug);
  if (!existing) {
    throw new OrganismError("NOT_FOUND", `Organism '${slug}' not found.`);
  }
  if (existing.creatorId !== userId) {
    throw new OrganismError("FORBIDDEN", "Only the creator can update this organism.");
  }
  if (existing.status === "extinct" || existing.status === "deprecated") {
    throw new OrganismError("TERMINAL_STATE", `Cannot update an organism in status '${existing.status}'.`);
  }

  const updates: Partial<NewOrganism> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.objective !== undefined) updates.objective = input.objective;

  const updated = await db
    .update(organisms)
    .set(updates)
    .where(eq(organisms.id, existing.id))
    .returning();

  const row = updated[0]!;
  await logActivity(db, {
    action: "organism.updated",
    actorUserId: userId,
    targetType: "organism",
    targetId: existing.id,
    metadata: { fields: Object.keys(input) },
  });
  return mapRow(row);
}

// ---------- Lifecycle ----------

/**
 * Activate an organism. Allowed transitions (per ADR 005 §4):
 *   draft    -> active
 *   paused   -> active   (re-activate)
 *
 *   active   -> active   is FORBIDDEN (409 — state machine violation)
 *   extinct  -> *        is FORBIDDEN (terminal)
 *   deprecated -> *      is FORBIDDEN (terminal)
 *
 * On activation, set `birth_at` if it's the first activation (i.e. it
 * was draft). On re-activation from paused, leave birth_at as-is.
 */
export async function activateOrganism(userId: string, slug: string): Promise<Organism> {
  const db = getDb();
  const existing = await getOrganismBySlug(slug);
  if (!existing) {
    throw new OrganismError("NOT_FOUND", `Organism '${slug}' not found.`);
  }
  if (existing.creatorId !== userId) {
    throw new OrganismError("FORBIDDEN", "Only the creator can activate this organism.");
  }
  if (existing.status === "extinct" || existing.status === "deprecated") {
    throw new OrganismError("TERMINAL_STATE", `Cannot activate an organism in terminal status '${existing.status}'.`);
  }
  if (existing.status === "active") {
    throw new OrganismError(
      "INVALID_STATE_TRANSITION",
      `Organism is already active.`,
    );
  }
  // valid: draft -> active OR paused -> active
  const isFirstActivation = existing.status === "draft" && existing.birthAt == null;

  const updated = await db
    .update(organisms)
    .set({
      status: "active",
      birthAt: isFirstActivation ? new Date() : existing.birthAt,
      updatedAt: new Date(),
    })
    .where(eq(organisms.id, existing.id))
    .returning();

  const row = updated[0]!;
  await logActivity(db, {
    action: "organism.activated",
    actorUserId: userId,
    targetType: "organism",
    targetId: existing.id,
    metadata: { previousStatus: existing.status, firstActivation: isFirstActivation },
  });
  return mapRow(row);
}

/**
 * Pause an organism. Allowed transitions:
 *   active -> paused
 *
 *   draft  -> paused   is FORBIDDEN (no point pausing a non-active)
 *   paused -> paused   is FORBIDDEN (state machine violation)
 *   extinct/deprecated are terminal
 */
export async function pauseOrganism(userId: string, slug: string): Promise<Organism> {
  const db = getDb();
  const existing = await getOrganismBySlug(slug);
  if (!existing) {
    throw new OrganismError("NOT_FOUND", `Organism '${slug}' not found.`);
  }
  if (existing.creatorId !== userId) {
    throw new OrganismError("FORBIDDEN", "Only the creator can pause this organism.");
  }
  if (existing.status === "extinct" || existing.status === "deprecated") {
    throw new OrganismError("TERMINAL_STATE", `Cannot pause an organism in terminal status '${existing.status}'.`);
  }
  if (existing.status === "draft") {
    throw new OrganismError(
      "INVALID_STATE_TRANSITION",
      `Cannot pause a 'draft' organism. Activate it first.`,
    );
  }
  if (existing.status === "paused") {
    throw new OrganismError(
      "INVALID_STATE_TRANSITION",
      `Organism is already paused.`,
    );
  }
  // valid: active -> paused

  const updated = await db
    .update(organisms)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(organisms.id, existing.id))
    .returning();

  const row = updated[0]!;
  await logActivity(db, {
    action: "organism.paused",
    actorUserId: userId,
    targetType: "organism",
    targetId: existing.id,
    metadata: { previousStatus: existing.status },
  });
  return mapRow(row);
}

// ---------- Helpers exported for tests + sibling services ----------

/**
 * Whether a status is terminal (no transitions out).
 */
export function isTerminalStatus(s: OrganismStatus): boolean {
  return s === "extinct" || s === "deprecated";
}

/**
 * Map an OrganismError to an HTTP status code. Exposed so sibling
 * services (e.g. lineage.ts) can throw the same shape and the
 * routes/organisms.ts handler can map uniformly.
 */
export function statusFromOrganismError(err: OrganismError): number {
  switch (err.code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "SLUG_TAKEN":
      return 409;
    case "INVALID_STATE_TRANSITION":
    case "TERMINAL_STATE":
      return 409;
    case "INVALID_INPUT":
    default:
      return 400;
  }
}
