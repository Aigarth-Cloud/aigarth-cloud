/**
 * Gateway service — Fastify server bootstrap.
 *
 * Routes:
 *   - /healthz, /readyz
 *   - /v1/models                       (public, OpenAI-compatible)
 *   - /v1/keys                         (JWT auth, gateway API key management)
 *   - /v1/chat/completions             (JWT or API key, sync + SSE streaming)
 *   - /v1/embeddings                   (JWT or API key)
 *   - /v1/images/generations           (JWT or API key)
 *   - /v1/usage, /v1/usage/recent      (JWT auth, aggregate + recent)
 *
 * Auth model:
 *   - JWT: same JWT_SECRET as the identity service. Used for first-party clients.
 *   - API key: gateway-issued `ak_live_<prefix>.<secret>`. Used for SDK clients.
 *
 * Stub backends produce deterministic responses keyed on the input hash.
 * Replace the `backends/stub.ts` module with real providers when ready.
 */

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { loadConfig } from "./config/index.js";
import { healthRoutes } from "./routes/health.js";
import { modelRoutes } from "./routes/models.js";
import { keyRoutes } from "./routes/keys.js";
import { chatRoutes } from "./routes/chat.js";
import { embeddingRoutes } from "./routes/embeddings.js";
import { imageRoutes } from "./routes/images.js";
import { usageRoutes } from "./routes/usage.js";
import { closeDb } from "./db/index.js";
import { registerHttpMetrics } from "@aigarth/observability";

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

  // Observability (Phase 13) — Prometheus-format /metrics + HTTP
  // request hooks. Must be registered before any routes so the
  // hooks fire on every request.
  registerHttpMetrics(app, { serviceName: "gateway" });

  // JWT-only auth decorator (for /v1/keys, /v1/usage)
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { message: "Invalid or missing token" } });
    }
  });

  await app.register(healthRoutes);
  await app.register(modelRoutes);
  await app.register(keyRoutes);
  await app.register(chatRoutes);
  await app.register(embeddingRoutes);
  await app.register(imageRoutes);
  await app.register(usageRoutes);

  return app;
}

export async function start() {
  const cfg = loadConfig();
  const app = await buildServer();
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, async () => {
      app.log.info({ sig }, "shutting down");
      try {
        await app.close();
        await closeDb();
      } finally {
        process.exit(0);
      }
    });
  }
  await app.listen({ port: cfg.PORT, host: cfg.HOST });
  app.log.info({ port: cfg.PORT, host: cfg.HOST, env: cfg.NODE_ENV }, "gateway service ready");
}
