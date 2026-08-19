/**
 * /v1/training/jobs — training job lifecycle (Phase 19C.2).
 *
 * Authenticated (JWT) routes:
 *   GET    /v1/training/jobs              — list (filter by status, ann_id)
 *   POST   /v1/training/jobs              — submit
 *   GET    /v1/training/jobs/:id          — details
 *   POST   /v1/training/jobs/:id/cancel   — cancel (queued/preparing only)
 *
 * The submit endpoint also kicks off the in-process worker if
 * it isn't already running. The worker is a singleton per
 * process; we start it lazily on the first job.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  submitJob,
  getJob,
  listJobs,
  cancelJob,
  SubmitJobSchema,
  ListJobsQuerySchema,
  TrainingJobNotFoundError,
  TrainingJobConflictError,
} from "../services/jobs.js";
import { TrainingInvalidRecipeError } from "../lib/errors.js";
import { serializeJob } from "../lib/serialize.js";
import { startWorker } from "../services/worker.js";

let workerStarted = false;
function ensureWorkerStarted(): void {
  if (workerStarted) return;
  startWorker();
  workerStarted = true;
}

export async function jobRoutes(app: FastifyInstance) {
  // List jobs
  app.get(
    "/v1/training/jobs",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ListJobsQuerySchema.safeParse(req.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
      }
      // If the caller didn't pass user_id, default to "self only" —
      // a non-admin user shouldn't see other people's jobs.
      const q = parse.data;
      if (!q.user_id) {
        q.user_id = req.user.sub;
      }
      const result = await listJobs(q);
      return reply.send({
        data: result.data.map(serializeJob),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  );

  // Submit job
  app.post(
    "/v1/training/jobs",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = SubmitJobSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid body", issues: parse.error.issues } });
      }
      try {
        const created = await submitJob(req.user.sub, parse.data);
        ensureWorkerStarted();
        return reply.code(201).send(serializeJob(created));
      } catch (e) {
        if (e instanceof TrainingInvalidRecipeError) {
          return reply.code(400).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );

  // Get one
  app.get(
    "/v1/training/jobs/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      try {
        const row = await getJob(id);
        return reply.send(serializeJob(row));
      } catch (e) {
        if (e instanceof TrainingJobNotFoundError) {
          return reply.code(404).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );

  // Cancel
  app.post(
    "/v1/training/jobs/:id/cancel",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      try {
        const updated = await cancelJob(req.user.sub, id);
        return reply.send(serializeJob(updated));
      } catch (e) {
        if (e instanceof TrainingJobNotFoundError) {
          return reply.code(404).send({ error: { message: e.message } });
        }
        if (e instanceof TrainingJobConflictError) {
          return reply.code(409).send({ error: { message: e.message } });
        }
        throw e;
      }
    },
  );
}
