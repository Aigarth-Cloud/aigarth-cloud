/**
 * /v1/training/recipes — recipe catalog (Phase 19C.2).
 *
 * Public routes — no auth. The catalog is a small, closed set
 * of built-in kinds; v2 may add user-authored recipes behind
 * auth.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listRecipes, getRecipe } from "../services/recipes.js";
import { serializeRecipe } from "../lib/serialize.js";
import { TrainingNotFoundError } from "../lib/errors.js";

export async function recipeRoutes(app: FastifyInstance) {
  app.get("/v1/training/recipes", async (_req: FastifyRequest, reply: FastifyReply) => {
    const rows = await listRecipes();
    return reply.send({
      data: rows.map(serializeRecipe),
      total: rows.length,
    });
  });

  app.get("/v1/training/recipes/:slug", async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    try {
      const row = await getRecipe(slug);
      return reply.send(serializeRecipe(row));
    } catch (e) {
      if (e instanceof TrainingNotFoundError) {
        return reply.code(404).send({ error: { message: e.message } });
      }
      throw e;
    }
  });
}
