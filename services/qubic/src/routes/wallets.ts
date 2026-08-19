/**
 * /v1/qubic/wallets — wallet link + balance reads.
 *
 *   POST  /v1/qubic/wallets                       link a wallet
 *   GET   /v1/qubic/wallets                       list user's wallets
 *   GET   /v1/qubic/wallets/:id                   read one
 *   GET   /v1/qubic/wallets/:id/balance           balance (cached 30s)
 *   POST  /v1/qubic/wallets/:id/authorize-staking  give staking consent
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  linkWallet,
  listUserWallets,
  getWallet,
  getBalance,
  authorizeStaking,
  LinkWalletSchema,
} from "../services/wallets.js";

const AuthorizeStakingSchema = z.object({
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export async function walletRoutes(app: FastifyInstance) {
  app.post(
    "/v1/qubic/wallets",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = LinkWalletSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const wallet = await linkWallet(req.user.sub, parse.data);
      return reply.code(201).send({
        id: wallet.id,
        qubic_address: wallet.qubicAddress,
        network: wallet.network,
        stake_authorized: wallet.stakeAuthorized,
        created_at: wallet.createdAt.toISOString(),
      });
    },
  );

  app.get(
    "/v1/qubic/wallets",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const wallets = await listUserWallets(req.user.sub);
      return reply.send({
        data: wallets.map((w) => ({
          id: w.id,
          qubic_address: w.qubicAddress,
          network: w.network,
          stake_authorized: w.stakeAuthorized,
          stake_authorization_expires_at: w.stakeAuthorizationExpiresAt?.toISOString() ?? null,
          created_at: w.createdAt.toISOString(),
        })),
      });
    },
  );

  app.get(
    "/v1/qubic/wallets/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const w = await getWallet(req.user.sub, (req.params as { id: string }).id);
      if (!w) return reply.code(404).send({ error: { message: "Wallet not found" } });
      return reply.send({
        id: w.id,
        qubic_address: w.qubicAddress,
        network: w.network,
        stake_authorized: w.stakeAuthorized,
        stake_authorization_expires_at: w.stakeAuthorizationExpiresAt?.toISOString() ?? null,
      });
    },
  );

  app.get(
    "/v1/qubic/wallets/:id/balance",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as { refresh?: string };
      try {
        const bal = await getBalance(req.user.sub, (req.params as { id: string }).id, {
          refresh: query.refresh === "true",
        });
        return reply.send({
          wallet_id: bal.walletId,
          balance_qubic: bal.balanceQubic.toString(),
          display: `${(Number(bal.balanceQubic) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 6 })} Qu`,
          tick_number: bal.tickNumber,
          refreshed_at: bal.refreshedAt.toISOString(),
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Read failed" } });
      }
    },
  );

  app.post(
    "/v1/qubic/wallets/:id/authorize-staking",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = AuthorizeStakingSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      const w = await authorizeStaking(req.user.sub, (req.params as { id: string }).id, parse.data);
      return reply.send({
        id: w.id,
        stake_authorized: w.stakeAuthorized,
        stake_authorization_expires_at: w.stakeAuthorizationExpiresAt?.toISOString() ?? null,
      });
    },
  );
}
