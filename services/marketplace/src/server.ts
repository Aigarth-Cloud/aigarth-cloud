/**
 * Marketplace service — Fastify server bootstrap.
 */

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { loadConfig } from "./config/index.js";
import { healthRoutes } from "./routes/health.js";
import { listingRoutes } from "./routes/listings.js";
import { offerRoutes } from "./routes/offers.js";
import { auctionRoutes } from "./routes/auctions.js";
import { reviewRoutes } from "./routes/reviews.js";
import { meRoutes } from "./routes/me.js";
import { adminRoutes } from "./routes/admin.js";
import { tissueListingRoutes } from "./routes/tissueListings.js";
import { organismListingRoutes } from "./routes/organismListings.js";
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
  registerHttpMetrics(app, { serviceName: "marketplace" });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { message: "Invalid or missing token" } });
    }
  });

  // Global write-method rate limiter
  const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const writeBuckets = new Map<string, { count: number; resetAt: number }>();
  const WRITE_LIMIT = 60;
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
        error: { message: `Rate limit exceeded. Max ${WRITE_LIMIT} writes per ${WRITE_WINDOW_MS / 1000}s.` },
      });
      return reply;
    }
  });

  await app.register(healthRoutes);
  await app.register(listingRoutes);
  await app.register(offerRoutes);
  await app.register(auctionRoutes);
  await app.register(reviewRoutes);
  await app.register(meRoutes);
  await app.register(adminRoutes);
  await app.register(tissueListingRoutes);
  await app.register(organismListingRoutes);

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
  app.log.info({ port: cfg.PORT, host: cfg.HOST, env: cfg.NODE_ENV }, "marketplace service ready");
}
