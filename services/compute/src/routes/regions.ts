/**
 * /v1/compute/regions — region CRUD.
 *
 *   GET  /v1/compute/regions                list all
 *   POST /v1/compute/regions                create (admin)
 *   GET  /v1/compute/regions/:id            read one
 *   GET  /v1/compute/regions/:id/stats      cluster + computor + active job count
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createRegion,
  listRegions,
  getRegion,
  getRegionStats,
  CreateRegionSchema,
} from "../services/regions.js";

export async function regionRoutes(app: FastifyInstance) {
  app.get(
    "/v1/compute/regions",
    { onRequest: [app.authenticate] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const regions = await listRegions();
      return reply.send({ data: regions.map(serialize) });
    },
  );

  app.post(
    "/v1/compute/regions",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateRegionSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const region = await createRegion(parse.data, req.user.sub);
      return reply.code(201).send(serialize(region));
    },
  );

  app.get(
    "/v1/compute/regions/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await getRegion((req.params as { id: string }).id);
      if (!r) return reply.code(404).send({ error: { message: "Region not found" } });
      return reply.send(serialize(r));
    },
  );

  app.get(
    "/v1/compute/regions/:id/stats",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await getRegionStats((req.params as { id: string }).id);
        return reply.send({
          region: serialize(stats.region),
          cluster_count: stats.clusterCount,
          computor_count: stats.computorCount,
          active_job_count: stats.activeJobCount,
        });
      } catch (err) {
        return reply
          .code(404)
          .send({ error: { message: err instanceof Error ? err.message : "Not found" } });
      }
    },
  );
}

function serialize(r: Awaited<ReturnType<typeof getRegion>>) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    computor_count: r.computorCount,
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}
