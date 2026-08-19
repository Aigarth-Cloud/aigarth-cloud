/**
 * /v1/tissue-listings — tissue decision listings (Phase 18E).
 *
 *   Public:
 *     GET    /v1/tissue-listings               — list / search
 *     GET    /v1/tissue-listings/:idOrSlug     — details
 *
 *   Authenticated:
 *     POST   /v1/tissue-listings               — create draft
 *     PATCH  /v1/tissue-listings/:id           — update
 *     POST   /v1/tissue-listings/:id/close     — close
 *
 *   Internal (service-to-service):
 *     POST   /v1/tissue-listings/:id/decisions  — increment
 *                                                  decision counter
 *                                                  (called by tissue
 *                                                   service on /decide)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createTissueListing,
  updateTissueListing,
  closeTissueListing,
  getTissueListing,
  listTissueListings,
  recordTissueDecision,
  CreateTissueListingSchema,
  UpdateTissueListingSchema,
  ListTissueListingsQuerySchema,
} from "../services/tissueListings.js";
import { serializeTissueListing } from "../lib/serialize.js";
import { z } from "zod";
import { loadConfig } from "../config/index.js";

export async function tissueListingRoutes(app: FastifyInstance) {
  // ---------- Public list + search ----------

  app.get("/v1/tissue-listings", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListTissueListingsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const result = await listTissueListings(parse.data);
    return reply.send({
      data: result.data.map(serializeTissueListing),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // ---------- Public details ----------

  app.get("/v1/tissue-listings/:idOrSlug", async (req: FastifyRequest, reply: FastifyReply) => {
    const l = await getTissueListing((req.params as { idOrSlug: string }).idOrSlug);
    if (!l) return reply.code(404).send({ error: { message: "Tissue listing not found" } });
    return reply.send(serializeTissueListing(l));
  });

  // ---------- Authenticated CRUD ----------

  app.post(
    "/v1/tissue-listings",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateTissueListingSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const l = await createTissueListing(req.user.sub, parse.data);
        return reply.code(201).send(serializeTissueListing(l));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
      }
    },
  );

  app.patch(
    "/v1/tissue-listings/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = UpdateTissueListingSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const l = await updateTissueListing(req.user.sub, (req.params as { id: string }).id, parse.data);
        if (!l) return reply.code(404).send({ error: { message: "Tissue listing not found" } });
        return reply.send(serializeTissueListing(l));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Update failed" } });
      }
    },
  );

  app.post(
    "/v1/tissue-listings/:id/close",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const l = await closeTissueListing(req.user.sub, (req.params as { id: string }).id);
        if (!l) return reply.code(404).send({ error: { message: "Tissue listing not found" } });
        return reply.send(serializeTissueListing(l));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Close failed" } });
      }
    },
  );

  // ---------- Internal: increment decision counter ----------
  //
  // Protected by a shared internal token (X-Internal-Token header).
  // The tissue service is configured with the same value via env.

  const InternalDecisionBodySchema = z.object({
    revenue_qubic: z.string().regex(/^\d+$/),
  });

  app.post(
    "/v1/tissue-listings/:id/decisions",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const cfg = loadConfig();
      const provided = req.headers["x-internal-token"];
      if (!cfg.MARKETPLACE_INTERNAL_TOKEN) {
        return reply.code(503).send({ error: { message: "Internal token not configured" } });
      }
      if (provided !== cfg.MARKETPLACE_INTERNAL_TOKEN) {
        return reply.code(401).send({ error: { message: "Invalid internal token" } });
      }
      const parse = InternalDecisionBodySchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid body", issues: parse.error.issues } });
      }
      try {
        await recordTissueDecision(
          (req.params as { id: string }).id,
          BigInt(parse.data.revenue_qubic),
        );
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Record failed" } });
      }
    },
  );
}
