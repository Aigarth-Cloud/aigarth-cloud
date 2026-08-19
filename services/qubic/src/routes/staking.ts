/**
 * /v1/qubic/stakes — staking flow.
 *
 *   POST /v1/qubic/stakes/intent                create unsigned intent
 *   POST /v1/qubic/stakes/:id/submit            submit signed intent
 *   GET  /v1/qubic/stakes                       list my stakes
 *   GET  /v1/qubic/stakes/:id                   read one
 *   POST /v1/qubic/stakes/:id/cancel            cancel before broadcast
 *   POST /v1/qubic/stakes/:id/release           release after maturity
 *
 *   GET  /v1/qubic/validators                   list computors (validators)
 *   POST /v1/qubic/validators/:idx/onboard      mark validator as onboarded
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createStakeIntent,
  submitStake,
  listUserStakes,
  getStake,
  cancelStake,
  releaseStake,
  CreateStakeIntentSchema,
  SubmitStakeSchema,
} from "../services/staking.js";
import { listValidators, onboardValidator } from "../services/treasury.js";
import { getQubicClient } from "../client/index.js";

export async function stakeRoutes(app: FastifyInstance) {
  app.post(
    "/v1/qubic/stakes/intent",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateStakeIntentSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const { intent, stake } = await createStakeIntent(req.user.sub, parse.data);
        return reply.code(201).send({
          stake_id: stake.id,
          intent_hash: intent.intentHash,
          staker: intent.staker,
          receiver: intent.receiver,
          amount_qubic: intent.amountQubic.toString(),
          epochs_locked: intent.epochsLocked,
          start_epoch: intent.startEpoch,
          tick_number: intent.tickNumber,
          message: intent.message,
          instructions: "Sign the `message` with your Qubic wallet and POST the signature to /v1/qubic/stakes/:id/submit",
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
      }
    },
  );

  app.post(
    "/v1/qubic/stakes/:id/submit",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = SubmitStakeSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const result = await submitStake(req.user.sub, (req.params as { id: string }).id, parse.data);
        return reply.send({
          stake: {
            id: result.stake.id,
            status: result.stake.status,
            tx_hash: result.stake.txHash,
          },
          tx_hash: result.txHash,
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Submit failed" } });
      }
    },
  );

  app.get(
    "/v1/qubic/stakes",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { status?: string };
      const stakes = await listUserStakes(req.user.sub, { status: q.status as never });
      return reply.send({ data: stakes.map(serializeStake) });
    },
  );

  app.get(
    "/v1/qubic/stakes/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const stake = await getStake(req.user.sub, (req.params as { id: string }).id);
      if (!stake) return reply.code(404).send({ error: { message: "Stake not found" } });
      return reply.send(serializeStake(stake));
    },
  );

  app.post(
    "/v1/qubic/stakes/:id/cancel",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await cancelStake(req.user.sub, (req.params as { id: string }).id);
        return reply.send({ ok: true });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Cancel failed" } });
      }
    },
  );

  app.post(
    "/v1/qubic/stakes/:id/release",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const stake = await releaseStake(req.user.sub, (req.params as { id: string }).id);
        return reply.send(serializeStake(stake));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Release failed" } });
      }
    },
  );

  // ---------- Validators ----------

  app.get(
    "/v1/qubic/validators",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { limit?: string };
      const list = await listValidators({ limit: q.limit ? Number(q.limit) : 50 });
      return reply.send({ data: list.map(serializeValidator) });
    },
  );

  app.post(
    "/v1/qubic/validators/:idx/onboard",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const idx = Number((req.params as { idx: string }).idx);
      if (!Number.isInteger(idx) || idx < 0 || idx > 675) {
        return reply.code(400).send({ error: { message: "Invalid computor index" } });
      }
      try {
        const v = await onboardValidator(idx, req.user.sub);
        return reply.send(serializeValidator(v));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Onboard failed" } });
      }
    },
  );

  // Read-only network status — used by clients to display current tick
  app.get(
    "/v1/qubic/network/status",
    { onRequest: [app.authenticate] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const tick = await getQubicClient().getCurrentTick();
        return reply.send(tick);
      } catch (err) {
        return reply
          .code(503)
          .send({ error: { message: err instanceof Error ? err.message : "Network unreachable" } });
      }
    },
  );
}

function serializeStake(s: Awaited<ReturnType<typeof getStake>>) {
  if (!s) return null;
  return {
    id: s.id,
    wallet_id: s.walletId,
    principal_qubic: s.principalQubic.toString(),
    receiver_address: s.receiverAddress,
    start_epoch: s.startEpoch,
    epochs_locked: s.epochsLocked,
    status: s.status,
    intent_hash: s.intentHash,
    tx_hash: s.txHash,
    failure_reason: s.failureReason,
    signed_tick: s.signedTick,
    confirmed_tick: s.confirmedTick,
    created_at: s.createdAt.toISOString(),
    released_at: s.releasedAt?.toISOString() ?? null,
  };
}

function serializeValidator(v: Awaited<ReturnType<typeof listValidators>>[number]) {
  return {
    id: v.id,
    computor_index: v.computorIndex,
    qubic_address: v.qubicAddress,
    alias: v.alias,
    is_active: v.isActive,
    performance_score: v.performanceScore,
    stake_qubic: v.stakeQubic.toString(),
    last_seen_at: v.lastSeenAt?.toISOString() ?? null,
  };
}
