/**
 * /v1/tissues/:id/licenses — Phase 18E.
 *
 *   Authenticated (JWT) — owner-only:
 *     GET    /v1/tissues/:id/licenses               — list (active or all)
 *     POST   /v1/tissues/:id/licenses               — grant
 *     DELETE /v1/tissues/:id/licenses/:licenseId    — revoke (soft delete)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  grantLicense,
  revokeLicense,
  listLicenses,
  GrantLicenseSchema,
  LicenseError,
} from "../services/licenses.js";
import { getTissue, TissueNotFoundError } from "../services/tissues.js";
import { serializeTissueLicense } from "../lib/serialize.js";

const ListQuerySchema = z.object({
  include_revoked: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(false),
});

export async function licenseRoutes(app: FastifyInstance) {
  app.get(
    "/v1/tissues/:id/licenses",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tissue = await getTissue((req.params as { id: string }).id);
      if (!tissue) return reply.code(404).send({ error: { message: "Tissue not found" } });
      if (tissue.ownerUserId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "Only the owner can list licenses" } });
      }
      const parse = ListQuerySchema.safeParse(req.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid query" } });
      }
      const list = await listLicenses(tissue.id, { includeRevoked: parse.data.include_revoked });
      return reply.send({ data: list.map(serializeTissueLicense) });
    },
  );

  app.post(
    "/v1/tissues/:id/licenses",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = GrantLicenseSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const lic = await grantLicense(req.user.sub, (req.params as { id: string }).id, parse.data);
        return reply.code(201).send(serializeTissueLicense(lic));
      } catch (err) {
        if (err instanceof TissueNotFoundError) {
          return reply.code(404).send({ error: { message: err.message } });
        }
        if (err instanceof LicenseError) {
          const status = err.code === "not_authorized" ? 403 : 400;
          return reply.code(status).send({ error: { message: err.message, code: err.code } });
        }
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Grant failed" } });
      }
    },
  );

  app.delete(
    "/v1/tissues/:id/licenses/:licenseId",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const lic = await revokeLicense(
          req.user.sub,
          (req.params as { licenseId: string }).licenseId,
        );
        if (!lic) return reply.code(404).send({ error: { message: "License not found" } });
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof LicenseError && err.code === "not_authorized") {
          return reply.code(403).send({ error: { message: err.message } });
        }
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Revoke failed" } });
      }
    },
  );
}
