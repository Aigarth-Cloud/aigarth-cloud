/**
 * /v1/work/workers — worker registry (Task 7).
 *
 *   POST   /v1/work/workers                          — register
 *   GET    /v1/work/workers                          — list
 *   GET    /v1/work/workers/:worker_id               — read (TODO)
 *   POST   /v1/work/workers/:worker_id/heartbeat     — heartbeat
 *   GET    /v1/work/workers/:worker_id/jobs          — list claimed work items
 *   POST   /v1/work/workers/:worker_id/results       — batch result submission
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  registerWorker,
  listWorkers,
  heartbeat,
  getWorker,
  listWorkerJobs,
  WorkerNotFoundError,
  WorkerSuspendedError,
} from "../services/workers.js";
import {
  RegisterWorkerSchema,
  ListWorkersQuerySchema,
  BatchSubmitResultSchema,
  WorkerIdParamSchema,
} from "../types/worker.js";

export async function workerRoutes(app: FastifyInstance) {
  // ---------- Register (public — signed manifest is the auth) ----------

  app.post("/v1/work/workers", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = RegisterWorkerSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    }
    try {
      const w = await registerWorker(parse.data, {
        containerSignature: (req.body as { container_signature?: string })?.container_signature,
      });
      return reply.code(201).send(serializeWorker(w));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Register failed" } });
    }
  });

  // ---------- List (public) ----------

  app.get("/v1/work/workers", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListWorkersQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
    }
    const result = await listWorkers(parse.data);
    return reply.send({
      data: result.data.map(serializeWorker),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // ---------- Heartbeat (public — worker_id is the auth) ----------

  app.post("/v1/work/workers/:worker_id/heartbeat", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = WorkerIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: { message: "Invalid worker_id" } });
    }
    try {
      const w = await heartbeat(params.data.worker_id);
      return reply.send(serializeWorker(w));
    } catch (err) {
      if (err instanceof WorkerNotFoundError) {
        return reply.code(404).send({ error: { message: err.message } });
      }
      if (err instanceof WorkerSuspendedError) {
        return reply.code(403).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  // ---------- Worker jobs (public — worker_id is the auth) ----------

  app.get("/v1/work/workers/:worker_id/jobs", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = WorkerIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: { message: "Invalid worker_id" } });
    }
    try {
      const items = await listWorkerJobs(params.data.worker_id);
      return reply.send({
        data: items.map((i) => ({
          work_id: i.workId,
          algorithm_name: i.algorithmName,
          algorithm_version: i.algorithmVersion,
          input_hash: i.inputHash,
          input_uri: i.inputUri,
          status: i.status,
        })),
      });
    } catch (err) {
      if (err instanceof WorkerNotFoundError) {
        return reply.code(404).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  // ---------- Batch result submission ----------

  app.post("/v1/work/workers/:worker_id/results", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = WorkerIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: { message: "Invalid worker_id" } });
    }
    // Confirm the worker exists; reject 404 early.
    const w = await getWorker(params.data.worker_id);
    if (!w) {
      return reply.code(404).send({ error: { message: "Worker not found" } });
    }
    const parse = BatchSubmitResultSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    }
    // Each result routes to the verifier individually.
    const { submitResult } = await import("../services/verifier.js");
    const { billVerifiedWorkItem } = await import("../services/accountant.js");
    const outcomes: Array<{ work_id: string; outcome: unknown }> = [];
    for (const r of parse.data.results) {
      const o = await submitResult(
        r.work_id,
        params.data.worker_id,
        r.payload_hash,
        r.signature,
      );
      outcomes.push({ work_id: r.work_id, outcome: o ?? "not_enough_submissions" });
      if (o && o.status === "verified") {
        void billVerifiedWorkItem(r.work_id).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("[work] billing error:", err);
        });
      }
    }
    return reply.send({ results: outcomes });
  });
}

function serializeWorker(w: {
  workerId: string;
  kind: string;
  status: string;
  cpuCores: number;
  memoryGb: number;
  gpu: string;
  algorithms: unknown;
  runtime: string;
  location: string;
  reputation: string | number;
  disputes: number;
  lastHeartbeatAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    worker_id: w.workerId,
    kind: w.kind,
    status: w.status,
    capabilities: {
      cpu_cores: w.cpuCores,
      memory_gb: w.memoryGb,
      gpu: w.gpu,
      algorithms: w.algorithms,
      runtime: w.runtime,
      location: w.location,
      reputation: typeof w.reputation === "string" ? Number(w.reputation) : w.reputation,
      disputes: w.disputes,
    },
    last_heartbeat_at: w.lastHeartbeatAt?.toISOString() ?? null,
    created_at: w.createdAt.toISOString(),
    updated_at: w.updatedAt.toISOString(),
  };
}
