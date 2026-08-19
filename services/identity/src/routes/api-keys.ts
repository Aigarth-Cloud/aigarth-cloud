/**
 * /v1/api-keys — long-lived programmatic keys.
 *
 *   GET    /v1/api-keys                  list (org context from header)
 *   POST   /v1/api-keys                  issue (returns secret ONCE)
 *   POST   /v1/api-keys/:id/rotate       rotate (issues new, marks old rotated)
 *   DELETE /v1/api-keys/:id              revoke
 *
 * The org context comes from a header `X-Org-Id` since the user may
 * belong to multiple orgs. The route verifies the user has admin+
 * in that org before doing anything.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  issueApiKey,
  listApiKeys,
  rotateApiKey,
  revokeApiKey,
  CreateApiKeySchema,
  RotateApiKeySchema,
  RevokeApiKeySchema,
} from "../services/api-keys.js";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { memberships } from "../db/schema.js";

/** Resolve the orgId from a header or a body field, and verify membership. */
async function resolveOrg(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<{ orgId: string; role: "owner" | "admin" | "member" | "viewer" } | null> {
  const orgId = (req.headers["x-org-id"] as string | undefined) ?? (req.body as { orgId?: string })?.orgId;
  if (!orgId) {
    reply.code(400).send({ error: { message: "X-Org-Id header required" } });
    return null;
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, req.user.sub), eq(memberships.orgId, orgId)))
    .limit(1);
  const mem = rows[0];
  if (!mem || mem.removedAt) {
    reply.code(404).send({ error: { message: "Org not found" } });
    return null;
  }
  return { orgId, role: mem.role };
}

export async function apiKeyRoutes(app: FastifyInstance) {
  // ---------- List ----------

  app.get(
    "/v1/api-keys",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ctx = await resolveOrg(req, reply);
      if (!ctx) return;
      if (ctx.role === "viewer") {
        return reply.code(403).send({ error: { message: "Viewers cannot list API keys" } });
      }
      const keys = await listApiKeys(ctx.orgId);
      return reply.send({ data: keys });
    },
  );

  // ---------- Issue ----------

  app.post(
    "/v1/api-keys",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ctx = await resolveOrg(req, reply);
      if (!ctx) return;
      if (ctx.role !== "owner" && ctx.role !== "admin") {
        return reply.code(403).send({ error: { message: "Admin or owner required" } });
      }
      const parse = CreateApiKeySchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const issued = await issueApiKey(ctx.orgId, req.user.sub, parse.data);
      // Return the secret ONCE. Caller must store it.
      return reply.code(201).send({
        id: issued.id,
        prefix: issued.prefix,
        secret: issued.secret,
        name: issued.name,
        scopes: issued.scopes,
        expires_at: issued.expiresAt?.toISOString() ?? null,
        created_at: issued.createdAt.toISOString(),
        warning: "Store the secret now. It will not be shown again.",
      });
    },
  );

  // ---------- Rotate ----------

  app.post(
    "/v1/api-keys/:id/rotate",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ctx = await resolveOrg(req, reply);
      if (!ctx) return;
      if (ctx.role !== "owner" && ctx.role !== "admin") {
        return reply.code(403).send({ error: { message: "Admin or owner required" } });
      }
      const parse = RotateApiKeySchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const issued = await rotateApiKey(
          ctx.orgId,
          (req.params as { id: string }).id,
          parse.data,
          req.user.sub,
        );
        return reply.send({
          id: issued.id,
          prefix: issued.prefix,
          secret: issued.secret,
          name: issued.name,
          warning: "Store the new secret. It will not be shown again. The old key is now marked rotated.",
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Rotate failed" } });
      }
    },
  );

  // ---------- Revoke ----------

  app.delete(
    "/v1/api-keys/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ctx = await resolveOrg(req, reply);
      if (!ctx) return;
      if (ctx.role !== "owner" && ctx.role !== "admin") {
        return reply.code(403).send({ error: { message: "Admin or owner required" } });
      }
      const parse = RevokeApiKeySchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "reason required" } });
      }
      try {
        await revokeApiKey(ctx.orgId, (req.params as { id: string }).id, parse.data, req.user.sub);
        return reply.send({ ok: true });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Revoke failed" } });
      }
    },
  );
}
