/**
 * Qubic service — Fastify server bootstrap.
 *
 * Routes:
 *   - /healthz, /readyz
 *   - /v1/qubic/wallets/*   (link, list, balance, authorize-staking)
 *   - /v1/qubic/stakes/*    (intent, submit, list, cancel, release)
 *   - /v1/qubic/validators  (list, onboard)
 *   - /v1/qubic/treasury/*  (movements CRUD + sign + execute)
 *   - /v1/qubic/network/status
 *
 * Auth: same JWT_SECRET as the identity service. We don't sign tokens
 * here (the identity service does). We verify the bearer + check the
 * session is active (via the same shape — but the Qubic service uses
 * its own sessions table; for now we trust the JWT and skip session
 * row checks; Phase 7 gateway will do that).
 */

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { loadConfig } from "./config/index.js";
import { healthRoutes } from "./routes/health.js";
import { walletRoutes } from "./routes/wallets.js";
import { stakeRoutes } from "./routes/staking.js";
import { treasuryRoutes } from "./routes/treasury.js";
import { closeDb } from "./db/index.js";
import { registerHttpMetrics } from "@aigarth/observability";
import { registerQearnMetrics } from "./lib/qearn_metrics.js";
import { seedDevDefaults } from "./db/seed.js";

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
  const metricsHandle = registerHttpMetrics(app, { serviceName: "qubic" });
  // Qearn business metrics (Phase 13.1) — count of events observed
  // by kind, sourced from the qubic_qearn_events mirror table on
  // each /metrics scrape.
  const qearnHandle = registerQearnMetrics(metricsHandle.registry, app.log);
  // Refresh the Qearn gauge right before each /metrics scrape so
  // dashboards see the latest count without waiting for the
  // next periodic refresh.
  app.addHook("onRequest", async (req) => {
    if (req.routeOptions?.url === "/metrics") {
      await qearnHandle.refresh();
    }
  });

  // Auth: verify JWT only (no session-table check; identity service owns sessions)
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { message: "Invalid or missing token" } });
    }
  });

  await app.register(healthRoutes);
  await app.register(walletRoutes);
  await app.register(stakeRoutes);
  await app.register(treasuryRoutes);

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
  // Dev seed: idempotent, runs in development only. Gives the demo
  // a stable treasury address, showcase validator aliases, and the
  // Qearn contract entry so dashboard alias lookups work out of the box.
  if (cfg.NODE_ENV === "development") {
    try {
      await seedDevDefaults();
      app.log.info("dev seed applied (treasury + showcase validators + Qearn contract)");
    } catch (err) {
      app.log.warn({ err }, "dev seed failed (non-fatal)");
    }
  }
  await app.listen({ port: cfg.PORT, host: cfg.HOST });
  app.log.info({ port: cfg.PORT, host: cfg.HOST, env: cfg.NODE_ENV }, "qubic service ready");
}
