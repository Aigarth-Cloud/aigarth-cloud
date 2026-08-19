/**
 * Organism memory — append-only write + paginated read.
 *
 *   GET  /v1/organisms/:slug/memory?kind=&since=&limit=
 *   POST /v1/organisms/:slug/memory
 *
 *   ADR 005 §6 (Memory):
 *     - Three kinds: short_term, long_term, episodic
 *     - `expires_at` is required for short_term; NULL for long_term
 *       and episodic (enforced in the route, not the DB by design)
 *     - Memory entries are signed with HMAC-SHA-256 keyed on a per-
 *       organism service key (v1: a single env-var key shared across
 *       all organisms, matching the ADR 003 trinary signing pattern).
 *       The signature lives in `payload.signature`, not a separate
 *       column.
 *     - Memory is append-only. No UPDATE, no DELETE except by the
 *       cron sweeper for expired short_term entries (deferred to v2).
 *
 *   v1: we use the same ANN_TRINARY_SIGNING_KEY that signs trinary
 *   IntentEnvelopes. The organism id is mixed into the signed payload
 *   so the same envelope payload under a different organism id would
 *   produce a different signature. v2 swaps this for a per-organism
 *   secret loaded from KMS/Vault.
 */

import { and, desc, eq, gt, sql } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  organismMemories,
  type OrganismMemory,
  type NewOrganismMemory,
} from "../db/schema.js";
import { loadConfig } from "../config/index.js";
import { OrganismError, getOrganismBySlug } from "./organisms.js";
import { uid } from "../lib/ids.js";

export const MEMORY_KINDS = ["short_term", "long_term", "episodic"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

// ---------- Schemas ----------

/**
 * Post body for POST /v1/organisms/:slug/memory.
 *
 *   kind     — required, one of MEMORY_KINDS.
 *   payload  — required JSON object. The signature is added to this
 *              object on the way in (under `payload.signature`).
 *   expires_at — required iff kind == 'short_term'; forbidden iff
 *                kind == 'long_term' or 'episodic'. Enforced in
 *                .refine, not via .union(), so a single body shape
 *                covers all three kinds.
 */
export const WriteMemorySchema = z
  .object({
    kind: z.enum(MEMORY_KINDS),
    payload: z.record(z.string(), z.unknown()),
    expiresAt: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (v) => v.kind !== "short_term" || !!v.expiresAt,
    {
      message: "expiresAt is required for kind=short_term",
      path: ["expiresAt"],
    },
  )
  .refine(
    (v) => v.kind === "short_term" || !v.expiresAt,
    {
      message: "expiresAt must not be set for kind=long_term or kind=episodic",
      path: ["expiresAt"],
    },
  )
  // The caller may not pre-set the signature. We strip it on input
  // (the route generates it). The .transform runs after .refine, so
  // a pre-set signature is silently overwritten.
  .transform((v) => {
    const { signature: _drop, ...rest } = v.payload;
    return { ...v, payload: rest };
  });

export type WriteMemoryInput = z.infer<typeof WriteMemorySchema>;

/**
 * Query schema for GET /v1/organisms/:slug/memory.
 *
 *   kind   — required, one of MEMORY_KINDS. Filtering by kind is
 *            part of the contract; the composite index
 *            (organism_id, kind) makes this an index scan.
 *   since  — optional ISO 8601 timestamp. Filters out entries
 *            written at or before this instant.
 *   limit  — page size, 1-200, default 50.
 *   cursor — optional. The id of the last row on the previous page;
 *            the next page returns rows with id < cursor.
 */
export const ListMemoryQuerySchema = z.object({
  kind: z.enum(MEMORY_KINDS, {
    errorMap: () => ({ message: `kind must be one of: ${MEMORY_KINDS.join(", ")}` }),
  }),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});

export type ListMemoryQuery = z.infer<typeof ListMemoryQuerySchema>;

export interface MemoryListResult {
  data: OrganismMemory[];
  nextCursor: string | null;
  limit: number;
}

// ---------- Signing ----------

/**
 * Sign a memory payload. Returns a hex-encoded HMAC-SHA-256.
 *
 * The signed bytes are the canonical JSON of the payload. The
 * organism id is mixed into the signed material so the same payload
 * under a different organism id would produce a different signature.
 *
 * Per ADR 005 §6 + ADR 003, v1 uses a single env-var key for all
 * organisms. v2 swaps this for a per-organism secret.
 */
function signMemoryPayload(
  organismId: string,
  payload: Record<string, unknown>,
  key: string,
): string {
  const canonical = JSON.stringify({ organism_id: organismId, payload });
  return createHmac("sha256", key).update(canonical, "utf8").digest("hex");
}

// ---------- Write ----------

/**
 * Append a memory entry to the organism's log. The signature is
 * computed and stored in `payload.signature`. The row is otherwise
 * opaque — the route serializes it back as-is.
 */
export async function writeMemory(
  userId: string,
  slug: string,
  input: WriteMemoryInput,
): Promise<OrganismMemory> {
  const db = getDb();
  const org = await getOrganismBySlug(slug);
  if (!org) {
    throw new OrganismError("NOT_FOUND", `Organism '${slug}' not found.`);
  }
  if (org.creatorId !== userId) {
    throw new OrganismError("FORBIDDEN", "Only the creator can write to this organism's memory.");
  }

  const cfg = loadConfig();
  const signature = signMemoryPayload(org.id, input.payload, cfg.ANN_TRINARY_SIGNING_KEY);

  // Add the signature into the payload (per ADR 005 §6: signature
  // lives in payload.signature, not a separate column).
  const signedPayload: Record<string, unknown> = {
    ...input.payload,
    signature,
  };

  const id = uid();
  const writtenAt = new Date();
  const expiresAt = input.kind === "short_term" ? new Date(input.expiresAt!) : null;

  const inserted = await db
    .insert(organismMemories)
    .values({
      id,
      organismId: org.id,
      kind: input.kind,
      payload: signedPayload,
      writtenAt,
      expiresAt,
    } satisfies NewOrganismMemory)
    .returning();

  return inserted[0]!;
}

// ---------- Read ----------

/**
 * Paginated memory log for an organism. Filtered by kind. The
 * composite index `organism_memories_organism_kind_idx` (on
 * organism_id, kind) makes the kind filter an index scan.
 *
 *   - If `since` is set, only entries with written_at > since are
 *     returned. The DB column is timestamp with time zone; we
 *     coerce the ISO 8601 string to a Date.
 *   - Ordering: written_at DESC, id DESC (deterministic).
 *   - Pagination: cursor-based on id, descending.
 */
export async function listMemory(
  slug: string,
  query: ListMemoryQuery,
): Promise<MemoryListResult> {
  const db = getDb();
  const org = await getOrganismBySlug(slug);
  if (!org) {
    throw new OrganismError("NOT_FOUND", `Organism '${slug}' not found.`);
  }

  const conds = [
    eq(organismMemories.organismId, org.id),
    eq(organismMemories.kind, query.kind),
  ];

  if (query.since) {
    const since = new Date(query.since);
    conds.push(gt(organismMemories.writtenAt, since));
  }

  if (query.cursor) {
    conds.push(sql`${organismMemories.id} < ${query.cursor}`);
  }

  const rows = await db
    .select()
    .from(organismMemories)
    .where(and(...conds))
    .orderBy(desc(organismMemories.writtenAt), desc(organismMemories.id))
    .limit(query.limit + 1);

  const data = rows.slice(0, query.limit);
  const nextCursor = rows.length > query.limit ? data[data.length - 1]!.id : null;

  return { data, nextCursor, limit: query.limit };
}
