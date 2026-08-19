/**
 * /v1/me — caller-scoped endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listListings } from "../services/listings.js";
import { listMyOffers } from "../services/offers.js";
import { listAuctions } from "../services/auctions.js";
import { listMyBids } from "../services/bids.js";
import { serializeListing, serializeOffer, serializeAuction, serializeBid } from "../lib/serialize.js";

export async function meRoutes(app: FastifyInstance) {
  // Listings I created
  app.get(
    "/v1/me/listings",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const result = await listListings({
        q: undefined,
        kind: undefined,
        status: "active" as any,
        visibility: undefined,
        seller: req.user.sub,
        regionId: undefined,
        clusterId: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        sort: "newest",
        limit: 50,
        offset: 0,
      });
      return reply.send({
        data: result.data.map(serializeListing),
        total: result.total,
      });
    },
  );

  // Offers I've placed
  app.get(
    "/v1/me/offers",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const offers = await listMyOffers(req.user.sub);
      return reply.send({ data: offers.map(serializeOffer) });
    },
  );

  // Auctions I created
  app.get(
    "/v1/me/auctions",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const auctions = await listAuctions({ seller: req.user.sub, limit: 50, includeAllStatuses: true });
      return reply.send({ data: auctions.map(serializeAuction) });
    },
  );

  // Bids I've placed
  app.get(
    "/v1/me/bids",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const bids = await listMyBids(req.user.sub);
      return reply.send({ data: bids.map(serializeBid) });
    },
  );
}
