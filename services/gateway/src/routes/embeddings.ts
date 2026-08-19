/**
 * /v1/embeddings — text embeddings.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getModel } from "../services/models.js";
import { logRequest } from "../services/usage.js";
import { checkAndIncrement, currentMinuteWindow } from "../services/rate-limit.js";
import { touchApiKey } from "../services/api-keys.js";
import { embedCost } from "../services/pricing.js";
import { estimateTokens } from "../lib/tokenizer.js";
import { stubEmbedding } from "../backends/stub.js";
import { authenticateRequest } from "../lib/auth.js";

const EmbeddingSchema = z.object({
  model: z.string().min(1).max(120),
  input: z.union([z.string().min(1).max(200_000), z.array(z.string().min(1).max(200_000)).min(1).max(2048)]),
  user: z.string().max(120).optional(),
  dimensions: z.number().int().min(1).max(4096).optional(),
  encoding_format: z.enum(["float", "base64"]).optional().default("float"),
});

export async function embeddingRoutes(app: FastifyInstance) {
  app.post("/v1/embeddings", async (req: FastifyRequest, reply: FastifyReply) => {
    const t0 = Date.now();
    const auth = await authenticateRequest(req);
    if (!auth) return reply.code(401).send({ error: { message: "Invalid or missing token" } });

    const parse = EmbeddingSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    }
    const input = parse.data;

    const model = await getModel(input.model);
    if (!model) {
      return reply.code(404).send({ error: { message: `Model '${input.model}' not found` } });
    }
    if (model.type !== "embedding") {
      return reply.code(400).send({ error: { message: `Model '${input.model}' is not an embedding model` } });
    }

    const inputs = Array.isArray(input.input) ? input.input : [input.input];
    const totalInputTokens = inputs.reduce((s, t) => s + estimateTokens(t), 0);

    if (auth.kind === "api_key") {
      const decision = await checkAndIncrement(auth.key.id, totalInputTokens);
      if (!decision.allowed) {
        return reply
          .code(429)
          .header("Retry-After", String(decision.retryAfterSec ?? 60))
          .send({ error: { message: "Rate limit exceeded.", type: "rate_limit_exceeded" } });
      }
    }

    const result = stubEmbedding({
      model: input.model,
      input: inputs,
      dimensions: input.dimensions,
    });
    const cost = embedCost(totalInputTokens);

    await logRequest({
      userId: auth.userId,
      orgId: auth.kind === "api_key" ? auth.key.orgId : null,
      apiKeyId: auth.kind === "api_key" ? auth.key.id : null,
      model: input.model,
      endpoint: "embeddings",
      statusCode: 200,
      durationMs: Date.now() - t0,
      promptTokens: totalInputTokens,
      completionTokens: 0,
      totalTokens: totalInputTokens,
      costQubic: cost,
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
      requestBody: input,
      responseBody: { ...result, data: result.data.map((d) => ({ ...d, embedding: `[${d.embedding.length} dims]` })) },
    });
    if (auth.kind === "api_key") await touchApiKey(auth.key.id);
    return reply.send(result);
  });
}
