/**
 * /v1/work/items — work item CRUD (Task 7).
 *
 * Public (no auth):
 *   GET    /v1/work/items              — list (filter: status, type, payer, since)
 *   GET    /v1/work/items/:work_id     — read
 *
 * Authenticated (JWT):
 *   POST   /v1/work/items                          — submit
 *   POST   /v1/work/items/:work_id/cancel          — cancel a queued item (issuer only)
 *   POST   /v1/work/items/:work_id/dispute         — any party disputes
 *
 * Worker-facing (HMAC-signed worker manifest; the route checks
 * `claimed_by` matches the caller's workerId):
 *   POST   /v1/work/items/:work_id/result          — worker submits a result
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  submitWorkItem,
  listWorkItems,
  getWorkItemOrThrow,
  cancelWorkItem,
  disputeWorkItem,
  getWorkItemAuditTail,
  WorkItemNotFoundError,
  WorkItemNotCancellableError,
  WorkItemAlreadyVerifiedError,
} from "../services/items.js";
import { submitResult } from "../services/verifier.js";
import { billVerifiedWorkItem } from "../services/accountant.js";
import {
  SubmitWorkItemSchema,
  ListWorkItemsQuerySchema,
  SubmitWorkResultSchema,
  DisputeWorkItemSchema,
  WorkIdSchema,
} from "../types/work-item.js";

export async function itemRoutes(app: FastifyInstance) {
  // ---------- Public list ----------

  app.get("/v1/work/items", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListWorkItemsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const result = await listWorkItems(parse.data);
    return reply.send({
      data: result.data.map(serializeWorkItem),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // ---------- Public get ----------

  app.get("/v1/work/items/:work_id", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { work_id: string };
    if (!WorkIdSchema.safeParse(params.work_id).success) {
      return reply.code(400).send({ error: { message: "Invalid work_id format" } });
    }
    try {
      const item = await getWorkItemOrThrow(params.work_id);
      const audit = await getWorkItemAuditTail(params.work_id, 10);
      return reply.send({
        ...serializeWorkItem(item),
        audit_tail: audit,
      });
    } catch (err) {
      if (err instanceof WorkItemNotFoundError) {
        return reply.code(404).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  // ---------- Submit (authenticated) ----------

  app.post(
    "/v1/work/items",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = SubmitWorkItemSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const item = await submitWorkItem(parse.data, { createdBy: req.user.sub });
        return reply.code(201).send(serializeWorkItem(item));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Submit failed" } });
      }
    },
  );

  // ---------- Cancel (authenticated) ----------

  app.post(
    "/v1/work/items/:work_id/cancel",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { work_id: string };
      if (!WorkIdSchema.safeParse(params.work_id).success) {
        return reply.code(400).send({ error: { message: "Invalid work_id format" } });
      }
      try {
        const item = await cancelWorkItem(params.work_id, req.user.sub);
        return reply.send(serializeWorkItem(item));
      } catch (err) {
        if (err instanceof WorkItemNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (err instanceof WorkItemNotCancellableError) {
          return reply.code(409).send({ error: { message: err.message } });
        }
        throw err;
      }
    },
  );

  // ---------- Dispute (authenticated) ----------

  app.post(
    "/v1/work/items/:work_id/dispute",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { work_id: string };
      if (!WorkIdSchema.safeParse(params.work_id).success) {
        return reply.code(400).send({ error: { message: "Invalid work_id format" } });
      }
      const parse = DisputeWorkItemSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const item = await disputeWorkItem(params.work_id, req.user.sub, parse.data);
        return reply.send(serializeWorkItem(item));
      } catch (err) {
        if (err instanceof WorkItemNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (err instanceof WorkItemAlreadyVerifiedError) {
          return reply.code(409).send({ error: { message: err.message } });
        }
        throw err;
      }
    },
  );

  // ---------- Result submission (worker-facing) ----------
  //
  // Note: this route is NOT under the JWT authenticate preHandler
  // because workers carry an HMAC-signed manifest, not a user JWT.
  // The verifier (services/work/src/services/verifier.ts) checks
  // that the caller has a claimed work_results row for the given
  // work_id; that requires the worker_id to be in the body.
  // For v1 we accept the worker_id in the body (signed manifest
  // verification is Phase 27.A follow-up; ADR 006 §12 OQ 4).

  app.post(
    "/v1/work/items/:work_id/result",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { work_id: string };
      if (!WorkIdSchema.safeParse(params.work_id).success) {
        return reply.code(400).send({ error: { message: "Invalid work_id format" } });
      }
      const body = req.body as { worker_id?: string };
      if (!body?.worker_id) {
        return reply.code(400).send({ error: { message: "Missing worker_id in body" } });
      }
      const parse = SubmitWorkResultSchema.safeParse({
        payload_hash: (req.body as { payload_hash?: string }).payload_hash,
        signature: (req.body as { signature?: string }).signature,
      });
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const outcome = await submitResult(
        params.work_id,
        body.worker_id,
        parse.data.payload_hash,
        parse.data.signature,
      );
      if (!outcome) {
        // Either: no claim, or not enough submissions yet.
        return reply.code(409).send({
          error: {
            message:
              "Result not accepted: no matching claim, or insufficient submissions to verify.",
          },
        });
      }
      // If verified, fire the billing hook (best-effort, async).
      if (outcome.status === "verified") {
        // Don't await: billing is best-effort, never blocks the response.
        void billVerifiedWorkItem(params.work_id).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("[work] billing error:", err);
        });
      }
      return reply.send(outcome);
    },
  );
}

// ---------- Serialization ----------

/**
 * Exported so the internal route (`/v1/internal/work/items`) can
 * re-use the canonical wire shape. The function is the same one
 * the public GET/POST routes use.
 */
