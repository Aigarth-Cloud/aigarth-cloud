/**
 * /v1/internal/tissue-usage — Phase 18E.
 *
 *   Internal-only endpoint for the tissue service to report a
 *   decision. Protected by a shared internal token (X-Internal-Token
 *   header). The tissue service is configured with the same value
 *   via env.
 *
 *   The endpoint is intentionally cheap (single insert) and
 *   best-effort: the tissue service does NOT block the /decide
 *   response on this call. Failures are logged but not surfaced.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { recordTissueUsage, TissueUsageEventSchema } from "../services/tissueUsage.js";
import { loadConfig } from "../config/index.js";

export async function tissueUsageRoutes(app: FastifyInstance) {
  app.post(
    "/v1/internal/tissue-usage",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const cfg = loadConfig();
      const provided = req.headers["x-internal-token"];
      if (!cfg.BILLING_INTERNAL_TOKEN) {
        return reply.code(503).send({ error: { message: "Internal token not configured" } });
      }
      if (provided !== cfg.BILLING_INTERNAL_TOKEN) {
        return reply.code(401).send({ error: { message: "Invalid internal token" } });
      }
      const parse = TissueUsageEventSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid tissue usage event", issues: parse.error.issues } });
      }
      try {
        await recordTissueUsage(parse.data);
        return reply.code(204).send();
      } catch (err) {
        req.log.error(
          { err, requestId: parse.data.requestId, tissueSlug: parse.data.tissueSlug },
          "tissue usage insert failed",
        );
        return reply.code(500).send({ error: { message: "Insert failed" } });
      }
    },
  );
}
