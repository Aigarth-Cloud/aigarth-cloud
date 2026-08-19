/**
 * Fastify server bootstrap.
 *
 * Plugins:
 *   - helmet    (security headers)
 *   - cors      (CORS allowlist from env)
 *   - cookie    (parse + set cookies)
 *   - jwt       (sign + verify access tokens)
 *
 * Routes:
 *   - /healthz, /readyz
 *   - /v1/auth/*     (public)
 *   - /v1/me         (authenticated)
 *   - /v1/orgs/*     (org management, role-gated)
 *   - /v1/api-keys/* (programmatic keys, role-gated)
 *   - /v1/mfa/*      (TOTP + WebAuthn)
 *   - /v1/wallets/*  (Qubic wallet linking)
 *   - /v1/audit-logs (org audit log)
 */

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { loadConfig } from "./config/index.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { healthRoutes } from "./routes/health.js";
import { orgRoutes } from "./routes/orgs.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { mfaRoutes } from "./routes/mfa.js";
import { walletRoutes } from "./routes/wallets.js";
import { walletAuthRoutes } from "./routes/walletAuth.js";
import { auditRoutes } from "./routes/audit.js";
import { internalRoutes } from "./routes/internal.js";
import { closeDb } from "./db/index.js";
import { eq } from "drizzle-orm";
import { getDb } from "./db/index.js";
import { sessions } from "./db/schema.js";
import { registerHttpMetrics } from "@aigarth/observability";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; jti: string; type: "access" | "refresh" };
    user: { sub: string; jti: string; type: "access" | "refresh" };
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
    bodyLimit: 1 * 1024 * 1024, // 1 MB
  });

  // Security headers
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });

  // CORS
  const origins = cfg.CORS_ORIGINS === "*" ? true : cfg.CORS_ORIGINS.split(",").map((s) => s.trim());
  await app.register(fastifyCors, {
    origin: origins,
    credentials: true,
  });

  // Cookies
  await app.register(fastifyCookie, { secret: cfg.JWT_SECRET });

  // JWT
  await app.register(fastifyJwt, {
    secret: cfg.JWT_SECRET,
    sign: { iss: cfg.JWT_ISSUER },
  });

  // Observability (Phase 13) — Prometheus-format /metrics + HTTP
  // request hooks. Must be registered before any routes so the
  // hooks fire on every request.
  registerHttpMetrics(app, { serviceName: "identity" });

  // Auth middleware: verify JWT + check the session is still active
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: { message: "Invalid or missing token" } });
    }
    if (req.user.type !== "access") {
      return reply.code(401).send({ error: { message: "Wrong token type" } });
    }
    // Session must exist and not be revoked.
    const sessionRows = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.jti, req.user.jti))
      .limit(1);
    const session = sessionRows[0];
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return reply.code(401).send({ error: { message: "Session expired or revoked" } });
    }
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(walletAuthRoutes);
  await app.register(meRoutes);
  await app.register(orgRoutes);
  await app.register(apiKeyRoutes);
  await app.register(mfaRoutes);
  await app.register(walletRoutes);
  await app.register(auditRoutes);
  await app.register(internalRoutes);

  return app;
}

export async function start() {
  const cfg = loadConfig();
  const app = await buildServer();

  // Graceful shutdown
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
  app.log.info({ port: cfg.PORT, host: cfg.HOST, env: cfg.NODE_ENV }, "identity service ready");
}
