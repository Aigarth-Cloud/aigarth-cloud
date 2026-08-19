/**
 * Health and readiness probes.
 *
 *   GET /healthz  — liveness (process is up)
 *   GET /readyz   — readiness (DB is reachable)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { getDb } from "../db/index.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "ok", service: "identity", time: new Date().toISOString() });
  });

  app.get("/readyz", async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      getDb().execute(sql`SELECT 1`);
      return reply.send({ status: "ready" });
    } catch (err) {
      return reply
        .code(503)
        .send({ status: "not_ready", error: err instanceof Error ? err.message : "unknown" });
    }
  });
}
