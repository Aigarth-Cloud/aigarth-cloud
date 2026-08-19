/**
 * /v1/offers — buyer offers on listings.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  placeOffer,
  acceptOffer,
  rejectOffer,
  cancelOffer,
  listOffers,
  CreateOfferSchema,
} from "../services/offers.js";
import { serializeOffer } from "../lib/serialize.js";
import { getListing } from "../services/listings.js";
import { serializeListing } from "../lib/serialize.js";

export async function offerRoutes(app: FastifyInstance) {
  // Public: list offers for a listing
  app.get("/v1/listings/:idOrSlug/offers", async (req: FastifyRequest, reply: FastifyReply) => {
    const l = await getListing((req.params as { idOrSlug: string }).idOrSlug);
    if (!l) return reply.code(404).send({ error: { message: "Listing not found" } });
    const offers = await listOffers(l.id);
    return reply.send({ data: offers.map(serializeOffer) });
  });

  // Authenticated
  app.post("/v1/offers", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = CreateOfferSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
    try {
      const o = await placeOffer(req.user.sub, parse.data);
      return reply.code(201).send(serializeOffer(o));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Place offer failed" } });
    }
  });

  app.post("/v1/offers/:id/accept", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const o = await acceptOffer(req.user.sub, (req.params as { id: string }).id);
      if (!o) return reply.code(404).send({ error: { message: "Offer not found" } });
      return reply.send(serializeOffer(o));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Accept failed" } });
    }
  });

  app.post("/v1/offers/:id/reject", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as { reason?: string };
    try {
      const o = await rejectOffer(req.user.sub, (req.params as { id: string }).id, body.reason);
      if (!o) return reply.code(404).send({ error: { message: "Offer not found" } });
      return reply.send(serializeOffer(o));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Reject failed" } });
    }
  });

  app.post("/v1/offers/:id/cancel", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const o = await cancelOffer(req.user.sub, (req.params as { id: string }).id);
      if (!o) return reply.code(404).send({ error: { message: "Offer not found" } });
      return reply.send(serializeOffer(o));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Cancel failed" } });
    }
  });
}
