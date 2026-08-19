/**
 * Work service — Fastify server bootstrap.
 *
 * Mirrors services/tissue/server.ts.
 */

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { loadConfig } from "./config/index.js";
import { healthRoutes } from "./routes/health.js";
import { itemRoutes } from "./routes/items.js";
import { workerRoutes } from "./routes/workers.js";
import { algorithmRoutes } from "./routes/algorithms.js";
import { internalRoutes } from "./routes/internal.js";
import { closeDb } from "./db/index.js";
import { registerHttpMetrics } from "@aigarth/observability";
import { ensureAwork1Registered } from "./services/algorithms.js";

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
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  const origins = cfg.CORS_ORIGINS === "*" ? true : cfg.CORS_ORIGINS.split(",").map((s) => s.trim());
  await app.register(fastifyCors, { origin: origins, credentials: true });
  await app.register(fastifyCookie, { secret: cfg.JWT_SECRET });
  await app.register(fastifyJwt, { secret: cfg.JWT_SECRET });

  registerHttpMetrics(app, { serviceName: "work" });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { message: "Invalid or missing token" } });
    }
  });

  // Global write-method rate limiter (30 writes/min per JWT sub).
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
  await app.register(itemRoutes);
  await app.register(workerRoutes);
  await app.register(algorithmRoutes);
  await app.register(internalRoutes);

  return app;
}

export async function start() {
  const cfg = loadConfig();
  const app = await buildServer();

  // Eagerly ensure awork_1 is registered (idempotent).
  try {
    await ensureAwork1Registered();
  } catch (err) {
    app.log.warn({ err }, "awork_1 registration failed at startup; will retry on first access");
  }

  // Start the assignment + challenger loops.
  const { startAssignmentLoop, stopAssignmentLoop } = await import("./workers/assignment.js");
  const { startChallengerLoop, stopChallengerLoop } = await import("./workers/challenger.js");
  startAssignmentLoop();
  startChallengerLoop();

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, async () => {
      app.log.info({ sig }, "shutting down");
      try {
        stopAssignmentLoop();
        stopChallengerLoop();
        await app.close();
        await closeDb();
      } finally {
        process.exit(0);
      }
    });
  }
  await app.listen({ port: cfg.PORT, host: cfg.HOST });
  app.log.info({ port: cfg.PORT, host: cfg.HOST, env: cfg.NODE_ENV }, "work service ready");
}
