/**
 * /v1/internal/organism-usage — Wave 3 / Phase B (Task 5).
 *
 *   Internal-only endpoint for the marketplace service to report a
 *   per-Organism fork event. Protected by a shared internal token
 *   (X-Internal-Token header). The marketplace is configured with
 *   the same value via env.
 *
 *   Mirrors the tissueUsage pattern: the marketplace does NOT block
 *   the buyer's fork call on this endpoint. Failures are logged
 *   but not surfaced. The event log is the authoritative source
 *   for invoice math.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  recordOrganismUsage,
  OrganismUsageEventSchema,
} from "../services/organismUsage.js";
import { loadConfig } from "../config/index.js";

export async function organismUsageRoutes(app: FastifyInstance) {
  app.post(
    "/v1/internal/organism-usage",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const cfg = loadConfig();
      const provided = req.headers["x-internal-token"];
      if (!cfg.BILLING_INTERNAL_TOKEN) {
        return reply
          .code(503)
          .send({ error: { message: "Internal token not configured" } });
      }
      if (provided !== cfg.BILLING_INTERNAL_TOKEN) {
        return reply
          .code(401)
          .send({ error: { message: "Invalid internal token" } });
      }
      const parse = OrganismUsageEventSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({
            error: {
              message: "Invalid organism usage event",
              issues: parse.error.issues,
            },
          });
      }
      try {
        await recordOrganismUsage(parse.data);
        return reply.code(204).send();
      } catch (err) {
        req.log.error(
          {
            err,
            requestId: parse.data.requestId,
            organismSlug: parse.data.organismSlug,
          },
          "organism usage insert failed",
        );
        return reply.code(500).send({ error: { message: "Insert failed" } });
      }
    },
  );
}
