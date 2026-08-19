/**
 * /v1/organisms/* — the Organism primitive surface (Phase 26).
 *
 *   The Organism is a stateful, evolving, lineage-tracked computational
 *   intelligence. It extends the Trinary primitive (Phase 18) the way
 *   a process extends a function: by adding persistent state.
 *
 *   Public (no auth):
 *     GET  /v1/organisms                    — list public, paginated
 *     GET  /v1/organisms/:slug              — retrieve
 *     GET  /v1/organisms/:slug/lineage      — descendants tree
 *     GET  /v1/organisms/:slug/fitness      — fitness history
 *     GET  /v1/organisms/:slug/memory       — paginated memory log
 *
 *   Authenticated (JWT):
 *     POST   /v1/organisms                  — create draft
 *     PATCH  /v1/organisms/:slug            — update metadata (creator only)
 *     POST   /v1/organisms/:slug/activate   — draft|paused -> active
 *     POST   /v1/organisms/:slug/pause      — active -> paused
 *     POST   /v1/organisms/:slug/fork       — create child organism
 *     POST   /v1/organisms/:slug/memory     — write memory entry
 *     POST   /v1/organisms/:slug/mutate     — manual genome mutation
 *
 *   Routes conform to ADR 005 §8. The schema (Task 1) and the routes
 *   (Tasks 2-4) form the Phase 26 surface.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createOrganism,
  getOrganismBySlug,
  listOrganisms,
  updateOrganism,
  activateOrganism,
  pauseOrganism,
  OrganismError,
  statusFromOrganismError,
  CreateOrganismSchema,
  UpdateOrganismSchema,
  ListOrganismsSchema,
  type CreateOrganismInput,
  type UpdateOrganismInput,
  type ListOrganismsQuery,
} from "../services/organisms.js";
import {
  getLineage,
  forkOrganism,
  ForkSchema,
  type ForkInput,
} from "../services/lineage.js";
import {
  listFitnessHistory,
  FitnessQuerySchema,
  type FitnessQuery,
} from "../services/fitness.js";
import {
  writeMemory,
  listMemory,
  WriteMemorySchema,
  ListMemoryQuerySchema,
  type WriteMemoryInput,
  type ListMemoryQuery,
} from "../services/memory.js";
import { mutateOrganism, MutateSchema, type MutateInput } from "../services/mutation.js";
import { findExisting, store as storeIdempotent, hashRequest, getIdempotencyKey } from "../services/idempotency.js";
import { logActivity } from "../lib/audit.js";
import { getDb } from "../db/index.js";

// ---------- Serializer ----------

/**
 * Serialize an Organism row to wire format. snake_case keys; JSONB
 * fields pass through as-is; timestamps as ISO 8601 strings.
 */
function serialize(o: import("../db/schema.js").Organism) {
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    description: o.description,
    creator_id: o.creatorId,
    visibility: o.visibility,
    status: o.status,
    kind: o.kind,
    genome: o.genome,
    environment: o.environment,
    objective: o.objective,
    fitness: o.fitness,
    parent_id: o.parentId,
    root_id: o.rootId,
    generation: o.generation,
    compute_consumed: o.computeConsumed,
    birth_at: o.birthAt?.toISOString() ?? null,
    death_at: o.deathAt?.toISOString() ?? null,
    created_at: o.createdAt.toISOString(),
    updated_at: o.updatedAt.toISOString(),
  };
}

function serializeMemory(m: import("../db/schema.js").OrganismMemory) {
  return {
    id: m.id,
    organism_id: m.organismId,
    kind: m.kind,
    payload: m.payload,
    written_at: m.writtenAt.toISOString(),
    expires_at: m.expiresAt?.toISOString() ?? null,
  };
}

function serializeFitnessEntry(f: import("../db/schema.js").OrganismFitnessHistory) {
  return {
    id: f.id,
    organism_id: f.organismId,
    generation: f.generation,
    fitness: f.fitness,
    components: f.components,
    recorded_at: f.recordedAt.toISOString(),
  };
}

// ---------- Error mapper ----------

