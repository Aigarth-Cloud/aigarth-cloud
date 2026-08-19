/**
 * /v1/admin/anns — platform-admin operations.
 *
 * Auth: JWT + ANN_ADMIN_USER_IDS env var check.
 * Real impl: global is_admin flag in services/identity. Tracked in TODO.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  suspendAnn,
  restoreAnn,
  adminDeprecateAnn,
  getAnn,
} from "../services/anns.js";
import { isAdmin } from "../lib/admin.js";
import { serializeAnn } from "../lib/serialize.js";

const AdminActionSchema = z.object({
  reason: z.string().max(2_000).optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.post(
    "/v1/admin/anns/:id/suspend",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!isAdmin(req.user.sub)) {
        return reply.code(403).send({ error: { message: "Admin privileges required" } });
      }
      const ann = await getAnn((req.params as { id: string }).id);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const parse = AdminActionSchema.safeParse(req.body ?? {});
      const reason = parse.success ? parse.data.reason : undefined;
      const updated = await suspendAnn(req.user.sub, ann.id, reason);
      return reply.send(serializeAnn(updated!));
    },
  );

  app.post(
    "/v1/admin/anns/:id/restore",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!isAdmin(req.user.sub)) {
        return reply.code(403).send({ error: { message: "Admin privileges required" } });
      }
      const updated = await restoreAnn(req.user.sub, (req.params as { id: string }).id);
      if (!updated) return reply.code(404).send({ error: { message: "ANN not found" } });
      return reply.send(serializeAnn(updated));
    },
  );

  app.post(
    "/v1/admin/anns/:id/force-deprecate",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!isAdmin(req.user.sub)) {
        return reply.code(403).send({ error: { message: "Admin privileges required" } });
      }
      const ann = await getAnn((req.params as { id: string }).id);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const parse = AdminActionSchema.safeParse(req.body ?? {});
      const reason = parse.success ? parse.data.reason : undefined;
      const updated = await adminDeprecateAnn(req.user.sub, ann.id, reason);
      return reply.send(serializeAnn(updated!));
    },
  );
}
