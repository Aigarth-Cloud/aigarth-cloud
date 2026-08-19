/**
 * /v1/anns/:idOrSlug/stake — Phase 20.4.
 *
 * A user stakes QUBIC for an ANN via the AigarthPool. The endpoint
 * is thin: it validates the request, calls the AigarthPool client,
 * and returns the new position.
 *
 * In simulator mode, this is a pure in-process call. In qpi mode
 * (Phase 20.6), the client signs + broadcasts the transaction.
 *
 * Auth: required. The user must have a linked Qubic wallet; the
 * wallet is the `userWallet` parameter passed to AigarthPool.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { AigarthPoolError } from "@aigarth/aigarthpool";
import { getAnn } from "../services/anns.js";
import {
  stakeForAnn,
  extendLock,
  unlock,
  claimRewards,
  getPosition,
  getYieldOwed,
} from "../services/stake.js";
import { logActivity } from "../lib/audit.js";
import { getDb } from "../db/index.js";

const StakeSchema = z.object({
  /** Qubic address (60-char A-Z) of the user staking. */
  userWallet: z.string().regex(/^[A-Z]{60}$/),
  /** Amount in Qu-bit (1 QUBIC = 1,000,000). */
  amount: z.string().regex(/^\d+$/).transform((s) => BigInt(s)),
  /** Lock duration in weeks. 1-52. */
  weeks: z.coerce.number().int().min(1).max(52),
});

const ExtendLockSchema = z.object({
  userWallet: z.string().regex(/^[A-Z]{60}$/),
  additionalWeeks: z.coerce.number().int().min(1).max(52),
});

const WalletPathSchema = z.object({
  userWallet: z.string().regex(/^[A-Z]{60}$/),
});

export async function stakeRoutes(app: FastifyInstance) {
  /**
   * POST /v1/anns/:idOrSlug/stake
   *
   * Body: { userWallet, amount, weeks }
   * Auth: required (any signed-in user).
   */
  app.post(
    "/v1/anns/:idOrSlug/stake",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      if (ann.status !== "published" && ann.status !== "draft") {
        return reply.code(400).send({ error: { message: `cannot stake for ANN in status ${ann.status}` } });
      }
      const parse = StakeSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const pos = await stakeForAnn(parse.data.userWallet, ann.id, parse.data.amount, parse.data.weeks);
        await logActivity(getDb(), {
          action: "ann.stake",
          actorUserId: req.user.sub,
          orgId: null,
          targetType: "ann",
          targetId: ann.id,
          metadata: { userWallet: parse.data.userWallet, amount: parse.data.amount.toString(), weeks: parse.data.weeks, lockUntilEpoch: pos.lockUntilEpoch },
        });
        return reply.send({
          ann_id: ann.id,
          user_wallet: parse.data.userWallet,
          amount: pos.amount.toString(),
          weeks: parse.data.weeks,
          lock_until_epoch: pos.lockUntilEpoch,
          qearn_lock_id: pos.qearnLockId,
        });
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof AigarthPoolError ? err.message : String(err) } });
      }
    },
  );

  /**
   * POST /v1/anns/:idOrSlug/extend
   * Body: { userWallet, additionalWeeks }
   */
  app.post(
    "/v1/anns/:idOrSlug/extend",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const parse = ExtendLockSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const pos = await extendLock(parse.data.userWallet, ann.id, parse.data.additionalWeeks);
        return reply.send({
          ann_id: ann.id,
          user_wallet: parse.data.userWallet,
          lock_until_epoch: pos.lockUntilEpoch,
        });
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof AigarthPoolError ? err.message : String(err) } });
      }
    },
  );

  /**
   * POST /v1/anns/:idOrSlug/unlock
   * Body: { userWallet }
   */
  app.post(
    "/v1/anns/:idOrSlug/unlock",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const parse = WalletPathSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        await unlock(parse.data.userWallet, ann.id);
        return reply.send({ ann_id: ann.id, user_wallet: parse.data.userWallet, status: "unlock_started" });
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof AigarthPoolError ? err.message : String(err) } });
      }
    },
  );

  /**
   * POST /v1/anns/:idOrSlug/claim
   * Body: { userWallet }
   */
  app.post(
    "/v1/anns/:idOrSlug/claim",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const parse = WalletPathSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const result = await claimRewards(parse.data.userWallet, ann.id);
        return reply.send({
          ann_id: ann.id,
          user_wallet: parse.data.userWallet,
          principal: result.principal.toString(),
          yield: result.yield.toString(),
        });
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof AigarthPoolError ? err.message : String(err) } });
      }
    },
  );

  /**
   * GET /v1/anns/:idOrSlug/position?userWallet=...
   * Returns the active position + owed rewards for a user, if any.
   */
  app.get(
    "/v1/anns/:idOrSlug/position",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const ann = await getAnn((req.params as { idOrSlug: string }).idOrSlug);
      if (!ann) return reply.code(404).send({ error: { message: "ANN not found" } });
      const userWallet = (req.query as { userWallet?: string }).userWallet;
      if (!userWallet || !/^[A-Z]{60}$/.test(userWallet)) {
        return reply.code(400).send({ error: { message: "userWallet query param required (60-char A-Z)" } });
      }
      const [pos, owed] = await Promise.all([
        getPosition(userWallet, ann.id),
        getYieldOwed(userWallet, ann.id),
      ]);
      return reply.send({
        ann_id: ann.id,
        user_wallet: userWallet,
        position: pos
          ? {
              amount: pos.amount.toString(),
              lock_until_epoch: pos.lockUntilEpoch,
              qearn_lock_id: pos.qearnLockId,
            }
          : null,
        yield_owed: owed
          ? {
              principal: owed.principal.toString(),
              yield: owed.yieldAmount.toString(),
              claimed: owed.claimed,
            }
          : null,
      });
    },
  );
}