function statusFromError(err: unknown): { status: number; message: string } {
  if (err instanceof OrganismError) {
    return { status: statusFromOrganismError(err), message: err.message };
  }
  // Zod errors that bypass our top-level safeParse are caught here.
  return {
    status: 400,
    message: err instanceof Error ? err.message : String(err),
  };
}

// ---------- Route registration ----------

export async function organismRoutes(app: FastifyInstance) {
  // =====================================================================
  // Public reads
  // =====================================================================

  // ---------- GET /v1/organisms — list ----------
  //
  // The list endpoint is public. If a JWT is present, we honour it
  // so the caller sees their own private + unlisted organisms in
  // addition to the public ones. We do NOT require the JWT — a
  // missing or invalid token is treated as anonymous.
  app.get("/v1/organisms", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListOrganismsSchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const query: ListOrganismsQuery = parse.data;
    // Try to verify the JWT silently. If it succeeds, req.user is
    // populated. If it fails (missing or invalid), we fall through
    // to anonymous. We use a custom preHandler below; here we just
    // read the result.
    const userId = (req.user as { sub?: string } | undefined)?.sub ?? null;
    try {
      const result = await listOrganisms(query, userId);
      return reply.send({
        data: result.data.map(serialize),
        next_cursor: result.nextCursor,
        limit: result.limit,
      });
    } catch (err) {
      const { status, message } = statusFromError(err);
      return reply.code(status).send({ error: { message } });
    }
  });

  // Optional-auth preHandler for the public list endpoint. If a JWT
  // is present, verify it (best-effort; failures are silent so the
  // route still serves anonymous traffic).
  app.addHook("preHandler", async (req: FastifyRequest, _reply: FastifyReply) => {
    if (req.url !== "/v1/organisms" || req.method !== "GET") return;
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) return;
    try {
      await req.jwtVerify();
    } catch {
      // Invalid token — proceed as anonymous.
    }
  });

  // ---------- GET /v1/organisms/:slug/lineage — recursive tree ----------
  //
  // Registered BEFORE the generic GET /v1/organisms/:slug route so
  // Fastify's prefix matcher prefers the more specific path. Without
  // this, /v1/organisms/foo/lineage matches /v1/organisms/:slug
  // first with slug="foo/lineage".

  app.get("/v1/organisms/:slug/lineage", async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    try {
      const tree = await getLineage(slug);
      return reply.send(tree);
    } catch (err) {
      const { status, message } = statusFromError(err);
      return reply.code(status).send({ error: { message } });
    }
  });

  // ---------- GET /v1/organisms/:slug/fitness — paginated history ----------

  app.get("/v1/organisms/:slug/fitness", async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    const parse = FitnessQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const query: FitnessQuery = parse.data;
    try {
      const result = await listFitnessHistory(slug, query);
      return reply.send({
        data: result.data.map(serializeFitnessEntry),
        next_offset: result.nextOffset,
        limit: result.limit,
        offset: result.offset,
      });
    } catch (err) {
      const { status, message } = statusFromError(err);
      return reply.code(status).send({ error: { message } });
    }
  });

  // ---------- GET /v1/organisms/:slug/memory — paginated memory ----------

  app.get("/v1/organisms/:slug/memory", async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    const parse = ListMemoryQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const query: ListMemoryQuery = parse.data;
    try {
      const result = await listMemory(slug, query);
      return reply.send({
        data: result.data.map(serializeMemory),
        next_cursor: result.nextCursor,
        limit: result.limit,
      });
    } catch (err) {
      const { status, message } = statusFromError(err);
      return reply.code(status).send({ error: { message } });
    }
  });

  // ---------- GET /v1/organisms/:slug — retrieve ----------
  //
  // Registered LAST among the GET /v1/organisms/:slug/* routes so
  // the more specific paths (lineage, fitness, memory) match first.

  app.get("/v1/organisms/:slug", async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    try {
      const o = await getOrganismBySlug(slug);
      if (!o) return reply.code(404).send({ error: { message: "Organism not found" } });
      return reply.send(serialize(o));
    } catch (err) {
      const { status, message } = statusFromError(err);
      return reply.code(status).send({ error: { message } });
    }
  });

  // =====================================================================
  // Authenticated writes
  // =====================================================================

  // ---------- POST /v1/organisms — create draft ----------

  app.post(
    "/v1/organisms",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;

      // Idempotency: replay-with-same-key is supported on POST.
      const idemKey = getIdempotencyKey(req);
      const reqHash = hashRequest(req.body);
      if (idemKey) {
        const existing = await findExisting(userId, idemKey, "POST /v1/organisms");
        if (existing) {
          if (existing.requestHash !== reqHash) {
            return reply.code(422).send({
              error: { message: "Idempotency-Key reused with a different request body" },
            });
          }
          reply.header("Idempotent-Replay", "true");
          return reply.code(existing.responseStatus).send(existing.responseBody as Record<string, unknown>);
        }
      }

      const parse = CreateOrganismSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({
          error: { message: "Invalid input", issues: parse.error.issues },
        });
      }
      const input: CreateOrganismInput = parse.data;

      try {
        const o = await createOrganism(userId, input);
        const body = serialize(o);
        if (idemKey) {
          await storeIdempotent(userId, idemKey, "POST /v1/organisms", reqHash, 201, body);
        }
        return reply.code(201).send(body);
      } catch (err) {
        // Slug-uniqueness collisions land here as a Postgres unique
        // violation. We surface them as 409.
        const msg = err instanceof Error ? err.message : "Create failed";
        const lower = msg.toLowerCase();
        if (lower.includes("unique") || lower.includes("duplicate") || lower.includes("slug")) {
          return reply.code(409).send({ error: { message: `Slug '${input.slug}' is already taken.` } });
        }
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  // ---------- PATCH /v1/organisms/:slug — update ----------

  app.patch(
    "/v1/organisms/:slug",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;
      const { slug } = req.params as { slug: string };
      const parse = UpdateOrganismSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const input: UpdateOrganismInput = parse.data;
      try {
        const o = await updateOrganism(userId, slug, input);
        return reply.send(serialize(o));
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  // ---------- POST /v1/organisms/:slug/activate ----------

  app.post(
    "/v1/organisms/:slug/activate",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;
      const { slug } = req.params as { slug: string };
      try {
        const o = await activateOrganism(userId, slug);
        return reply.send(serialize(o));
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  // ---------- POST /v1/organisms/:slug/pause ----------

  app.post(
    "/v1/organisms/:slug/pause",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;
      const { slug } = req.params as { slug: string };
      try {
        const o = await pauseOrganism(userId, slug);
        return reply.send(serialize(o));
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  // =====================================================================
  // Task 3 — Lineage routes
  // =====================================================================

  // ---------- POST /v1/organisms/:slug/fork — create child ----------

  app.post(
    "/v1/organisms/:slug/fork",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;
      const { slug } = req.params as { slug: string };
      // Body is optional; the schema accepts an empty object.
      const body = (req.body ?? {}) as Record<string, unknown>;
      const parse = ForkSchema.safeParse(body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const input: ForkInput = parse.data;
      try {
        const child = await forkOrganism(userId, slug, input);
        return reply.code(201).send(serialize(child));
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  // =====================================================================
  // Task 4 — Memory + mutation routes
  // =====================================================================

  // ---------- POST /v1/organisms/:slug/memory — write memory ----------

  app.post(
    "/v1/organisms/:slug/memory",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;
      const { slug } = req.params as { slug: string };
      const parse = WriteMemorySchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const input: WriteMemoryInput = parse.data;
      try {
        const m = await writeMemory(userId, slug, input);
        // Audit log: every memory write is a notable event.
        await logActivity(getDb(), {
          action: "organism.memory_written",
          actorUserId: userId,
          targetType: "organism",
          targetId: m.organismId,
          metadata: { memoryId: m.id, kind: m.kind, hasSignature: typeof m.payload["signature"] === "string" },
        });
        return reply.code(201).send(serializeMemory(m));
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  // ---------- POST /v1/organisms/:slug/mutate — manual genome mutation ----------

  app.post(
    "/v1/organisms/:slug/mutate",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;
      const { slug } = req.params as { slug: string };
      const parse = MutateSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const input: MutateInput = parse.data;
      try {
        const o = await mutateOrganism(userId, slug, input);
        return reply.send(serialize(o));
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );
}
