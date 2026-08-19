/**
 * /v1/tissues/:idOrSlug/decide + /decisions — the runtime flow.
 *
 * Both authenticated. The /decide route forwards the user's JWT
 * to the ANN service (the same token works there because all
 * services share JWT_SECRET).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  decideTissue,
  listDecisions,
  DecideRequestSchema,
  ListDecisionsQuerySchema,
  AllMembersFailedError,
} from "../services/decisions.js";
import {
  TissueNotFoundError,
  TissueNotActiveError,
  TissueNoMembersError,
} from "../services/tissues.js";
import { extractJwt } from "../lib/auth.js";

export async function decisionRoutes(app: FastifyInstance) {
  app.post(
    "/v1/tissues/:idOrSlug/decide",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = DecideRequestSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const token = extractJwt(req);
      if (!token) {
        return reply.code(401).send({ error: { message: "Missing bearer token" } });
      }
      const params = req.params as { idOrSlug: string };
      const orgId = (req.user as { orgId?: string }).orgId ?? null;
      try {
        const result = await decideTissue(
          params.idOrSlug,
          req.user.sub,
          orgId,
          token,
          parse.data,
        );
        return reply.code(201).send({
          decision_id: result.decision_id,
          envelope: result.envelope,
          contributors: result.contributors,
          ignored: result.ignored,
          tissue: result.tissue,
          total_latency_ms: result.total_latency_ms,
          policy: result.policy,
        });
      } catch (err) {
        if (err instanceof TissueNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (
          err instanceof TissueNotActiveError ||
          err instanceof TissueNoMembersError
        ) {
          return reply.code(400).send({ error: { message: err.message } });
        }
        if (err instanceof AllMembersFailedError) {
          return reply.code(502).send({
            error: {
              message: err.message,
              ignored: err.ignored,
            },
          });
        }
        return reply
          .code(500)
          .send({ error: { message: err instanceof Error ? err.message : "Tissue decision failed" } });
      }
    },
  );

  app.get(
    "/v1/tissues/:idOrSlug/decisions",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ListDecisionsQuerySchema.safeParse(req.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
      }
      const params = req.params as { idOrSlug: string };
      try {
        const result = await listDecisions(params.idOrSlug, parse.data);
        return reply.send(result);
      } catch (err) {
        if (err instanceof TissueNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        return reply
          .code(500)
          .send({ error: { message: err instanceof Error ? err.message : "List decisions failed" } });
      }
    },
  );
}
