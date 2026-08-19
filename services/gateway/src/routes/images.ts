/**
 * /v1/images/generations — image generation.
 *
 * Stub: returns placeholder URLs. Real impl: DALL-E, Stable Diffusion,
 * or a local model.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getModel } from "../services/models.js";
import { logRequest } from "../services/usage.js";
import { checkAndIncrement } from "../services/rate-limit.js";
import { touchApiKey } from "../services/api-keys.js";
import { imageCost } from "../services/pricing.js";
import { stubImageGeneration } from "../backends/stub.js";
import { authenticateRequest } from "../lib/auth.js";

const ImageGenSchema = z.object({
  model: z.string().min(1).max(120).default("aigarth-image-1"),
  prompt: z.string().min(1).max(4000),
  n: z.number().int().min(1).max(10).optional().default(1),
  size: z.enum(["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"]).optional().default("1024x1024"),
  response_format: z.enum(["url", "b64_json"]).optional().default("url"),
  user: z.string().max(120).optional(),
});

export async function imageRoutes(app: FastifyInstance) {
  app.post("/v1/images/generations", async (req: FastifyRequest, reply: FastifyReply) => {
    const t0 = Date.now();
    const auth = await authenticateRequest(req);
    if (!auth) return reply.code(401).send({ error: { message: "Invalid or missing token" } });

    const parse = ImageGenSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    }
    const input = parse.data;

    const model = await getModel(input.model);
    if (!model) {
      return reply.code(404).send({ error: { message: `Model '${input.model}' not found` } });
    }
    if (model.type !== "image") {
      return reply.code(400).send({ error: { message: `Model '${input.model}' is not an image model` } });
    }

    if (auth.kind === "api_key") {
      const decision = await checkAndIncrement(auth.key.id, input.n);
      if (!decision.allowed) {
        return reply
          .code(429)
          .header("Retry-After", String(decision.retryAfterSec ?? 60))
          .send({ error: { message: "Rate limit exceeded.", type: "rate_limit_exceeded" } });
      }
    }

    const result = stubImageGeneration({
      model: input.model,
      prompt: input.prompt,
      n: input.n,
      size: input.size,
    });
    const cost = imageCost(input.n);

    await logRequest({
      userId: auth.userId,
      orgId: auth.kind === "api_key" ? auth.key.orgId : null,
      apiKeyId: auth.kind === "api_key" ? auth.key.id : null,
      model: input.model,
      endpoint: "images.generations",
      statusCode: 200,
      durationMs: Date.now() - t0,
      promptTokens: 0,
      completionTokens: input.n,
      totalTokens: input.n,
      costQubic: cost,
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
      requestBody: input,
      responseBody: { ...result, data: result.data.map((d) => ({ url: d.url })) },
    });
    if (auth.kind === "api_key") await touchApiKey(auth.key.id);
    return reply.send(result);
  });
}
