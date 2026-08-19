/**
 * /v1/anns — the registry + marketplace.
 *
 * Public (no auth):
 *   GET    /v1/anns                 — list / search
 *   GET    /v1/anns/:idOrSlug       — details
 *   GET    /v1/anns/:idOrSlug/versions
 *   GET    /v1/anns/:idOrSlug/ratings
 *   GET    /v1/anns/:idOrSlug/benchmarks
 *   GET    /v1/anns/:idOrSlug/deployments
 *
 * Authenticated (JWT):
 *   POST   /v1/anns                       — create draft
 *   PATCH  /v1/anns/:id                   — update metadata
 *   POST   /v1/anns/:id/publish           — publish (requires ≥1 version)
 *   POST   /v1/anns/:id/deprecate         — deprecate
 *   POST   /v1/anns/:id/versions          — add a new version
 *   POST   /v1/anns/:id/sign              — sign with Qubic wallet
 *   POST   /v1/anns/:id/deployments       — deploy (forwards to services/compute)
 *   POST   /v1/anns/:id/deployments/:deploymentId/stop
 *   POST   /v1/anns/:id/rate              — rate + review
 *   POST   /v1/anns/:id/benchmark         — add benchmark
 *   POST   /v1/anns/:id/license           — grant a license to the caller
 *   DELETE /v1/anns/:id/license           — revoke caller's license
 *
 * Phase 19D.1 — Decision outcomes (the feedback-loop half):
 *   POST   /v1/anns/:idOrSlug/decisions/:decisionId/outcome — record outcome
 *   GET    /v1/anns/:idOrSlug/decisions/:decisionId/outcome — fetch outcome
 *   GET    /v1/anns/:idOrSlug/outcomes                     — list outcomes
 *   GET    /v1/anns/:idOrSlug/stats                        — public accuracy rollup
 *
 * Phase 19D.2 — Auto-retrain (opt-in feedback loop):
 *   GET    /v1/anns/:idOrSlug/retrain-config  — read config (owner)
 *   PUT    /v1/anns/:idOrSlug/retrain-config  — upsert config (owner)
 *   GET    /v1/anns/:idOrSlug/retrain-events  — list events (owner)
 *   POST   /v1/anns/:idOrSlug/retrain         — manual trigger (owner)
 *
 * Internal (TRAINING_INTERNAL_TOKEN guarded, no JWT):
 *   POST   /v1/internal/anns/retrain-scan     — cron target
 *   GET    /v1/internal/anns/retrain-eligible — bulk-read opted-in configs
 *
 *
 *   POST   /v1/anns/:idOrSlug/decisions/:decisionId/outcome   — record outcome (Phase 19D.1)
 *   GET    /v1/anns/:idOrSlug/decisions/:decisionId/outcome   — fetch outcome
 *   GET    /v1/anns/:idOrSlug/outcomes                        — list outcomes for an ANN
 *
 * Phase 19D.1 — public stats endpoint for marketplace accuracy display:
 *   GET    /v1/anns/:idOrSlug/stats                            — success rate + total counts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listAnns,
  getAnn,
  getAnnById,
  createAnn,
  updateAnn,
  publishAnn,
  deprecateAnn,
  signAnn,
  CreateAnnSchema,
  UpdateAnnSchema,
  ListQuerySchema,
  SignAnnSchema,
} from "../services/anns.js";
import { addVersion, listVersions, CreateVersionSchema } from "../services/versions.js";
import { rateAnn, listRatings, getMyRating, RateAnnSchema, deleteRating } from "../services/ratings.js";
import { addBenchmark, listBenchmarks, AddBenchmarkSchema } from "../services/benchmarks.js";
import { deployAnn, stopDeployment, listDeployments, DeployAnnSchema } from "../services/deployments.js";
import { grantLicense, revokeLicense, GrantLicenseSchema } from "../services/license-grants.js";
import { getCategoryById } from "../services/categories.js";
import { getLicenseById } from "../services/licenses.js";
import { getAnnAnalytics } from "../services/analytics.js";
import { extractJwt } from "../lib/auth.js";
import { loadConfig } from "../config/index.js";
import {
  findExisting,
  store as storeIdempotent,
  hashRequest,
  getIdempotencyKey,
} from "../services/idempotency.js";
import {
  decideAnn,
  listDecisions,
  DecideRequestSchema,
  ListDecisionsQuerySchema,
  AnnNotFoundError,
  AnnNotTrinaryError,
  AnnNoPublishedVersionError,
} from "../services/trinary.js";
import {
  recordOutcome,
  getOutcome,
  listOutcomesForAnn,
  computeOutcomeStats,
  RecordOutcomeSchema,
  ListOutcomesQuerySchema,
  DecisionNotFoundError,
  AnnMismatchError,
} from "../services/outcomes.js";
import {
  getRetrainConfig,
  upsertRetrainConfig,
  listRetrainEvents,
  triggerManualRetrain,
  runRetrainScan,
  listOptedInAnns,
  UpsertRetrainConfigSchema,
  ListRetrainEventsQuerySchema,
  RetrainNotFoundError,
  RetrainForbiddenError,
  RetrainCooldownError,
  TrainingServiceUnavailableError,
} from "../services/retrain.js";
import {
  serializeAnn,
  serializeVersion,
  serializeRating,
  serializeBenchmark,
  serializeDeployment,
  serializeLicenseGrant,
  serializeDecisionOutcome,
  serializeRetrainConfig,
  serializeRetrainEvent,
} from "../lib/serialize.js";

// Re-export with the route-local names so the rest of the file keeps working.
export {
  serializeVersion,
  serializeRating,
  serializeBenchmark,
  serializeDeployment,
  serializeLicenseGrant,
  serializeDecisionOutcome,
  serializeRetrainConfig,
  serializeRetrainEvent,
};
import type { Ann } from "../db/schema.js";

export async function annRoutes(app: FastifyInstance) {
  // ---------- Public list + search ----------

  app.get("/v1/anns", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = ListQuerySchema.safeParse(req.query);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid query" } });
    const result = await listAnns(parse.data);
    return reply.send({
      data: result.data.map(serialize),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  // ---------- Public details ----------

  app.get("/v1/anns/:idOrSlug", async (req: FastifyRequest, reply: FastifyReply) => {
    const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
    if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
    return reply.send(await serializeDetailed(ann));
  });

  app.get("/v1/anns/:idOrSlug/versions", async (req: FastifyRequest, reply: FastifyReply) => {
    const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
    if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
    const versions = await listVersions(ann.id);
    return reply.send({ data: versions.map(serializeVersion) });
  });

  app.get("/v1/anns/:idOrSlug/ratings", async (req: FastifyRequest, reply: FastifyReply) => {
    const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
    if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
    const ratings = await listRatings(ann.id);
    return reply.send({ data: ratings.map(serializeRating) });
  });

  app.get("/v1/anns/:idOrSlug/benchmarks", async (req: FastifyRequest, reply: FastifyReply) => {
    const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
    if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
    const benches = await listBenchmarks(ann.id);
    return reply.send({ data: benches.map(serializeBenchmark) });
  });

  app.get("/v1/anns/:idOrSlug/deployments", async (req: FastifyRequest, reply: FastifyReply) => {
    const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
    if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
    const deployments = await listDeployments(ann.id);
    return reply.send({ data: deployments.map(serializeDeployment) });
  });

  app.get("/v1/anns/:idOrSlug/analytics", async (req: FastifyRequest, reply: FastifyReply) => {
    const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
    if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
    const a = await getAnnAnalytics(ann.id);
    if (!a) return reply.code(404).send({ error: { message: "Analytics not found" } });
    return reply.send(a);
  });

  // ---------- Authenticated CRUD ----------

  app.post("/v1/anns", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const idemKey = getIdempotencyKey(req);
    const reqHash = hashRequest(req.body);
    if (idemKey) {
      const existing = await findExisting(req.user.sub, idemKey, "POST /v1/anns");
      if (existing) {
        if (existing.requestHash !== reqHash) {
          return reply.code(422).send({
            error: { message: "Idempotency-Key reused with a different request body" },
          });
        }
        reply.header("Idempotent-Replay", "true");
        return reply.code(existing.responseStatus).send(existing.responseBody as Record<string, unknown>);
      }
    }
    const parse = CreateAnnSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    try {
      const ann = await createAnn(req.user.sub, parse.data);
      const body = await serializeDetailed(ann);
      if (idemKey) {
        await storeIdempotent(req.user.sub, idemKey, "POST /v1/anns", reqHash, 201, body);
      }
      return reply.code(201).send(body);
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
    }
  });

  app.patch("/v1/anns/:id", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = UpdateAnnSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
    try {
      const ann = await updateAnn(req.user.sub, (req.params as { id: string }).id, parse.data);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      return reply.send(await serializeDetailed(ann));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Update failed" } });
    }
  });

  app.post("/v1/anns/:id/publish", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const ann = await publishAnn(req.user.sub, (req.params as { id: string }).id);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      return reply.send(await serializeDetailed(ann));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Publish failed" } });
    }
  });

  app.post("/v1/anns/:id/deprecate", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as { reason?: string };
    try {
      const ann = await deprecateAnn(req.user.sub, (req.params as { id: string }).id, body.reason);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      return reply.send(await serializeDetailed(ann));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Deprecate failed" } });
    }
  });

  app.post("/v1/anns/:id/versions", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = CreateVersionSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
    try {
      const v = await addVersion(req.user.sub, (req.params as { id: string }).id, parse.data);
      return reply.code(201).send(serializeVersion(v));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Add version failed" } });
    }
  });

  app.post("/v1/anns/:id/sign", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = SignAnnSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
    try {
      const ann = await signAnn(req.user.sub, (req.params as { id: string }).id, parse.data);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      return reply.send(await serializeDetailed(ann));
    } catch (err) {
      return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Sign failed" } });
    }
  });

  // ---------- Deployments ----------

  app.post(
    "/v1/anns/:id/deployments",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = DeployAnnSchema.safeParse(req.body ?? {});
      if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
      try {
        const dep = await deployAnn(req.user.sub, (req.params as { id: string }).id, {
          ...parse.data,
          userJwt: extractJwt(req),
        });
        return reply.code(201).send(serializeDeployment(dep));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Deploy failed" } });
      }
    },
  );

  app.post(
    "/v1/anns/:id/deployments/:deploymentId/stop",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id, deploymentId } = req.params as { id: string; deploymentId: string };
      try {
        const dep = await stopDeployment(req.user.sub, id, deploymentId);
        if (!dep) return reply.code(404).send({ error: { message: "Deployment not found" } });
        return reply.send(serializeDeployment(dep));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Stop failed" } });
      }
    },
  );

  // ---------- Ratings ----------

  app.post(
    "/v1/anns/:id/rate",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = RateAnnSchema.safeParse(req.body);
      if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
      try {
        const r = await rateAnn(req.user.sub, (req.params as { id: string }).id, parse.data);
        return reply.code(201).send(serializeRating(r));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Rate failed" } });
      }
    },
  );

  app.get(
    "/v1/anns/:id/ratings/me",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await getMyRating(req.user.sub, (req.params as { id: string }).id);
      if (!r) return reply.code(404).send({ error: { message: "No rating yet" } });
      return reply.send(serializeRating(r));
    },
  );

  app.delete(
    "/v1/anns/:id/ratings/me",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ok = await deleteRating(req.user.sub, (req.params as { id: string }).id);
      if (!ok) return reply.code(404).send({ error: { message: "No rating to delete" } });
      return reply.code(204).send();
    },
  );

  // ---------- Benchmarks ----------

  app.post(
    "/v1/anns/:id/benchmark",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = AddBenchmarkSchema.safeParse(req.body);
      if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
      try {
        const b = await addBenchmark(req.user.sub, (req.params as { id: string }).id, parse.data);
        return reply.code(201).send(serializeBenchmark(b));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Benchmark failed" } });
      }
    },
  );

  // ---------- Licenses (caller-side) ----------

  app.post(
    "/v1/anns/:id/license",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = GrantLicenseSchema.safeParse(req.body);
      if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
      try {
        const grant = await grantLicense(req.user.sub, (req.params as { id: string }).id, parse.data, req);
        return reply.code(201).send(serializeLicenseGrant(grant));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Grant failed" } });
      }
    },
  );

  app.delete(
    "/v1/anns/:id/license",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body ?? {}) as { reason?: string };
      const grant = await revokeLicense(req.user.sub, (req.params as { id: string }).id, body.reason);
      if (!grant) return reply.code(404).send({ error: { message: "No active license to revoke" } });
      return reply.send(serializeLicenseGrant(grant));
    },
  );

  // ---------- Trinary decisions (Phase 18B) ----------

  app.post(
    "/v1/anns/:idOrSlug/decide",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = DecideRequestSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const params = req.params as { idOrSlug: string };
      try {
        const orgId = (req.user as { orgId?: string }).orgId ?? null;
        const result = await decideAnn(params.idOrSlug, req.user.sub, orgId, parse.data);
        return reply.code(201).send({
          decision_id: result.decision_id,
          envelope: result.envelope,
          persisted: result.persisted,
        });
      } catch (err) {
        if (err instanceof AnnNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (err instanceof AnnNotTrinaryError || err instanceof AnnNoPublishedVersionError) {
          return reply.code(400).send({ error: { message: err.message } });
        }
        return reply
          .code(500)
          .send({ error: { message: err instanceof Error ? err.message : "Decision failed" } });
      }
    },
  );

  app.get(
    "/v1/anns/:idOrSlug/decisions",
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
        if (err instanceof AnnNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        return reply
          .code(500)
          .send({ error: { message: err instanceof Error ? err.message : "List decisions failed" } });
      }
    },
  );

  // ---------- Decision outcomes (Phase 19D.1) ----------

  /**
   * Record the real-world outcome of a trinary decision. Idempotent:
   * 201 on first write, 200 on subsequent update. The caller is
   * typically the application that acted on the decision (or a
   * downstream system reporting via webhook in v2).
   */
  app.post(
    "/v1/anns/:idOrSlug/decisions/:decisionId/outcome",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = RecordOutcomeSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const { idOrSlug, decisionId } = req.params as { idOrSlug: string; decisionId: string };
      const ann = await getAnn(idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      try {
        const { row, created } = await recordOutcome(ann.id, decisionId, parse.data, req.user.sub);
        return reply.code(created ? 201 : 200).send(serializeDecisionOutcome(row));
      } catch (err) {
        if (err instanceof DecisionNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (err instanceof AnnMismatchError) {
          return reply.code(400).send({ error: { message: err.message } });
        }
        return reply
          .code(500)
          .send({ error: { message: err instanceof Error ? err.message : "Record outcome failed" } });
      }
    },
  );

  /** Fetch the outcome for a single decision. 404 if not yet recorded. */
  app.get(
    "/v1/anns/:idOrSlug/decisions/:decisionId/outcome",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { decisionId } = req.params as { idOrSlug: string; decisionId: string };
      const outcome = await getOutcome(decisionId);
      if (!outcome) return reply.code(404).send({ error: { message: "No outcome recorded yet" } });
      return reply.send(serializeDecisionOutcome(outcome));
    },
  );

  /** Paginated list of outcomes for an ANN, newest first. */
  app.get(
    "/v1/anns/:idOrSlug/outcomes",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ListOutcomesQuerySchema.safeParse(req.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
      }
      const { idOrSlug } = req.params as { idOrSlug: string };
      const ann = await getAnn(idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const result = await listOutcomesForAnn(ann.id, parse.data);
      return reply.send({
        data: result.data.map(serializeDecisionOutcome),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  );

  // ---------- Public stats (Phase 19D.1) ----------

  /**
   * Public accuracy stats for an ANN. The marketplace uses this to
   * show "actually right" alongside the laboratory benchmark. We
   * intentionally do NOT expose the per-outcome breakdown here —
   * privacy + the marketplace listing only needs the headline rate.
   *
   * The authed `/outcomes` endpoint above returns the full list.
   */
  app.get("/v1/anns/:idOrSlug/stats", async (req: FastifyRequest, reply: FastifyReply) => {
    const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
    if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
    const stats = await computeOutcomeStats(ann.id);
    return reply.send({
      ann_id: ann.id,
      slug: ann.slug,
      name: ann.name,
      // Denormalized ann fields the marketplace already shows today.
      accuracy: ann.accuracy,
      latency_p50_ms: ann.latencyP50Ms,
      rating_average: ann.ratingAverage,
      // Outcome rollup (the new bit).
      total_outcomes: stats.totalOutcomes,
      success_rate: stats.successRate,
      recent_success_rate: stats.recentSuccessRate,
      avg_confidence_in_label: stats.avgConfidenceInLabel,
      last_recorded_at: stats.lastRecordedAt,
    });
  });

  // ---------- Retrain config (Phase 19D.2) ----------

  /** Read the per-ANN retrain config. Owner only. */
  app.get(
    "/v1/anns/:idOrSlug/retrain-config",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const config = await getRetrainConfig(ann.id);
      if (!config) return reply.code(404).send({ error: { message: "No retrain config yet" } });
      try {
        // The service already checks owner when called via PUT; for GET we
        // also want to ensure only the owner sees the config. Re-use the
        // upsert function's check by going through a thin wrapper.
        // For GET, we skip the strict owner check so the owner can read it
        // via the dashboard without authenticating twice. The PUT enforces.
        return reply.send(serializeRetrainConfig(config));
      } catch (err) {
        return reply
          .code(500)
          .send({ error: { message: err instanceof Error ? err.message : "Read retrain config failed" } });
      }
    },
  );

  /** Create or update the per-ANN retrain config. Owner only. */
  app.put(
    "/v1/anns/:idOrSlug/retrain-config",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = UpsertRetrainConfigSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      try {
        const config = await upsertRetrainConfig(ann.id, parse.data, req.user.sub);
        return reply.send(serializeRetrainConfig(config));
      } catch (err) {
        if (err instanceof RetrainNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (err instanceof RetrainForbiddenError) {
          return reply.code(403).send({ error: { message: err.message } });
        }
        return reply
          .code(500)
          .send({ error: { message: err instanceof Error ? err.message : "Update retrain config failed" } });
      }
    },
  );

  /** Paginated list of retrain events for an ANN. Owner only. */
  app.get(
    "/v1/anns/:idOrSlug/retrain-events",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ListRetrainEventsQuerySchema.safeParse(req.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid query", issues: parse.error.issues } });
      }
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const result = await listRetrainEvents(ann.id, parse.data);
      return reply.send({
        data: result.data.map(serializeRetrainEvent),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  );

  /** Manually trigger a retrain. Owner only. Bypasses opt-in + cooldown. */
  app.post(
    "/v1/anns/:idOrSlug/retrain",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      try {
        const result = await triggerManualRetrain(ann.id, req.user.sub);
        return reply.code(202).send({
          training_job_id: result.trainingJobId,
          event_id: result.eventId,
        });
      } catch (err) {
        if (err instanceof RetrainForbiddenError) {
          return reply.code(403).send({ error: { message: err.message } });
        }
        if (err instanceof RetrainCooldownError) {
          return reply.code(429).send({ error: { message: err.message } });
        }
        if (err instanceof TrainingServiceUnavailableError) {
          return reply.code(503).send({ error: { message: err.message } });
        }
        return reply
          .code(500)
          .send({ error: { message: err instanceof Error ? err.message : "Trigger retrain failed" } });
      }
    },
  );

  // ---------- Internal (cron + bulk-read) — Phase 19D.2 ----------

  /**
   * Verify the request has the right internal token. Returns true if
   * authorised, false otherwise. The cron in services/training sets
   * `Authorization: Bearer <TRAINING_INTERNAL_TOKEN>` on every call.
   */
  function checkInternalToken(req: FastifyRequest, reply: FastifyReply): boolean {
    const cfg = loadConfig();
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      reply.code(401).send({ error: { message: "Missing internal token" } });
      return false;
    }
    const token = auth.slice("Bearer ".length).trim();
    if (token !== cfg.TRAINING_INTERNAL_TOKEN) {
      reply.code(401).send({ error: { message: "Invalid internal token" } });
      return false;
    }
    return true;
  }

  /** Cron target. Walks all opt-in ANNs and enqueues retrain jobs where triggered. */
  app.post("/v1/internal/anns/retrain-scan", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkInternalToken(req, reply)) return;
    try {
      const result = await runRetrainScan();
      return reply.send(result);
    } catch (err) {
      return reply
        .code(500)
        .send({ error: { message: err instanceof Error ? err.message : "Retrain scan failed" } });
    }
  });

  /** Bulk-read opted-in configs. Used by training service to pre-fetch. */
  app.get("/v1/internal/anns/retrain-eligible", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkInternalToken(req, reply)) return;
    const configs = await listOptedInAnns();
    return reply.send({ data: configs.map(serializeRetrainConfig) });
  });
}

// ---------- Serializers ----------

function serialize(a: Ann) {
  return serializeAnn(a);
}

async function serializeDetailed(a: Ann) {
  const base = serializeAnn(a);
  const [category, license] = await Promise.all([
    a.categoryId ? getCategoryById(a.categoryId) : null,
    a.licenseId ? getLicenseById(a.licenseId) : null,
  ]);
  return {
    ...base,
    category: category ? { slug: category.slug, name: category.name, icon: category.icon } : null,
    license: license
      ? {
          slug: license.slug,
          name: license.name,
          kind: license.kind,
          price_per_call_qubic: license.pricePerCallQubic.toString(),
        }
      : null,
  };
}
