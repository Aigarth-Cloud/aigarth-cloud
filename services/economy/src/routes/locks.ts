/**
 * /v1/economy/locks — Qearn lock ledger (read-only here; writes come from the watcher worker).
 *
 *   GET  /v1/economy/locks                list the current user's locks
 *   GET  /v1/economy/locks/:id            read one lock
 *   GET  /v1/economy/locks/total-grant    sum of active compute-grant units for the user
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listLocksForUser,
  getLock,
  totalActiveGrantForUser,
} from "../services/locks.js";

function serializeLock(l: NonNullable<Awaited<ReturnType<typeof getLock>>>) {
  return {
    id: l.id,
    user_id: l.userId,
    wallet_address: l.walletAddress,
    qearn_lock_id: l.qearnLockId,
    lock_tx_hash: l.lockTxHash,
    unlock_tx_hash: l.unlockTxHash,
    amount_qubic: l.amountQubic.toString(),
    total_weeks: l.totalWeeks,
    start_epoch: l.startEpoch,
    start_tick: l.startTick,
    end_tick: l.endTick,
    net_reward_qubic: l.netRewardQubic.toString(),
    penalty_burned_qubic: l.penaltyBurnedQubic.toString(),
    status: l.status,
    compute_grant_units: l.computeGrantUnits.toString(),
    created_at: l.createdAt.toISOString(),
    updated_at: l.updatedAt.toISOString(),
    ended_at: l.endedAt?.toISOString() ?? null,
  };
}

export async function lockRoutes(app: FastifyInstance) {
  app.get(
    "/v1/economy/locks",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const locks = await listLocksForUser(req.user.sub);
      return reply.send({ data: locks.map(serializeLock) });
    },
  );

  app.get(
    "/v1/economy/locks/total-grant",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const total = await totalActiveGrantForUser(req.user.sub);
      return reply.send({ total_grant_units: total.toString() });
    },
  );

  app.get(
    "/v1/economy/locks/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = (req.params as { id: string }).id;
      const lock = await getLock(id);
      if (!lock) return reply.code(404).send({ error: { message: "lock not found" } });
      if (lock.userId !== req.user.sub) {
        return reply.code(403).send({ error: { message: "forbidden" } });
      }
      return reply.send(serializeLock(lock));
    },
  );
}
