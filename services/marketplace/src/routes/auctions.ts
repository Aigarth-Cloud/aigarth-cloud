/**
 * /v1/auctions — capacity auctions (Dutch / English / sealed-bid).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createAuction,
  getAuction,
  listAuctions,
  refreshDutchPrice,
  settleAuction,
  CreateAuctionSchema,
} from "../services/auctions.js";
import { placeBid, listBids, PlaceBidSchema } from "../services/bids.js";
import { serializeAuction, serializeBid } from "../lib/serialize.js";

export async function auctionRoutes(app: FastifyInstance) {
  // Public
  app.get("/v1/auctions", async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { kind?: "dutch" | "english" | "sealed_bid"; status?: string; seller?: string };
    const list = await listAuctions({
      kind: q.kind,
      status: q.status as any,
      seller: q.seller,
    });
    return reply.send({ data: list.map(serializeAuction) });
  });

  app.get("/v1/auctions/:idOrSlug", async (req: FastifyRequest, reply: FastifyReply) => {
    const a = await getAuction((req.params as { idOrSlug: string }).idOrSlug);
    if (!a) return reply.code(404).send({ error: { message: "Auction not found" } });
    // Refresh Dutch price + settle if ended
    let refreshed = a;
    if (a.kind === "dutch") {
      refreshed = (await refreshDutchPrice(a.id)) ?? a;
    }
    if (refreshed.status === "ended" || refreshed.status === "live") {
      refreshed = (await settleAuction(refreshed.id)) ?? refreshed;
    }
    return reply.send(serializeAuction(refreshed));
  });

  app.get("/v1/auctions/:idOrSlug/bids", async (req: FastifyRequest, reply: FastifyReply) => {
    const a = await getAuction((req.params as { idOrSlug: string }).idOrSlug);
    if (!a) return reply.code(404).send({ error: { message: "Auction not found" } });
    const bids = await listBids(a.id);
    return reply.send({ data: bids.map(serializeBid) });
  });

  // Authenticated
  app.post("/v1/auctions", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = CreateAuctionSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    try {
      const a = await createAuction(req.user.sub, parse.data);
      return reply.code(201).send(serializeAuction(a));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
    }
  });

  app.post(
    "/v1/auctions/:id/bid",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = PlaceBidSchema.safeParse(req.body);
      if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
      try {
        const b = await placeBid(req.user.sub, (req.params as { id: string }).id, parse.data);
        return reply.code(201).send(serializeBid(b));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Bid failed" } });
      }
    },
  );
}
