/**
 * Training service — Fastify server bootstrap (Phase 19C.1).
 *
 * Mirrors services/dataset:
 *   - JWT auth via @fastify/jwt, secret shared with the identity service
 *   - Helmet + CORS + cookie
 *   - 30-write-per-minute rate limit on write methods
 *
 * No multipart — training job submissions are pure JSON. The
 * worker is started lazily by the first job POST; see
 * `routes/jobs.ts`.
 *
 * Routes:
 *   - /healthz
 *   - /v1/training/recipes[/...]   (public catalog)
 *   - /v1/training/jobs[/...]      (authed)
 *   - /v1/training/jobs/:id/stream (authed SSE)
 */

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { loadConfig } from "./config/index.js";
import { healthRoutes } from "./routes/health.js";
import { recipeRoutes } from "./routes/recipes.js";
import { jobRoutes } from "./routes/jobs.js";
import { progressRoutes } from "./routes/progress.js";
import { closeDb } from "./db/index.js";
import { startWorker, stopWorker } from "./services/worker.js";
import { startRetrainCron, stopRetrainCron } from "./workers/retrain-cron.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export async function buildServer() {
  const cfg = loadConfig();

  const app = Fastify({
    logger: {
      level: cfg.LOG_LEVEL,
      transport:
        cfg.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
          : undefined,
    },
    trustProxy: true,
    // Default body limit. We don't accept large uploads here;
    // recipe/job payloads are pure JSON and tiny.
    bodyLimit: 1024 * 1024,
  });

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  const origins = cfg.CORS_ORIGINS === "*" ? true : cfg.CORS_ORIGINS.split(",").map((s) => s.trim());
  await app.register(fastifyCors, { origin: origins, credentials: true });
  await app.register(fastifyCookie, { secret: cfg.JWT_SECRET });
  await app.register(fastifyJwt, { secret: cfg.JWT_SECRET });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { message: "Invalid or missing token" } });
    }
  });

  // Global write-method rate limiter. 30 writes per minute per JWT sub.
  const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const writeBuckets = new Map<string, { count: number; resetAt: number }>();
  const WRITE_LIMIT = 30;
  const WRITE_WINDOW_MS = 60_000;
  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!writeMethods.has(req.method)) return;
    const userId = req.user?.sub;
    if (!userId) return;
    const key = `write:${userId}`;
    const now = Date.now();
    let bucket = writeBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + WRITE_WINDOW_MS };
      writeBuckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > WRITE_LIMIT) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      reply.header("Retry-After", retryAfter);
      reply.code(429).send({
        error: {
          message: `Rate limit exceeded. Max ${WRITE_LIMIT} writes per ${WRITE_WINDOW_MS / 1000}s.`,
          retry_after_seconds: retryAfter,
        },
      });
      return reply;
    }
    reply.header("X-RateLimit-Limit", WRITE_LIMIT);
    reply.header("X-RateLimit-Remaining", Math.max(0, WRITE_LIMIT - bucket.count));
    reply.header("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
  });

  await app.register(healthRoutes);
  await app.register(recipeRoutes);
  await app.register(jobRoutes);
  await app.register(progressRoutes);

  // Start the in-process training worker (picks up queued jobs every
  // TRAINING_WORKER_INTERVAL_MS).
  startWorker();

  return app;
}

export async function start() {
  const cfg = loadConfig();
  const app = await buildServer();
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, async () => {
      app.log.info({ sig }, "shutting down");
      try {
        stopRetrainCron();
        await stopWorker();
        await app.close();
        await closeDb();
      } finally {
        process.exit(0);
      }
    });
  }
  await app.listen({ port: cfg.PORT, host: cfg.HOST });
  // Start the auto-retrain cron (calls ann service's retrain-scan
  // endpoint every RETRAIN_SCAN_INTERVAL_MS).
  startRetrainCron();
  app.log.info({ port: cfg.PORT, host: cfg.HOST, env: cfg.NODE_ENV }, "training service ready");
}
