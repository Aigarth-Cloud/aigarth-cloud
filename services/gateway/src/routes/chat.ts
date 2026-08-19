/**
 * /v1/chat/completions — OpenAI-compatible chat completions.
 *
 * Supports both sync (returns a single JSON object) and streaming
 * (returns SSE chunks). Auth is Bearer JWT OR Bearer API key.
 *
 * Phase 18C: When the request sets `intent: "trinary"`, the
 * gateway routes to the ANN service's `/v1/anns/:model/decide`
 * endpoint and frames the resulting IntentEnvelope as an
 * OpenAI-shaped chat completion. The OpenAI surface stays
 * default; trinary is opt-in.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getModel } from "../services/models.js";
import { logRequest, getUserUsage } from "../services/usage.js";
import { checkAndIncrement } from "../services/rate-limit.js";
import { touchApiKey, type GatewayApiKey } from "../services/api-keys.js";
import { chatCost, trinaryDecisionCost } from "../services/pricing.js";
import { estimateMessagesTokens, estimateTokens } from "../lib/tokenizer.js";
import { stubChatCompletion, stubChatStream } from "../backends/stub.js";
import { authenticateRequest } from "../lib/auth.js";
import {
  callAnnDecide,
  frameAsChatCompletion,
  frameAsChatCompletionChunk,
  buildAnnInput,
  AnnServiceError,
} from "../services/trinary.js";

const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "function"]),
  content: z.string().min(1).max(200_000),
  name: z.string().optional(),
});

const ChatCompletionSchema = z.object({
  model: z.string().min(1).max(120),
  messages: z.array(ChatMessageSchema).min(1).max(200),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().min(1).max(8).optional(),
  stream: z.boolean().optional().default(false),
  stop: z.union([z.string(), z.array(z.string()).max(4)]).optional(),
  max_tokens: z.number().int().min(1).max(100_000).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  user: z.string().max(120).optional(),
  seed: z.number().int().optional(),
  // Aigarth extensions
  qubic_paid: z.boolean().optional(),
  preferred_ann: z.string().optional(),
  regions: z.array(z.string()).optional(),
  /**
   * Phase 18C — Aigarth extension. When set to "trinary", the
   * gateway forwards the request to the ANN service's /decide
   * endpoint and frames the resulting IntentEnvelope as a
   * chat completion. When "openai" (default), the request
   * goes through the existing OpenAI stub (or real LLM in
   * production). Distinct from OpenAI's `response_format`.
   */
  intent: z.enum(["openai", "trinary"]).default("openai"),
});

