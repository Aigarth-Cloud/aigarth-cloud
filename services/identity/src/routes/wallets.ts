/**
 * /v1/wallets — Qubic wallet linking.
 *
 *   POST /v1/wallets/link/start            get a nonce to sign
 *   POST /v1/wallets/link/finish          submit signed nonce
 *   GET  /v1/wallets                      list linked wallets
 *   DELETE /v1/wallets/:id                unlink
 *
 * IMPORTANT: The verify step is currently a format-validated stub.
 * Real Qubic signature verification (K12-based) is required before
 * production use. See src/lib/qubic.ts.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { startLink, finishLink, listWallets, unlink, StartLinkSchema, FinishLinkSchema } from "../services/wallets.js";

export async function walletRoutes(app: FastifyInstance) {
  app.post(
    "/v1/wallets/link/start",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = StartLinkSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      const result = await startLink(req.user.sub, parse.data);
      return reply.send(result);
    },
  );

  app.post(
    "/v1/wallets/link/finish",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = FinishLinkSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const { wallet, verification } = await finishLink(req.user.sub, parse.data);
        return reply.send({
          id: wallet.id,
          address: wallet.qubicAddress,
          verified_at: wallet.verifiedAt?.toISOString() ?? null,
          verification,
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Link failed" } });
      }
    },
  );

  app.get(
    "/v1/wallets",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const wallets = await listWallets(req.user.sub);
      return reply.send({
        data: wallets
          .filter((w) => !w.revokedAt)
          .map((w) => ({
            id: w.id,
            address: w.qubicAddress,
            verified_at: w.verifiedAt?.toISOString() ?? null,
            created_at: w.createdAt.toISOString(),
          })),
      });
    },
  );

  app.delete(
    "/v1/wallets/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      await unlink(req.user.sub, (req.params as { id: string }).id);
      return reply.send({ ok: true });
    },
  );
}
