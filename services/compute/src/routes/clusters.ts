/**
 * /v1/compute/clusters — cluster CRUD + member management.
 *
 *   GET   /v1/compute/clusters                    list (filterable by regionId)
 *   POST  /v1/compute/clusters                    create
 *   GET   /v1/compute/clusters/:id                read one
 *   GET   /v1/compute/clusters/:id/members        list computors in cluster
 *   POST  /v1/compute/clusters/:id/members        add computor (admin)
 *   DELETE /v1/compute/clusters/:id/members/:idx  remove computor (admin)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createCluster,
  listClusters,
  getCluster,
  listClusterMembers,
  addClusterMember,
  removeClusterMember,
  CreateClusterSchema,
  AddMemberSchema,
} from "../services/clusters.js";

export async function clusterRoutes(app: FastifyInstance) {
  app.get(
    "/v1/compute/clusters",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { regionId?: string };
      const list = await listClusters({ regionId: q.regionId });
      return reply.send({ data: list.map(serialize) });
    },
  );

  app.post(
    "/v1/compute/clusters",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateClusterSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const c = await createCluster(parse.data, req.user.sub);
      return reply.code(201).send(serialize(c));
    },
  );

  app.get(
    "/v1/compute/clusters/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const c = await getCluster((req.params as { id: string }).id);
      if (!c) return reply.code(404).send({ error: { message: "Cluster not found" } });
      return reply.send(serialize(c));
    },
  );

  app.get(
    "/v1/compute/clusters/:id/members",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const clusterId = (req.params as { id: string }).id;
      const c = await getCluster(clusterId);
      if (!c) return reply.code(404).send({ error: { message: "Cluster not found" } });
      const members = await listClusterMembers(clusterId);
      return reply.send({
        cluster_id: clusterId,
        data: members.map((m) => ({
          id: m.id,
          computor_index: m.computorIndex,
          status: m.status,
          joined_at: m.joinedAt.toISOString(),
          last_heartbeat_at: m.lastHeartbeatAt.toISOString(),
        })),
      });
    },
  );

  app.post(
    "/v1/compute/clusters/:id/members",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = AddMemberSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const m = await addClusterMember(
          (req.params as { id: string }).id,
          parse.data.computorIndex,
          req.user.sub,
        );
        return reply.code(201).send({
          id: m.id,
          computor_index: m.computorIndex,
          status: m.status,
          joined_at: m.joinedAt.toISOString(),
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Add failed" } });
      }
    },
  );

  app.delete(
    "/v1/compute/clusters/:id/members/:idx",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const idx = Number((req.params as { idx: string }).idx);
      if (!Number.isInteger(idx) || idx < 0 || idx > 675) {
        return reply.code(400).send({ error: { message: "Invalid computor index" } });
      }
      await removeClusterMember((req.params as { id: string }).id, idx, req.user.sub);
      return reply.send({ ok: true });
    },
  );
}

function serialize(c: Awaited<ReturnType<typeof getCluster>>) {
  if (!c) return null;
  return {
    id: c.id,
    region_id: c.regionId,
    name: c.name,
    slug: c.slug,
    purpose: c.purpose,
    min_computors: c.minComputors,
    is_active: c.isActive,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}
