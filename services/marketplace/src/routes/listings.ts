/**
 * /v1/listings — compute capacity listings.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createListing,
  updateListing,
  closeListing,
  getListing,
  listListings,
  CreateListingSchema,
  UpdateListingSchema,
  ListQuerySchema,
  type Listing,
} from "../services/listings.js";
import { serializeListing } from "../lib/serialize.js";

export async function listingRoutes(app: FastifyInstance) {
  // Public
  app.get("/v1/listings", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListQuerySchema.safeParse(req.query);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid query" } });
    const result = await listListings(parse.data);
    return reply.send({
      data: result.data.map(serializeListing),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.get("/v1/listings/:idOrSlug", async (req: FastifyRequest, reply: FastifyReply) => {
    const l = await getListing((req.params as { idOrSlug: string }).idOrSlug);
    if (!l) return reply.code(404).send({ error: { message: "Listing not found" } });
    return reply.send(serializeListing(l));
  });

  // Authenticated
  app.post("/v1/listings", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = CreateListingSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    try {
      const l = await createListing(req.user.sub, parse.data);
      return reply.code(201).send(serializeListing(l));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
    }
  });

  app.patch("/v1/listings/:id", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = UpdateListingSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
    try {
      const l = await updateListing(req.user.sub, (req.params as { id: string }).id, parse.data);
      if (!l) return reply.code(404).send({ error: { message: "Listing not found" } });
      return reply.send(serializeListing(l));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Update failed" } });
    }
  });

  app.post("/v1/listings/:id/close", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const l = await closeListing(req.user.sub, (req.params as { id: string }).id);
      if (!l) return reply.code(404).send({ error: { message: "Listing not found" } });
      return reply.send(serializeListing(l));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Close failed" } });
    }
  });
}
