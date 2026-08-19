/**
 * /v1/internal/work/* — internal token-guarded routes.
 *
 *   POST   /v1/internal/work/items/:work_id/assign   — manual assignment (testing)
 *
 * Per Phase 18 closeout (AGENTS.md): requires `Authorization:
 * Bearer <INTERNAL_TOKEN>` or `x-internal-token` header.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { isInternalAuthorized } from "../lib/internal.js";
import { manualAssign } from "../services/scheduler.js";
import { WorkIdSchema } from "../types/work-item.js";
import { WorkerIdSchema } from "../types/worker.js";

export async function internalRoutes(app: FastifyInstance) {
  // Apply the internal-token guard as a preHandler to every
  // route in this scope.
  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isInternalAuthorized(req, reply)) return reply;
  });

  app.post(
    "/v1/internal/work/items/:work_id/assign",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { work_id: string };
      if (!WorkIdSchema.safeParse(params.work_id).success) {
        return reply.code(400).send({ error: { message: "Invalid work_id" } });
      }
      const body = req.body as { worker_id?: string };
      if (!body?.worker_id) {
        return reply.code(400).send({ error: { message: "Missing worker_id in body" } });
      }
      if (!WorkerIdSchema.safeParse(body.worker_id).success) {
        return reply.code(400).send({ error: { message: "Invalid worker_id" } });
      }
      const result = await manualAssign(params.work_id, body.worker_id);
      if (!result) {
        return reply.code(404).send({
          error: { message: "Work item or worker not found, or work item not in 'queued' status" },
        });
      }
      return reply.send({
        work_id: result.item.workId,
        worker_id: result.worker.workerId,
        status: result.item.status,
      });
    },
  );
}
