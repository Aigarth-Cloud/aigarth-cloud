/**
 * /v1/mfa — multi-factor auth enrollment and verification.
 *
 *   POST /v1/mfa/totp/enroll/start          get secret + otpauth URL
 *   POST /v1/mfa/totp/enroll/finish         verify first code (enrolls)
 *   POST /v1/mfa/totp/verify                verify a code (used during login)
 *   POST /v1/mfa/webauthn/register/start    get challenge
 *   POST /v1/mfa/webauthn/register/finish   submit credential
 *   GET  /v1/mfa                            list enrolled credentials
 *   DELETE /v1/mfa/:id                      remove a credential
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  startTotpEnrollment,
  completeTotpEnrollment,
  verifyTotpForUser,
  startWebauthnRegistration,
  completeWebauthnRegistration,
  listUserMfa,
  removeMfaCredential,
  TotpEnrollStartSchema,
  TotpEnrollVerifySchema,
  WebauthnRegisterStartSchema,
  WebauthnRegisterFinishSchema,
} from "../services/mfa.js";

export async function mfaRoutes(app: FastifyInstance) {
  // ---------- TOTP ----------

  app.post(
    "/v1/mfa/totp/enroll/start",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = TotpEnrollStartSchema.safeParse(req.body ?? {});
      if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
      const result = await startTotpEnrollment(req.user.sub, parse.data);
      return reply.send(result);
    },
  );

  app.post(
    "/v1/mfa/totp/enroll/finish",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { pendingId?: string; code?: string };
      if (!body?.pendingId || !body?.code) {
        return reply.code(400).send({ error: { message: "pendingId and code required" } });
      }
      const parse = TotpEnrollVerifySchema.safeParse({ code: body.code });
      if (!parse.success) return reply.code(400).send({ error: { message: "code must be 6 digits" } });
      try {
        const cred = await completeTotpEnrollment(req.user.sub, body.pendingId, body.code);
        return reply.send({
          id: cred.id,
          type: cred.type,
          label: cred.label,
          enrolled_at: cred.lastUsedAt?.toISOString() ?? cred.createdAt.toISOString(),
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Verify failed" } });
      }
    },
  );

  // Used by the login flow (after password check) — verifies a TOTP code
  // against any of the user's enrolled TOTP credentials.
  app.post(
    "/v1/mfa/totp/verify",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { code?: string };
      if (!body?.code) return reply.code(400).send({ error: { message: "code required" } });
      const ok = await verifyTotpForUser(req.user.sub, body.code);
      if (!ok) return reply.code(401).send({ error: { message: "Invalid TOTP code" } });
      return reply.send({ ok: true });
    },
  );

  // ---------- WebAuthn ----------

  app.post(
    "/v1/mfa/webauthn/register/start",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = WebauthnRegisterStartSchema.safeParse(req.body ?? {});
      if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
      const result = await startWebauthnRegistration(req.user.sub, parse.data);
      return reply.send(result);
    },
  );

  app.post(
    "/v1/mfa/webauthn/register/finish",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = WebauthnRegisterFinishSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      const cred = await completeWebauthnRegistration(req.user.sub, parse.data);
      return reply.send({
        id: cred.id,
        type: cred.type,
        label: cred.label,
        enrolled_at: cred.createdAt.toISOString(),
      });
    },
  );

  // ---------- List / remove ----------

  app.get(
    "/v1/mfa",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const creds = await listUserMfa(req.user.sub);
      return reply.send({
        data: creds
          .filter((c) => !c.revokedAt)
          .map((c) => ({
            id: c.id,
            type: c.type,
            label: c.label,
            created_at: c.createdAt.toISOString(),
            last_used_at: c.lastUsedAt?.toISOString() ?? null,
          })),
      });
    },
  );

  app.delete(
    "/v1/mfa/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      await removeMfaCredential(req.user.sub, (req.params as { id: string }).id);
      return reply.send({ ok: true });
    },
  );
}