export function serializeWorkItem(item: {
  workId: string;
  type: string;
  specVersion: number;
  status: string;
  inputHash: string;
  inputUri: string;
  inputSizeBytes: bigint | number;
  algorithmName: string;
  algorithmVersion: string;
  algorithmContainer: string;
  algorithmDeterministic: boolean;
  reqCpuCores: number;
  reqMemoryGb: number;
  reqGpu: string;
  reqGpuKind: string;
  reqEstimatedRuntimeS: number;
  verificationMethod: string;
  replicas: number;
  challengeWorkId: string | null;
  rewardCurrency: string;
  rewardAmount: bigint | number;
  rewardPayer: string;
  resultPayloadHash: string | null;
  resultCompletedBy: string | null;
  resultCompletedAt: Date | null;
  resultReplicasAgreed: string | null;
  createdBy: string;
  settlementTx: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    work_id: item.workId,
    type: item.type,
    spec_version: item.specVersion,
    status: item.status,
    input: {
      payload_hash: item.inputHash,
      payload_uri: item.inputUri,
      payload_size_bytes:
        typeof item.inputSizeBytes === "bigint"
          ? item.inputSizeBytes.toString()
          : item.inputSizeBytes,
    },
    algorithm: {
      name: item.algorithmName,
      version: item.algorithmVersion,
      container: item.algorithmContainer,
      deterministic: item.algorithmDeterministic,
    },
    requirements: {
      cpu_cores: item.reqCpuCores,
      memory_gb: item.reqMemoryGb,
      gpu: item.reqGpu,
      gpu_kind: item.reqGpuKind,
      estimated_runtime_s: item.reqEstimatedRuntimeS,
    },
    verification: {
      method: item.verificationMethod,
      replicas: item.replicas,
      challenge_work_id: item.challengeWorkId,
    },
    reward: {
      currency: item.rewardCurrency,
      amount:
        typeof item.rewardAmount === "bigint"
          ? item.rewardAmount.toString()
          : item.rewardAmount,
      payer: item.rewardPayer,
    },
    result: {
      payload_hash: item.resultPayloadHash,
      completed_by: item.resultCompletedBy,
      completed_at: item.resultCompletedAt?.toISOString() ?? null,
      replicas_agreed: item.resultReplicasAgreed,
    },
    audit: {
      created_by: item.createdBy,
      settlement_tx: item.settlementTx,
    },
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  };
}
