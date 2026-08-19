/**
 * /v1/economy/payouts — payout run assembly + settlement.
 *
 *   POST /v1/economy/payouts/assemble   assemble a payout_run for an ANN over a period
 *   POST /v1/economy/payouts/:id/settle settle a pending/partial run (loops recipients, calls services/qubic)
 *   GET  /v1/economy/payouts/:id       read a run with its recipients
 *   GET  /v1/economy/payouts?annId=…   list runs for an ANN
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  assemblePayout,
  settleRun,
  getRun,
  listRunsForAnn,
  PayoutError,
} from "../services/payouts.js";

const AssembleSchema = z.object({
  annId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalRevenueQubic: z.string().regex(/^[0-9]+$/),
  platformFeeBps: z.number().int().min(0).max(10_000).optional(),
  sourceUsageRecordIds: z.array(z.string()).optional(),
});

function serializeRun(r: NonNullable<Awaited<ReturnType<typeof getRun>>>) {
  return {
    id: r.id,
    ann_id: r.annId,
    period_start: r.periodStart.toISOString(),
    period_end: r.periodEnd.toISOString(),
    total_revenue_qubic: r.totalRevenueQubic.toString(),
    platform_fee_qubic: r.platformFeeQubic.toString(),
    net_to_contributors_qubic: r.netToContributorsQubic.toString(),
    platform_fee_bps: r.platformFeeBps,
    status: r.status,
    source_usage_record_ids: r.sourceUsageRecordIds,
    created_at: r.createdAt.toISOString(),
    settled_at: r.settledAt?.toISOString() ?? null,
    cancelled_at: r.cancelledAt?.toISOString() ?? null,
    failure_reason: r.failureReason,
  };
}

export async function payoutRoutes(app: FastifyInstance) {
  app.post(
    "/v1/economy/payouts/assemble",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = AssembleSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const { run, recipients } = await assemblePayout({
          annId: parse.data.annId,
          periodStart: new Date(parse.data.periodStart),
          periodEnd: new Date(parse.data.periodEnd),
          totalRevenueQubic: BigInt(parse.data.totalRevenueQubic),
          platformFeeBps: parse.data.platformFeeBps,
          sourceUsageRecordIds: parse.data.sourceUsageRecordIds,
        });
        return reply.code(201).send({
          run: serializeRun(run),
          recipients: recipients.map((r) => ({
            id: r.id,
            user_id: r.userId,
            bps: r.bps,
            amount_qubic: r.amountQubic.toString(),
            status: r.status,
          })),
        });
      } catch (err) {
        if (err instanceof PayoutError) {
          return reply.code(400).send({ error: { message: err.message, code: err.code } });
        }
        throw err;
      }
    },
  );

  app.post(
    "/v1/economy/payouts/:id/settle",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = (req.params as { id: string }).id;
      try {
        const { run, recipients } = await settleRun(id);
        return reply.send({
          run: serializeRun(run),
          recipients: recipients.map((r) => ({
            id: r.id,
            user_id: r.userId,
            wallet_address: r.walletAddress,
            bps: r.bps,
            amount_qubic: r.amountQubic.toString(),
            status: r.status,
            tx_hash: r.txHash,
            failure_reason: r.failureReason,
          })),
        });
      } catch (err) {
        if (err instanceof PayoutError) {
          return reply.code(400).send({ error: { message: err.message, code: err.code } });
        }
        throw err;
      }
    },
  );

  app.get(
    "/v1/economy/payouts/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = (req.params as { id: string }).id;
      const run = await getRun(id);
      if (!run) return reply.code(404).send({ error: { message: "payout run not found" } });
      return reply.send(serializeRun(run));
    },
  );

  app.get(
    "/v1/economy/payouts",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const annId = (req.query as Record<string, string | undefined>)["annId"];
      if (!annId) return reply.code(400).send({ error: { message: "annId is required" } });
      const runs = await listRunsForAnn(annId);
      return reply.send({ data: runs.map(serializeRun) });
    },
  );
}
