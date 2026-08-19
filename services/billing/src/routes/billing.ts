/**
 * /v1/billing — aggregate usage + payments.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getGatewayUsage, getComputeUsage } from "../services/usage.js";
import { getTissueUsage } from "../services/tissueUsage.js";
import { listPayments } from "../services/payments.js";
import { previewInvoice } from "../services/invoices.js";
import { listSubscriptions } from "../services/subscriptions.js";
import { type Payment } from "../db/schema.js";
import { extractJwt } from "../lib/auth.js";

export async function billingRoutes(app: FastifyInstance) {
  // Aggregated current-period usage
  app.get(
    "/v1/billing/usage",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const subs = await listSubscriptions(req.user.sub);
      const sub = subs[0];
      const since = sub?.currentPeriodStart;
      const jwt = extractJwt(req);
      const [gateway, compute, tissue] = await Promise.all([
        getGatewayUsage(req.user.sub, jwt, since),
        getComputeUsage(req.user.sub, jwt, since),
        getTissueUsage(req.user.sub, since),
      ]);
      const total =
        gateway.totalCostQubic + compute.totalSpentQubic + tissue.totalCostQubic;
      return reply.send({
        period_start: since?.toISOString() ?? null,
        gateway: serializeGateway(gateway),
        compute: serializeCompute(compute),
        tissue: serializeTissue(tissue),
        total_cost_qubic: total.toString(),
      });
    },
  );

  // Upcoming invoice preview for a subscription
  app.get(
    "/v1/billing/upcoming",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { subscriptionId?: string };
      if (!q.subscriptionId) {
        return reply.code(400).send({ error: { message: "subscriptionId is required" } });
      }
      const jwt = extractJwt(req);
      const preview = await previewInvoice(req.user.sub, jwt, q.subscriptionId);
      if (!preview) return reply.code(404).send({ error: { message: "Subscription not found" } });
      return reply.send(bigIntsToStrings(preview));
    },
  );

  // Payment history
  app.get(
    "/v1/payments",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const list = await listPayments(req.user.sub);
      return reply.send({ data: list.map(serializePayment) });
    },
  );
}

function serializeGateway(g: Awaited<ReturnType<typeof getGatewayUsage>>) {
  return {
    source: g.source,
    total_requests: g.totalRequests,
    total_tokens: g.totalTokens,
    prompt_tokens: g.promptTokens,
    completion_tokens: g.completionTokens,
    total_cost_qubic: g.totalCostQubic.toString(),
    by_model: g.byModel.map((m) => ({ ...m, cost: m.cost.toString() })),
    by_endpoint: g.byEndpoint.map((e) => ({ ...e, cost: e.cost.toString() })),
  };
}

function serializeCompute(c: Awaited<ReturnType<typeof getComputeUsage>>) {
  return {
    source: c.source,
    total_jobs: c.totalJobs,
    active_jobs: c.activeJobs,
    completed_jobs: c.completedJobs,
    failed_jobs: c.failedJobs,
    cancelled_jobs: c.cancelledJobs,
    total_spent_qubic: c.totalSpentQubic.toString(),
  };
}

function serializeTissue(t: Awaited<ReturnType<typeof getTissueUsage>>) {
  return {
    source: t.source,
    total_decisions: t.totalDecisions,
    total_cost_qubic: t.totalCostQubic.toString(),
    by_tissue: t.byTissue.map((x) => ({
      tissue_slug: x.tissueSlug,
      decisions: x.decisions,
      cost_qubic: x.costQubic.toString(),
    })),
    by_state: t.byState,
  };
}

function serializePayment(p: Payment) {
  return {
    id: p.id,
    invoice_id: p.invoiceId,
    method: p.method,
    status: p.status,
    amount_qubic: p.amountQubic.toString(),
    tx_hash: p.txHash,
    credit_id: p.creditId,
    external_id: p.externalId,
    failure_reason: p.failureReason,
    paid_at: p.paidAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
  };
}

function bigIntsToStrings<T>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = typeof v === "bigint" ? v.toString() : v;
  }
  return out;
}
