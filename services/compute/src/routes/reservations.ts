/**
 * /v1/compute/reservations — capacity reservations.
 *
 *   POST /v1/compute/reservations             create
 *   GET  /v1/compute/reservations             list (filterable by status)
 *   GET  /v1/compute/reservations/:id         read
 *   POST /v1/compute/reservations/:id/release release (early; partial refund)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createReservation,
  listReservations,
  getReservation,
  releaseReservation,
  CreateReservationSchema,
  type ReservationStatus,
} from "../services/reservations.js";

export async function reservationRoutes(app: FastifyInstance) {
  app.post(
    "/v1/compute/reservations",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateReservationSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const r = await createReservation(req.user.sub, parse.data);
        return reply.code(201).send(serialize(r));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
      }
    },
  );

  app.get(
    "/v1/compute/reservations",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { status?: string; limit?: string };
      const list = await listReservations(req.user.sub, {
        status: q.status as ReservationStatus | undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return reply.send({ data: list.map(serialize) });
    },
  );

  app.get(
    "/v1/compute/reservations/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await getReservation(req.user.sub, (req.params as { id: string }).id);
      if (!r) return reply.code(404).send({ error: { message: "Reservation not found" } });
      return reply.send(serialize(r));
    },
  );

  app.post(
    "/v1/compute/reservations/:id/release",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await releaseReservation(req.user.sub, (req.params as { id: string }).id);
        return reply.send({
          ...serialize(result.reservation),
          refund_qubic: result.refundQubic.toString(),
          penalty_qubic: result.penaltyQubic.toString(),
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Release failed" } });
      }
    },
  );
}

function serialize(r: Awaited<ReturnType<typeof getReservation>>) {
  if (!r) return null;
  return {
    id: r.id,
    principal_qubic: r.principalQubic.toString(),
    credit_qubic: r.creditQubic.toString(),
    used_qubic: r.usedQubic.toString(),
    remaining_qubic: (r.creditQubic - r.usedQubic).toString(),
    fee_bps: r.feeBps,
    epochs: r.epochs,
    start_epoch: r.startEpoch,
    end_epoch: r.endEpoch,
    status: r.status,
    tx_hash: r.txHash,
    qubic_wallet_id: r.qubicWalletId,
    released_at: r.releasedAt?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}
