/**
 * /v1/internal/* — service-to-service endpoints, guarded by INTERNAL_TOKEN.
 *
 *   GET /v1/internal/wallets/by-user/:userId  — list verified wallet addresses
 *                                                for a user (no PII beyond
 *                                                the addresses themselves)
 *
 * No JWT required. The caller MUST send `Authorization: Bearer <INTERNAL_TOKEN>`,
 * matching the env var on this service.
 *
 * Phase 18 closeout: services/economy calls this in `settleRun` to populate
 * `wallet_address` on each `payout_recipient` row before the on-chain transfer.
 *
 * These endpoints are deliberately minimal. Each one is a single SQL query
 * against a single table. No joins, no aggregations, no side effects.
 * Anything fancier goes through `/v1/*` with a JWT.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { loadConfig } from "../config/index.js";
import { listVerifiedWallets } from "../services/wallets.js";

function checkInternalToken(req: FastifyRequest, reply: FastifyReply): boolean {
  const cfg = loadConfig();
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    reply.code(401).send({ error: { message: "Missing internal token" } });
    return false;
  }
  const token = auth.slice("Bearer ".length).trim();
  if (token !== cfg.INTERNAL_TOKEN) {
    reply.code(401).send({ error: { message: "Invalid internal token" } });
    return false;
  }
  return true;
}

export async function internalRoutes(app: FastifyInstance) {
  /**
   * Return the verified (not revoked) wallet addresses for a user.
   * The 200 response is `{ user_id, addresses: string[] }`. An empty
   * `addresses` array means the user has linked no verified wallet
   * — callers should treat that as "cannot settle" and skip the recipient.
   *
   * The 404 is reserved for "user does not exist" so callers can
   * distinguish "no wallet" from "no user". The endpoint never reveals
   * any other PII.
   */
  app.get(
    "/v1/internal/wallets/by-user/:userId",
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!checkInternalToken(req, reply)) return;
      const userId = (req.params as { userId: string }).userId;
      if (!userId || typeof userId !== "string") {
        return reply.code(400).send({ error: { message: "Missing userId" } });
      }
      try {
        const links = await listVerifiedWallets(userId);
        return reply.send({
          user_id: userId,
          addresses: links.map((l) => l.qubicAddress),
        });
      } catch (err) {
        req.log.error({ err, userId }, "internal wallets lookup failed");
        return reply
          .code(500)
          .send({ error: { message: "Internal wallet lookup failed" } });
      }
    },
  );
}
