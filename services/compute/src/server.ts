/**
 * Compute service — Fastify server bootstrap.
 *
 * Routes:
 *   - /healthz, /readyz
 *   - /v1/compute/regions/*     (CRUD + stats)
 *   - /v1/compute/clusters/*    (CRUD + members)
 *   - /v1/compute/jobs/*        (submit, list, read, cancel, broadcast/complete helpers)
 *   - /v1/compute/reservations/* (create, list, read, release)
 *   - /v1/compute/credits       (derived)
 *   - /v1/compute/stats         (user aggregate)
 *   - /v1/nodes/reservations/*   (Phase 24 hardware presale)
 *   - /v1/nodes/escrow/*         (Phase 24.2 read-only ledger views)
 *
 * Auth: same JWT_SECRET as the identity service. We verify the JWT only.
 */

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { loadConfig } from "./config/index.js";
import { healthRoutes } from "./routes/health.js";
import { regionRoutes } from "./routes/regions.js";
import { clusterRoutes } from "./routes/clusters.js";
import { jobRoutes } from "./routes/jobs.js";
import { reservationRoutes } from "./routes/reservations.js";
import { nodeReservationRoutes } from "./routes/node-reservations.js";
import { escrowRoutes } from "./routes/escrow.js";
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
    bodyLimit: 1 * 1024 * 1024,
  });

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  const origins = cfg.CORS_ORIGINS === "*" ? true : cfg.CORS_ORIGINS.split(",").map((s) => s.trim());
  await app.register(fastifyCors, { origin: origins, credentials: true });
  await app.register(fastifyCookie, { secret: cfg.JWT_SECRET });
  await app.register(fastifyJwt, { secret: cfg.JWT_SECRET });

  // Observability (Phase 13) — Prometheus-format /metrics + HTTP
  // request hooks. Must be registered before any routes so the
  // hooks fire on every request.
  registerHttpMetrics(app, { serviceName: "compute" });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { message: "Invalid or missing token" } });
    }
  });

  await app.register(healthRoutes);
  await app.register(regionRoutes);
  await app.register(clusterRoutes);
  await app.register(jobRoutes);
  await app.register(reservationRoutes);
  await app.register(nodeReservationRoutes);
  await app.register(escrowRoutes);

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
  app.log.info({ port: cfg.PORT, host: cfg.HOST, env: cfg.NODE_ENV }, "compute service ready");
}
