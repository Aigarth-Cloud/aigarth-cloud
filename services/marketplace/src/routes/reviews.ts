/**
 * /v1/reviews — peer reviews.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { addReview, listReviews, AddReviewSchema } from "../services/reviews.js";
import { serializeReview } from "../lib/serialize.js";

export async function reviewRoutes(app: FastifyInstance) {
  // Public: list reviews for a target
  app.get("/v1/reviews", async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { targetType?: "listing" | "auction" | "user"; targetId?: string };
    if (!q.targetType || !q.targetId) {
      return reply.code(400).send({ error: { message: "targetType and targetId are required" } });
    }
    const reviews = await listReviews(q.targetType, q.targetId);
    return reply.send({ data: reviews.map(serializeReview) });
  });

  // Authenticated
  app.post(
    "/v1/reviews",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { targetType?: "listing" | "auction" | "user"; targetId?: string; rating?: number; review?: string };
      if (!body.targetType || !body.targetId) {
        return reply.code(400).send({ error: { message: "targetType and targetId are required" } });
      }
      const parse = AddReviewSchema.safeParse({ rating: body.rating, review: body.review });
      if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
      try {
        const r = await addReview(req.user.sub, body.targetType, body.targetId, parse.data);
        return reply.code(201).send(serializeReview(r));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Add review failed" } });
      }
    },
  );
}
