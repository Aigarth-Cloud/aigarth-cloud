/**
 * /v1/plans — public plan catalog.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listPlans, getPlan } from "../services/plans.js";

export async function planRoutes(app: FastifyInstance) {
  // Public — no auth required
  app.get("/v1/plans", async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { tier?: string };
    const all = await listPlans({ activeOnly: true });
    const filtered = q.tier ? all.filter((p) => p.tier === q.tier) : all;
    return reply.send({ data: filtered.map(serialize) });
  });

  app.get("/v1/plans/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const p = await getPlan((req.params as { id: string }).id);
    if (!p) return reply.code(404).send({ error: { message: "Plan not found" } });
    return reply.send(serialize(p));
  });
}

function serialize(p: Awaited<ReturnType<typeof getPlan>>) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tier: p.tier,
    monthly_price_qubic: p.monthlyPriceQubic.toString(),
    included_tokens: p.includedTokens.toString(),
    overage_rate_qubic_per_1k: p.overageRateQubicPer1k.toString(),
    signup_credits_qubic: p.signupCreditsQubic.toString(),
    features: p.features,
    is_active: p.isActive,
    sort_order: p.sortOrder,
  };
}
