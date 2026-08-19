/**
 * /v1/qubic/treasury — multi-sig treasury movements.
 *
 *   POST   /v1/qubic/treasury/movements                  create
 *   GET    /v1/qubic/treasury/movements                  list
 *   POST   /v1/qubic/treasury/movements/:id/sign         add a signature
 *   POST   /v1/qubic/treasury/movements/:id/execute      mark executed (after broadcast)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createMovement,
  listMovements,
  signMovement,
  executeMovement,
  CreateTreasuryMovementSchema,
  SignTreasuryMovementSchema,
} from "../services/treasury.js";
import { z } from "zod";

const ExecuteSchema = z.object({ txHash: z.string().min(16).max(256) });

export async function treasuryRoutes(app: FastifyInstance) {
  app.post(
    "/v1/qubic/treasury/movements",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateTreasuryMovementSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      const m = await createMovement(parse.data, req.user.sub);
      return reply.code(201).send(serialize(m));
    },
  );

  app.get(
    "/v1/qubic/treasury/movements",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const list = await listMovements({ limit: 50 });
      return reply.send({ data: list.map(serialize) });
    },
  );

  app.post(
    "/v1/qubic/treasury/movements/:id/sign",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = SignTreasuryMovementSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const m = await signMovement((req.params as { id: string }).id, parse.data, req.user.sub);
        return reply.send(serialize(m));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Sign failed" } });
      }
    },
  );

  app.post(
    "/v1/qubic/treasury/movements/:id/execute",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ExecuteSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "txHash required" } });
      }
      try {
        const m = await executeMovement((req.params as { id: string }).id, parse.data.txHash);
        return reply.send(serialize(m));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Execute failed" } });
      }
    },
  );
}

function serialize(m: Awaited<ReturnType<typeof listMovements>>[number]) {
  return {
    id: m.id,
    kind: m.kind,
    amount_qubic: m.amountQubic.toString(),
    counterparty: m.counterparty,
    signers_approved: m.signersApproved,
    signers_required: m.signersRequired,
    tx_hash: m.txHash,
    created_at: m.createdAt.toISOString(),
    executed_at: m.executedAt?.toISOString() ?? null,
  };
}
