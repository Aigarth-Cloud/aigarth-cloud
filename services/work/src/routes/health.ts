/**
 * GET /healthz — service health.
 */

import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => ({
    ok: true,
    service: "work",
    time: new Date().toISOString(),
  }));
}
