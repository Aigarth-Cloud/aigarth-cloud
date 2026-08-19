/**
 * /v1/models — list and read models.
 *
 * No auth required for reading the public model catalog (matches
 * OpenAI's /v1/models behavior). Write operations live elsewhere.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listModels, getModel } from "../services/models.js";

export async function modelRoutes(app: FastifyInstance) {
  app.get("/v1/models", async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { type?: string };
    const list = await listModels({ type: q.type, activeOnly: true });
    return reply.send({
      object: "list",
      data: list.map(serializeModel),
    });
  });

  app.get("/v1/models/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const m = await getModel((req.params as { id: string }).id);
    if (!m) return reply.code(404).send({ error: { message: "Model not found" } });
    return reply.send(serializeModel(m));
  });
}

function serializeModel(m: Awaited<ReturnType<typeof getModel>>) {
  if (!m) return null;
  return {
    id: m.id,
    object: "model",
    created: Math.floor(m.createdAt.getTime() / 1000),
    owned_by: m.ownedBy,
    type: m.type,
    family: m.family,
    name: m.name,
    description: m.description,
    context_window: m.contextWindow,
    max_output_tokens: m.maxOutputTokens,
    pricing: {
      input_cost_qubic_per_1k: m.inputCostQubic.toString(),
      output_cost_qubic_per_1k: m.outputCostQubic.toString(),
    },
    status: m.status,
  };
}
