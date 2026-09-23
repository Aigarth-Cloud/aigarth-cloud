/**
 * /v1/work/pool — global pool stats (AIGARTH-EVO-02).
 *
 *   GET /v1/work/pool   — public, read-only aggregate
 *
 *   Returns the JSON shape documented in services/pool.ts:PoolStats.
 *   The dashboard's `/evolution` page polls this every 10s while
 *   the Contribute widget is active.
 *
 *   Read-only. No auth required — pool stats are public surface.
 *   The per-worker reputation breakdown is coarse enough that it
 *   doesn't leak individual worker IPs or keys.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { poolStats } from "../services/pool.js";

export async function poolRoutes(app: FastifyInstance) {
  app.get("/v1/work/pool", async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await poolStats();
      return reply.header("Cache-Control", "public, max-age=5").send(stats);
    } catch (err) {
      return reply.code(500).send({
        error: { message: err instanceof Error ? err.message : "Pool stats failed" },
      });
    }
  });
}
