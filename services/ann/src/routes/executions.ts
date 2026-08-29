/**
 * /v1/anns/:idOrSlug/execute* — Execution Router routes (Phase 29).
 *
 * Public (no auth):
 *   GET    /v1/anns/:idOrSlug/executions           — list execution history
 *   GET    /v1/anns/:idOrSlug/executions/:execId   — fetch one execution
 *   GET    /v1/anns/:idOrSlug/repositories         — list GitHub publication rows
 *
 * Authenticated (JWT):
 *   POST   /v1/anns/:idOrSlug/execute              — submit a run
 *   POST   /v1/anns/:idOrSlug/publish              — publish a version to GitHub
 *                                                   (currently a stub — see M5)
 *
 * The execution routes do NOT do their own ANN/version resolution
 * (the service layer does). They do enforce the request shape via
 * Zod so a malformed call never reaches the router.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  submitExecution,
  listExecutions,
  getExecution,
  listRepositories,
  publishAnnStub,
  serializeExecution,
  serializeRepository,
  AnnNotFoundForExecutionError,
  AnnNoPublishedVersionError,
  AnnManifestMismatchError,
} from "../services/executions.js";
import { AnnExecutorError } from "../services/execution/types.js";
import { extractJwt } from "../lib/auth.js";
import { loadConfig } from "../config/index.js";
void loadConfig;

const ExecutionTargetSchema = z.enum(["local", "qubic_oc"]);

const ExecuteInputSchema = z
  .object({
    manifest_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    version: z.string().regex(/^v\d+\.\d+\.\d+$/),
    target: ExecutionTargetSchema,
    request_id: z.string().min(1).max(120),
    input: z.record(z.unknown()),
    parameters: z
      .object({
        timeout_ms: z.coerce.number().int().min(1_000).max(600_000).optional(),
        replicas: z.coerce.number().int().min(1).max(5).optional(),
        deterministic: z.coerce.boolean().optional(),
        reward_qubic: z.string().regex(/^\d+$/).optional(),
      })
      .optional(),
  })
  .strict();

const ListExecutionsQuerySchema = z.object({
  status: z.enum(["queued", "running", "completed", "failed"]).optional(),
  target: ExecutionTargetSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const PublishInputSchema = z
  .object({
    version: z.string().regex(/^v\d+\.\d+\.\d+$/),
    repo_owner: z.string().min(1).max(120),
    repo_name: z.string().min(1).max(120),
    commit_sha: z.string().regex(/^[a-f0-9]{40}$/),
    release_tag: z.string().max(120).optional(),
  })
  .strict();

export async function executionRoutes(app: FastifyInstance) {
  // ---------- Public list ----------

  app.get(
    "/v1/anns/:idOrSlug/executions",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { idOrSlug: string };
      const parse = ListExecutionsQuerySchema.safeParse(req.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
      }
      try {
        const result = await listExecutions(params.idOrSlug, {
          ...(parse.data.status ? { status: parse.data.status } : {}),
          ...(parse.data.target ? { target: parse.data.target } : {}),
          limit: parse.data.limit,
          offset: parse.data.offset,
        });
        return reply.send({
          data: result.data.map(serializeExecution),
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        });
      } catch (err) {
        if (err instanceof AnnNotFoundForExecutionError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        throw err;
      }
    },
  );

  // ---------- Public get ----------

  app.get(
    "/v1/anns/:idOrSlug/executions/:execId",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { idOrSlug: string; execId: string };
      try {
        const row = await getExecution(params.idOrSlug, params.execId);
        if (!row) {
          return reply.code(404).send({ error: { message: `Execution '${params.execId}' not found.` } });
        }
        return reply.send(serializeExecution(row));
      } catch (err) {
        if (err instanceof AnnNotFoundForExecutionError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        throw err;
      }
    },
  );

  // ---------- Public repositories list ----------

  app.get(
    "/v1/anns/:idOrSlug/repositories",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { idOrSlug: string };
      try {
        const repos = await listRepositories(params.idOrSlug);
        return reply.send({ data: repos.map(serializeRepository) });
      } catch (err) {
        if (err instanceof AnnNotFoundForExecutionError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        throw err;
      }
    },
  );

  // ---------- Authenticated execute ----------

  app.post(
    "/v1/anns/:idOrSlug/execute",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { idOrSlug: string };
      const parse = ExecuteInputSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const cfg = loadConfig();
      const userId = req.user?.sub ?? extractJwt(req);
      try {
        const result = await submitExecution(params.idOrSlug, {
          manifestHash: parse.data.manifest_hash,
          version: parse.data.version,
          target: parse.data.target,
          requestId: parse.data.request_id,
          input: parse.data.input,
          ...(parse.data.parameters
            ? {
                parameters: {
                  ...(parse.data.parameters.timeout_ms !== undefined
                    ? { timeoutMs: parse.data.parameters.timeout_ms }
                    : {}),
                  ...(parse.data.parameters.replicas !== undefined
                    ? { replicas: parse.data.parameters.replicas }
                    : {}),
                  ...(parse.data.parameters.deterministic !== undefined
                    ? { deterministic: parse.data.parameters.deterministic }
                    : {}),
                  ...(parse.data.parameters.reward_qubic
                    ? { rewardQubic: parse.data.parameters.reward_qubic }
                    : {}),
                },
              }
            : {}),
          requestedByUserId: userId ?? undefined,
        });
        return reply.code(202).send(result);
      } catch (err) {
        if (err instanceof AnnNotFoundForExecutionError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (err instanceof AnnNoPublishedVersionError) {
          return reply.code(409).send({ error: { message: err.message } });
        }
        if (err instanceof AnnManifestMismatchError) {
          return reply.code(409).send({ error: { message: err.message } });
        }
        if (err instanceof AnnExecutorError) {
          const status =
            err.code === "executor_unavailable"
              ? 503
              : err.code === "ann_not_found"
                ? 404
                : err.code === "invalid_input"
                  ? 400
                  : 500;
          return reply.code(status).send({ error: { message: err.message, code: err.code } });
        }
        throw err;
      }
    },
  );

  // ---------- Authenticated publish-to-GitHub (stub) ----------
  //
  // The full publish-to-GitHub flow is deferred (Phase 30+). The
  // route is registered at `/v1/anns/:idOrSlug/github-publish` to
  // avoid clashing with the existing `/v1/anns/:id/publish` route
  // in routes/anns.ts (which is the canonical "publish from draft
  // to public" path — it changes `anns.status` to `published`).

  app.post(
    "/v1/anns/:idOrSlug/github-publish",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { idOrSlug: string };
      const parse = PublishInputSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const result = await publishAnnStub(params.idOrSlug, {
        version: parse.data.version,
        repoOwner: parse.data.repo_owner,
        repoName: parse.data.repo_name,
        commitSha: parse.data.commit_sha,
        ...(parse.data.release_tag ? { releaseTag: parse.data.release_tag } : {}),
      });
      return reply.code(202).send(result);
    },
  );
}
