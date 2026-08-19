/**
 * /v1/credits — list, redeem, validate.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  listCredits,
  redeemCoupon,
  validateCoupon,
  getUserActiveCreditTotal,
  CreateCouponSchema,
  createCoupon,
  type Credit,
} from "../services/credits.js";

const RedeemSchema = z.object({ code: z.string().min(1).max(60) });

export async function creditRoutes(app: FastifyInstance) {
  app.get(
    "/v1/credits",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const list = await listCredits(req.user.sub);
      const total = await getUserActiveCreditTotal(req.user.sub);
      return reply.send({
        active_total_qubic: total.toString(),
        data: list.map(serialize),
      });
    },
  );

  app.post(
    "/v1/credits/redeem",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = RedeemSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const credit = await redeemCoupon(req.user.sub, null, parse.data.code);
        return reply.code(201).send(serialize(credit));
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Redeem failed" } });
      }
    },
  );

  app.get(
    "/v1/coupons/validate",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { code?: string };
      if (!q.code) return reply.code(400).send({ error: { message: "code is required" } });
      const c = await validateCoupon(q.code);
      if (!c) return reply.code(404).send({ error: { message: "Coupon is not valid" } });
      return reply.send({
        code: c.code,
        name: c.name,
        kind: c.kind,
        value: c.value,
        max_redemptions: c.maxRedemptions,
        per_user_limit: c.perUserLimit,
        valid_until: c.validUntil?.toISOString() ?? null,
        status: c.status,
      });
    },
  );

  // Admin: create coupon
  app.post(
    "/v1/admin/coupons",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateCouponSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const c = await createCoupon(parse.data, req.user.sub);
      return reply.code(201).send({
        id: c.id,
        code: c.code,
        name: c.name,
        kind: c.kind,
        value: c.value,
        max_redemptions: c.maxRedemptions,
        per_user_limit: c.perUserLimit,
        valid_until: c.validUntil?.toISOString() ?? null,
        status: c.status,
      });
    },
  );
}

function serialize(c: Credit) {
  return {
    id: c.id,
    kind: c.kind,
    amount_qubic: c.amountQubic.toString(),
    used_qubic: c.usedQubic.toString(),
    remaining_qubic: (c.amountQubic - c.usedQubic).toString(),
    source: c.source,
    coupon_id: c.couponId,
    status: c.status,
    expires_at: c.expiresAt?.toISOString() ?? null,
    created_at: c.createdAt.toISOString(),
  };
}
