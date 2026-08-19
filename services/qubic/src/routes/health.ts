/**
 * Health endpoints for the Qubic service.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { getQubicClient } from "../client/index.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "ok", service: "qubic", time: new Date().toISOString() });
  });

  app.get("/readyz", async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      getDb().execute(sql`SELECT 1`);
      // Also try to ping the Qubic client (graceful if it fails in dev)
      const client = getQubicClient();
      const ping = await client.ping();
      return reply.send({ status: "ready", qubic: ping });
    } catch (err) {
      return reply
        .code(503)
        .send({ status: "not_ready", error: err instanceof Error ? err.message : "unknown" });
    }
  });
}
