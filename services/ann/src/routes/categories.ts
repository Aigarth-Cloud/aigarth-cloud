/**
 * /v1/categories — public list of ANN categories.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listCategories } from "../services/categories.js";
import type { Category } from "../db/schema.js";

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/v1/categories", async (_req: FastifyRequest, reply: FastifyReply) => {
    const list = await listCategories();
    return reply.send({ data: list.map(serialize) });
  });
}

function serialize(c: Category) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    icon: c.icon,
    sort_order: c.sortOrder,
  };
}
