/**
 * /healthz — service health check.
 */

import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => ({
    status: "ok",
    service: "dataset",
    time: new Date().toISOString(),
  }));
}
