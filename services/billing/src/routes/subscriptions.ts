/**
 * /v1/subscriptions — user's subscriptions.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  subscribe,
  changePlan,
  setCancelAtPeriodEnd,
  cancelImmediately,
  listSubscriptions,
  getSubscription,
  SubscribeSchema,
  ChangePlanSchema,
  type Subscription,
} from "../services/subscriptions.js";

export async function subscriptionRoutes(app: FastifyInstance) {
  app.post(
    "/v1/subscriptions",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = SubscribeSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const sub = await subscribe(req.user.sub, null, parse.data);
        return reply.code(201).send(serialize(sub));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Subscribe failed" } });
      }
    },
  );

  app.get(
    "/v1/subscriptions",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { status?: string };
      const list = await listSubscriptions(req.user.sub, { status: q.status as never });
      return reply.send({ data: list.map(serialize) });
    },
  );

  app.get(
    "/v1/subscriptions/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const s = await getSubscription(req.user.sub, (req.params as { id: string }).id);
      if (!s) return reply.code(404).send({ error: { message: "Subscription not found" } });
      return reply.send(serialize(s));
    },
  );

  app.patch(
    "/v1/subscriptions/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ChangePlanSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const s = await changePlan(req.user.sub, (req.params as { id: string }).id, parse.data);
        return reply.send(serialize(s));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Change failed" } });
      }
    },
  );

  app.post(
    "/v1/subscriptions/:id/cancel",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const s = await cancelImmediately(req.user.sub, (req.params as { id: string }).id);
        return reply.send(serialize(s));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Cancel failed" } });
      }
    },
  );

  app.post(
    "/v1/subscriptions/:id/cancel-at-period-end",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const s = await setCancelAtPeriodEnd(req.user.sub, (req.params as { id: string }).id);
        return reply.send(serialize(s));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Failed" } });
      }
    },
  );
}

function serialize(s: Subscription) {
  return {
    id: s.id,
    user_id: s.userId,
    plan_id: s.planId,
    status: s.status,
    payment_method: s.paymentMethod,
    trial_ends_at: s.trialEndsAt?.toISOString() ?? null,
    current_period_start: s.currentPeriodStart.toISOString(),
    current_period_end: s.currentPeriodEnd.toISOString(),
    cancel_at_period_end: s.cancelAtPeriodEnd,
    cancelled_at: s.cancelledAt?.toISOString() ?? null,
    qubic_wallet_id: s.qubicWalletId,
    started_at: s.startedAt.toISOString(),
  };
}
