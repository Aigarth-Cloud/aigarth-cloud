/**
 * /v1/marketplace/organism-listings — organism listings (Phase 26.C).
 *
 *   Public:
 *     GET    /v1/marketplace/organism-listings                 — list / search
 *     GET    /v1/marketplace/organism-listings/:idOrSlug       — details
 *     GET    /v1/marketplace/organism-listings/:id/analytics   — roll-up
 *
 *   Authenticated:
 *     POST   /v1/marketplace/organism-listings                 — create draft
 *     PATCH  /v1/marketplace/organism-listings/:id             — update
 *     POST   /v1/marketplace/organism-listings/:id/close       — close
 *     DELETE /v1/marketplace/organism-listings/:id             — alias for close
 *                                                              (v0.2 §33 Task 5
 *                                                               contract)
 *
 *   Internal (service-to-service):
 *     POST   /v1/marketplace/organism-listings/:id/forks       — increment
 *                                                              fork counter
 *                                                              (called by
 *                                                               billing hook
 *                                                               or ann service
 *                                                               on /fork)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createOrganismListing,
  updateOrganismListing,
  closeOrganismListing,
  getOrganismListing,
  listOrganismListings,
  getOrganismListingAnalytics,
  recordOrganismFork,
  CreateOrganismListingSchema,
  UpdateOrganismListingSchema,
  ListOrganismListingsQuerySchema,
} from "../services/organismListings.js";
import { serializeOrganismListing } from "../lib/serialize.js";
import { z } from "zod";
import { loadConfig } from "../config/index.js";

export async function organismListingRoutes(app: FastifyInstance) {
  // ---------- Public list + search ----------

  app.get(
    "/v1/marketplace/organism-listings",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ListOrganismListingsQuerySchema.safeParse(req.query);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid query", issues: parse.error.issues } });
      }
      const result = await listOrganismListings(parse.data);
      return reply.send({
        data: result.data.map(serializeOrganismListing),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  );

  // ---------- Public details ----------

  app.get(
    "/v1/marketplace/organism-listings/:idOrSlug",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const l = await getOrganismListing(
        (req.params as { idOrSlug: string }).idOrSlug,
      );
      if (!l)
        return reply
          .code(404)
          .send({ error: { message: "Organism listing not found" } });
      return reply.send(serializeOrganismListing(l));
    },
  );

  // ---------- Public analytics roll-up ----------

  app.get(
    "/v1/marketplace/organism-listings/:id/analytics",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const a = await getOrganismListingAnalytics(
        (req.params as { id: string }).id,
      );
      if (!a)
        return reply
          .code(404)
          .send({ error: { message: "Organism listing not found" } });
      return reply.send({
        listing_id: a.listingId,
        total_forks: a.totalForks.toString(),
        total_revenue_qubic: a.totalRevenueQubic.toString(),
        lineage_size: a.lineageSize,
        fitness_max: a.fitnessMax,
      });
    },
  );

  // ---------- Authenticated CRUD ----------

  app.post(
    "/v1/marketplace/organism-listings",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateOrganismListingSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const l = await createOrganismListing(req.user.sub, parse.data);
        return reply.code(201).send(serializeOrganismListing(l));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
      }
    },
  );

  app.patch(
    "/v1/marketplace/organism-listings/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = UpdateOrganismListingSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const l = await updateOrganismListing(
          req.user.sub,
          (req.params as { id: string }).id,
          parse.data,
        );
        if (!l)
          return reply
            .code(404)
            .send({ error: { message: "Organism listing not found" } });
        return reply.send(serializeOrganismListing(l));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Update failed" } });
      }
    },
  );

  app.post(
    "/v1/marketplace/organism-listings/:id/close",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const l = await closeOrganismListing(
          req.user.sub,
          (req.params as { id: string }).id,
        );
        if (!l)
          return reply
            .code(404)
            .send({ error: { message: "Organism listing not found" } });
        return reply.send(serializeOrganismListing(l));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Close failed" } });
      }
    },
  );

  // DELETE is the v0.2 §33 Task 5 contract entry point for
  // "unpublish" / "remove a listing". The marketplace soft-closes
  // (status → closed) rather than hard-deletes; the row stays in
  // the table for billing audit.
  app.delete(
    "/v1/marketplace/organism-listings/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const l = await closeOrganismListing(
          req.user.sub,
          (req.params as { id: string }).id,
        );
        if (!l)
          return reply
            .code(404)
            .send({ error: { message: "Organism listing not found" } });
        return reply.send(serializeOrganismListing(l));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Delete failed" } });
      }
    },
  );

  // ---------- Internal: increment fork counter ----------
  //
  // Protected by a shared internal token (X-Internal-Token header).
  // The billing service (or the ann service's /fork caller) is
  // configured with the same value via env.

  const InternalForkBodySchema = z.object({
    revenue_qubic: z.string().regex(/^\d+$/),
  });

  app.post(
    "/v1/marketplace/organism-listings/:id/forks",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const cfg = loadConfig();
      const provided = req.headers["x-internal-token"];
      if (!cfg.MARKETPLACE_INTERNAL_TOKEN) {
        return reply
          .code(503)
          .send({ error: { message: "Internal token not configured" } });
      }
      if (provided !== cfg.MARKETPLACE_INTERNAL_TOKEN) {
        return reply
          .code(401)
          .send({ error: { message: "Invalid internal token" } });
      }
      const parse = InternalForkBodySchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid body", issues: parse.error.issues } });
      }
      try {
        await recordOrganismFork(
          (req.params as { id: string }).id,
          BigInt(parse.data.revenue_qubic),
        );
        return reply.code(204).send();
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Record failed" } });
      }
    },
  );
}
