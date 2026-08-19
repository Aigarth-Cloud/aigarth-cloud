/**
 * /v1/admin — platform-admin operations.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { isAdmin } from "../lib/admin.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/v1/admin/ping", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isAdmin(req.user.sub)) {
      return reply.code(403).send({ error: { message: "Admin privileges required" } });
    }
    return reply.send({ ok: true, user_id: req.user.sub });
  });
}
