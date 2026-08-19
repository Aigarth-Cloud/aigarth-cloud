/**
 * /v1/keys — manage gateway API keys.
 *
 *   POST   /v1/keys         issue (returns full key once)
 *   GET    /v1/keys         list user's keys
 *   DELETE /v1/keys/:id     revoke
 *
 * Auth: JWT (from identity service) only.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  CreateApiKeySchema,
  type GatewayApiKey,
} from "../services/api-keys.js";

export async function keyRoutes(app: FastifyInstance) {
  app.post(
    "/v1/keys",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateApiKeySchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const result = await createApiKey(req.user.sub, null, parse.data);
      return reply.code(201).send({
        ...serialize(result.key),
        // Returned ONCE. Never stored. Never sent again.
        full_key: result.fullKey,
      });
    },
  );

  app.get(
    "/v1/keys",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const list = await listApiKeys(req.user.sub);
      return reply.send({ data: list.map(serialize) });
    },
  );

  app.delete(
    "/v1/keys/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await revokeApiKey(req.user.sub, (req.params as { id: string }).id);
        return reply.send({ ok: true });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Revoke failed" } });
      }
    },
  );
}

function serialize(k: GatewayApiKey) {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    secret_last4: k.secretLast4,
    scopes: k.scopes,
    status: k.status,
    rate_limit_rpm: k.rateLimitRpm,
    rate_limit_tpm: k.rateLimitTpm,
    last_used_at: k.lastUsedAt?.toISOString() ?? null,
    expires_at: k.expiresAt?.toISOString() ?? null,
    revoked_at: k.revokedAt?.toISOString() ?? null,
    revoked_reason: k.revokedReason,
    created_at: k.createdAt.toISOString(),
  };
}
