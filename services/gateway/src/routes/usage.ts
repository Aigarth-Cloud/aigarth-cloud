/**
 * /v1/usage — usage stats for the authenticated user.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getUserUsage, getRecentRequests } from "../services/usage.js";

export async function usageRoutes(app: FastifyInstance) {
  app.get(
    "/v1/usage",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { since?: string; until?: string };
      const since = q.since ? new Date(q.since) : undefined;
      const until = q.until ? new Date(q.until) : undefined;
      const agg = await getUserUsage(req.user.sub, { since, until });
      return reply.send({
        total_requests: agg.totalRequests,
        total_tokens: agg.totalTokens,
        prompt_tokens: agg.promptTokens,
        completion_tokens: agg.completionTokens,
        total_cost_qubic: agg.totalCostQubic.toString(),
        by_model: agg.byModel.map((m) => ({
          ...m,
          cost: m.cost.toString(),
        })),
        by_endpoint: agg.byEndpoint.map((e) => ({
          ...e,
          cost: e.cost.toString(),
        })),
      });
    },
  );

  app.get(
    "/v1/usage/recent",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { limit?: string };
      const limit = q.limit ? Number(q.limit) : 25;
      const recent = await getRecentRequests(req.user.sub, limit);
      return reply.send({
        data: recent.map((r) => ({
          id: r.id,
          model: r.model,
          endpoint: r.endpoint,
          status_code: r.statusCode,
          duration_ms: r.durationMs,
          prompt_tokens: r.promptTokens,
          completion_tokens: r.completionTokens,
          total_tokens: r.totalTokens,
          cost_qubic: r.costQubic.toString(),
          error_message: r.errorMessage,
          created_at: r.createdAt.toISOString(),
        })),
      });
    },
  );
}
