/**
 * Health endpoints for the Economy service.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "drizzle-orm";
import { getDb } from "../db/index.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "ok", service: "economy", time: new Date().toISOString() });
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