/** Extract the Bearer token from the Authorization header, if present. */
function bearerToken(req: FastifyRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function chatRoutes(app: FastifyInstance) {
  app.post("/v1/chat/completions", async (req: FastifyRequest, reply: FastifyReply) => {
    const t0 = Date.now();
    // Auth: JWT or API key
    const auth = await authenticateRequest(req);
    if (!auth) {
      return reply.code(401).send({ error: { message: "Invalid or missing token" } });
    }

    const parse = ChatCompletionSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    }
    const input = parse.data;

    const model = await getModel(input.model);
    if (!model) {
      return reply.code(404).send({ error: { message: `Model '${input.model}' not found` } });
    }
    if (model.status !== "active") {
      return reply.code(400).send({ error: { message: `Model '${input.model}' is not currently available` } });
    }

    // Estimate tokens
    const promptTokens = estimateMessagesTokens(input.messages);

    // Rate limit check (per API key; for JWT users, use a synthetic key id)
    const rateKeyId = auth.kind === "api_key" ? auth.key.id : `jwt:${auth.userId}`;
    if (auth.kind === "api_key") {
      const decision = await checkAndIncrement(auth.key.id, promptTokens);
      if (!decision.allowed) {
        return reply
          .code(429)
          .header("Retry-After", String(decision.retryAfterSec ?? 60))
          .send({
            error: {
              message: "Rate limit exceeded.",
              type: "rate_limit_exceeded",
              rpm: decision.rpm,
              tpm: decision.tpm,
            },
          });
      }
    }

    // ---------- Phase 18C — trinary path ----------
    if (input.intent === "trinary") {
      const token = bearerToken(req);
      if (!token) {
        return reply.code(401).send({ error: { message: "Missing bearer token" } });
      }

      const annBody = buildAnnInput(
        input.messages as Array<{ role: string; content: string }>,
        {
          temperature: input.temperature,
          top_p: input.top_p,
          n: input.n,
          user: input.user,
        },
      );

      let annResult;
      try {
        annResult = await callAnnDecide(input.model, token, annBody);
      } catch (err) {
        if (err instanceof AnnServiceError) {
          // Pass through the ANN service's status code + body.
          const status = err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 502;
          await logRequest({
            userId: auth.userId,
            orgId: auth.kind === "api_key" ? auth.key.orgId : null,
            apiKeyId: auth.kind === "api_key" ? auth.key.id : null,
            model: input.model,
            endpoint: "chat.completions",
            statusCode: status,
            durationMs: Date.now() - t0,
            promptTokens,
            completionTokens: 0,
            totalTokens: promptTokens,
            costQubic: 0n,
            ip: req.ip,
            userAgent: req.headers["user-agent"] ?? null,
            requestBody: { ...input, stream: input.stream },
            errorMessage: err.message,
          });
          return reply.code(status).send({
            error: { message: err.message, ann_service_path: err.annServicePath },
          });
        }
        return reply.code(500).send({
          error: { message: err instanceof Error ? err.message : "Trinary decision failed" },
        });
      }

      const cost = trinaryDecisionCost();

      if (input.stream) {
        // ---------- Trinary streaming: 1 delta + 1 done ----------
        reply.raw.setHeader("Content-Type", "text/event-stream");
        reply.raw.setHeader("Cache-Control", "no-cache");
        reply.raw.setHeader("Connection", "keep-alive");
        reply.raw.setHeader("X-Accel-Buffering", "no");
        reply.hijack();

        try {
          const frames = frameAsChatCompletionChunk(
            annResult.envelope,
            annResult.decision_id,
            input.model,
            annBody.request_id,
          );
          reply.raw.write(`data: ${JSON.stringify(frames.first)}\n\n`);
          reply.raw.write(`data: ${JSON.stringify(frames.done)}\n\n`);
          reply.raw.write(`data: [DONE]\n\n`);
          reply.raw.end();
        } catch (err) {
          reply.raw.write(
            `data: ${JSON.stringify({ error: { message: err instanceof Error ? err.message : "Stream failed" } })}\n\n`,
          );
          reply.raw.end();
        }

        await logRequest({
          userId: auth.userId,
          orgId: auth.kind === "api_key" ? auth.key.orgId : null,
          apiKeyId: auth.kind === "api_key" ? auth.key.id : null,
          model: input.model,
          endpoint: "chat.completions",
          statusCode: 200,
          durationMs: Date.now() - t0,
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2,
          costQubic: cost,
          ip: req.ip,
          userAgent: req.headers["user-agent"] ?? null,
          requestBody: { ...input, stream: true },
          responseBody: { decision_id: annResult.decision_id, envelope: annResult.envelope },
        });
        if (auth.kind === "api_key") await touchApiKey(auth.key.id);
        return;
      }

      // ---------- Trinary sync ----------
      const completion = frameAsChatCompletion(
        annResult.envelope,
        annResult.decision_id,
        input.model,
        annBody.request_id,
      );

      await logRequest({
        userId: auth.userId,
        orgId: auth.kind === "api_key" ? auth.key.orgId : null,
        apiKeyId: auth.kind === "api_key" ? auth.key.id : null,
        model: input.model,
        endpoint: "chat.completions",
        statusCode: 200,
        durationMs: Date.now() - t0,
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        costQubic: cost,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null,
        requestBody: input,
        responseBody: completion,
      });
      if (auth.kind === "api_key") await touchApiKey(auth.key.id);
      return reply.send(completion);
    }

    // ---------- OpenAI path (default) ----------
    if (input.stream) {
      // SSE stream
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      reply.hijack();

      const stream = stubChatStream({
        model: input.model,
        messages: input.messages as Array<{ role: string; content: string }>,
      });

      let completionText = "";
      try {
        for await (const chunk of stream) {
          // Capture the text for usage tracking
          for (const choice of chunk.choices) {
            if (choice.delta.content) completionText += choice.delta.content;
          }
          reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        reply.raw.write(`data: [DONE]\n\n`);
        reply.raw.end();
      } catch (err) {
        reply.raw.write(
          `data: ${JSON.stringify({ error: { message: err instanceof Error ? err.message : "Stream failed" } })}\n\n`,
        );
        reply.raw.end();
      }

      const completionTokens = estimateTokens(completionText);
      const cost = chatCost(model, promptTokens, completionTokens);

      await logRequest({
        userId: auth.userId,
        orgId: auth.kind === "api_key" ? auth.key.orgId : null,
        apiKeyId: auth.kind === "api_key" ? auth.key.id : null,
        model: input.model,
        endpoint: "chat.completions",
        statusCode: 200,
        durationMs: Date.now() - t0,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        costQubic: cost,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null,
        requestBody: { ...input, stream: true },
      });
      if (auth.kind === "api_key") await touchApiKey(auth.key.id);
      return;
    }

    // Sync
    const completion = stubChatCompletion({
      model: input.model,
      messages: input.messages as Array<{ role: string; content: string }>,
      n: input.n,
      maxTokens: input.max_tokens,
    });
    const cost = chatCost(model, promptTokens, completion.usage.completion_tokens);

    await logRequest({
      userId: auth.userId,
      orgId: auth.kind === "api_key" ? auth.key.orgId : null,
      apiKeyId: auth.kind === "api_key" ? auth.key.id : null,
      model: input.model,
      endpoint: "chat.completions",
      statusCode: 200,
      durationMs: Date.now() - t0,
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens,
      costQubic: cost,
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
      requestBody: input,
      responseBody: completion,
    });
    if (auth.kind === "api_key") await touchApiKey(auth.key.id);
    return reply.send(completion);
  });
}
