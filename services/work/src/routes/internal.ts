/**
 * /v1/internal/work/* — internal token-guarded routes.
 *
 *   POST   /v1/internal/work/items                  — trusted service submits a work item
 *   GET    /v1/internal/work/items/:work_id         — trusted service polls status + result
 *   POST   /v1/internal/work/items/:work_id/assign  — manual assignment (testing)
 *
 * Per Phase 18 closeout (AGENTS.md): requires `Authorization:
 * Bearer <INTERNAL_TOKEN>` or `x-internal-token` header.
 *
 * Phase 29 — these endpoints are how services/ann's QubicOCExecutor
 * submits ANN execution workloads to the OC engine and polls for
 * the verified result. They mirror the public POST /v1/work/items
 * + GET /v1/work/items/:work_id pair but bypass the JWT requirement
 * (the ANN service is a trusted internal caller).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { isInternalAuthorized } from "../lib/internal.js";
import { manualAssign } from "../services/scheduler.js";
import { submitWorkItem, getWorkItemOrThrow, WorkItemNotFoundError } from "../services/items.js";
import { WorkIdSchema } from "../types/work-item.js";
import { WorkerIdSchema } from "../types/worker.js";
import { SubmitWorkItemSchema, type SubmitWorkItemInput } from "../types/work-item.js";
import { serializeWorkItem } from "./items.js";

export async function internalRoutes(app: FastifyInstance) {
  // Apply the internal-token guard as a preHandler to every
  // route in this scope.
  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isInternalAuthorized(req, reply)) return reply;
  });

  // ---------- Internal submit (Phase 29) ----------
  //
  // Accepts the standard SubmitWorkItemSchema; the `createdBy` field
  // is taken from a `X-Caller-User` header (defaults to "service:ann"
  // if absent). Returns the same shape as the public POST /v1/work/items.

  app.post("/v1/internal/work/items", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = SubmitWorkItemSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    }
    const headerCaller = req.headers["x-caller-user"];
    const createdBy =
      typeof headerCaller === "string" && headerCaller.length > 0 && headerCaller.length <= 120
        ? headerCaller
        : "service:ann";
    try {
      const item = await submitWorkItem(parse.data, { createdBy });
      return reply.code(201).send(serializeWorkItem(item));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Submit failed" } });
    }
  });

  // ---------- Internal get (Phase 29) ----------
  //
  // Returns the work item with the same shape as the public GET. The
  // `result` block is only present when the work item is `verified`.

  app.get("/v1/internal/work/items/:work_id", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { work_id: string };
    if (!WorkIdSchema.safeParse(params.work_id).success) {
      return reply.code(400).send({ error: { message: "Invalid work_id format" } });
    }
    try {
      const item = await getWorkItemOrThrow(params.work_id);
      return reply.send({
        ...serializeWorkItem(item),
        result:
          item.status === "verified" && item.resultPayloadHash
            ? {
                payload_hash: item.resultPayloadHash,
                completed_by: item.resultCompletedBy,
                completed_at: item.resultCompletedAt?.toISOString() ?? null,
                replicas_agreed: item.resultReplicasAgreed,
              }
            : null,
      });
    } catch (err) {
      if (err instanceof WorkItemNotFoundError) {
        return reply.code(404).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  // ---------- Manual assign (testing) ----------

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
