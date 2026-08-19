/**
 * /v1/compute/jobs — job lifecycle.
 *
 *   POST /v1/compute/jobs                submit
 *   GET  /v1/compute/jobs                list (filterable by status)
 *   GET  /v1/compute/jobs/:id            read
 *   POST /v1/compute/jobs/:id/cancel     cancel
 *   POST /v1/compute/jobs/:id/broadcast  (test helper) flip queued -> submitted
 *   POST /v1/compute/jobs/:id/complete   (test helper) flip -> completed
 *   GET  /v1/compute/stats               user aggregate
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  submitJob,
  listJobs,
  getJob,
  cancelJob,
  broadcastJob,
  transitionJob,
  getUserStats,
  getUserCapacity,
  SubmitJobSchema,
  type JobStatus,
} from "../services/jobs.js";

const CompleteSchema = z.object({
  result: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
});

export async function jobRoutes(app: FastifyInstance) {
  app.post(
    "/v1/compute/jobs",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = SubmitJobSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const { job, estimatedCostQubic, remainingCreditQubic } = await submitJob(
          req.user.sub,
          parse.data,
        );
        return reply.code(201).send({
          ...serialize(job),
          estimated_cost_qubic: estimatedCostQubic.toString(),
          remaining_credit_qubic: remainingCreditQubic.toString(),
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Submit failed" } });
      }
    },
  );

  app.get(
    "/v1/compute/jobs",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { status?: string; limit?: string };
      const jobs = await listJobs(req.user.sub, {
        status: q.status as JobStatus | undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return reply.send({ data: jobs.map(serialize) });
    },
  );

  app.get(
    "/v1/compute/jobs/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const job = await getJob(req.user.sub, (req.params as { id: string }).id);
      if (!job) return reply.code(404).send({ error: { message: "Job not found" } });
      return reply.send(serialize(job));
    },
  );

  app.post(
    "/v1/compute/jobs/:id/cancel",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const job = await cancelJob(req.user.sub, (req.params as { id: string }).id);
        return reply.send(serialize(job));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Cancel failed" } });
      }
    },
  );

  // Test/dev helper: broadcast a queued job
  app.post(
    "/v1/compute/jobs/:id/broadcast",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const job = await broadcastJob(req.user.sub, (req.params as { id: string }).id);
        return reply.send(serialize(job));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Broadcast failed" } });
      }
    },
  );

  // Test/dev helper: complete a job (set status + result)
  app.post(
    "/v1/compute/jobs/:id/complete",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CompleteSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      const job = await getJob(req.user.sub, (req.params as { id: string }).id);
      if (!job) return reply.code(404).send({ error: { message: "Job not found" } });
      if (job.userId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "Not your job" } });
      }
      const target = parse.data.errorMessage ? "failed" : "completed";
      const updated = await transitionJob(job.id, target, {
        result: parse.data.result,
        errorMessage: parse.data.errorMessage,
        completedTick: Math.floor(Date.now() / 1000),
      });
      if (!updated) return reply.code(404).send({ error: { message: "Job vanished" } });
      return reply.send(serialize(updated));
    },
  );

  // Test/dev helper: mark a job as running
  app.post(
    "/v1/compute/jobs/:id/start",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const job = await getJob(req.user.sub, (req.params as { id: string }).id);
      if (!job) return reply.code(404).send({ error: { message: "Job not found" } });
      if (job.userId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "Not your job" } });
      }
      const updated = await transitionJob(job.id, "running", {
        startedTick: Math.floor(Date.now() / 1000),
      });
      if (!updated) return reply.code(404).send({ error: { message: "Job vanished" } });
      return reply.send(serialize(updated));
    },
  );

  app.get(
    "/v1/compute/credits",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const credit = await getUserCapacity(req.user.sub);
      return reply.send({
        user_id: credit.userId,
        total_credit_qubic: credit.totalCreditQubic.toString(),
        used_qubic: credit.usedQubic.toString(),
        remaining_qubic: credit.remainingQubic.toString(),
        active_reservation_count: credit.activeReservationCount,
      });
    },
  );

  app.get(
    "/v1/compute/stats",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const stats = await getUserStats(req.user.sub);
      return reply.send({
        total_jobs: stats.totalJobs,
        active_jobs: stats.activeJobs,
        completed_jobs: stats.completedJobs,
        failed_jobs: stats.failedJobs,
        cancelled_jobs: stats.cancelledJobs,
        total_spent_qubic: stats.totalSpentQubic.toString(),
      });
    },
  );
}

function serialize(j: Awaited<ReturnType<typeof getJob>>) {
  if (!j) return null;
  return {
    id: j.id,
    type: j.type,
    status: j.status,
    priority: j.priority,
    cluster_id: j.clusterId,
    region_id: j.regionId,
    contract_index: j.contractIndex,
    function_index: j.functionIndex,
    payload: j.payload,
    tx_hash: j.txHash,
    submitted_tick: j.submittedTick,
    started_tick: j.startedTick,
    completed_tick: j.completedTick,
    result: j.result,
    error_message: j.errorMessage,
    credit_used_qubic: j.creditUsedQubic?.toString() ?? null,
    reservation_id: j.reservationId,
    submitted_at: j.submittedAt?.toISOString() ?? null,
    started_at: j.startedAt?.toISOString() ?? null,
    completed_at: j.completedAt?.toISOString() ?? null,
    deadline_at: j.deadlineAt?.toISOString() ?? null,
    created_at: j.createdAt.toISOString(),
    updated_at: j.updatedAt.toISOString(),
  };
}
