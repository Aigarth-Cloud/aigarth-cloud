/**
 * /v1/nodes/escrow — read-only views into the node escrow ledger.
 *
 *   GET /v1/nodes/escrow/:reservationId/balance
 *   GET /v1/nodes/escrow/:reservationId/entries
 *
 * Auth: same JWT as the rest of /v1/nodes/*. Reads are scoped to the
 * caller's user_id (we look up the reservation and verify ownership).
 *
 * Writes (debit / credit) are NOT exposed via HTTP. They're called
 * internally by the node-reservations service during the lifecycle
 * transitions. The synthetic tx_hashes the service uses are
 * deterministic by `refund:<reservationId>:<timestamp>` and
 * `penalty:<reservationId>:<timestamp>`; idempotency holds.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { nodeReservations, type NodeEscrowDirection } from "../db/schema.js";
import {
  getEscrowBalance,
  listEscrowEntries,
} from "../services/escrow.js";

export async function escrowRoutes(app: FastifyInstance) {
  app.get(
    "/v1/nodes/escrow/:reservationId/balance",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const reservationId = (req.params as { reservationId: string }).reservationId;
      const ok = await assertOwnsReservation(req.user.sub, reservationId);
      if (!ok) return reply.code(404).send({ error: { message: "Node reservation not found" } });
      const balance = await getEscrowBalance(reservationId);
      return reply.send(serializeBalance(balance));
    },
  );

  app.get(
    "/v1/nodes/escrow/:reservationId/entries",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const reservationId = (req.params as { reservationId: string }).reservationId;
      const q = req.query as { direction?: string; limit?: string };
      const ok = await assertOwnsReservation(req.user.sub, reservationId);
      if (!ok) return reply.code(404).send({ error: { message: "Node reservation not found" } });
      const entries = await listEscrowEntries(reservationId, {
        direction: q.direction as NodeEscrowDirection | undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return reply.send({ data: entries.map(serializeEntry) });
    },
  );
}

async function assertOwnsReservation(userId: string, reservationId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: nodeReservations.id })
    .from(nodeReservations)
    .where(and(eq(nodeReservations.id, reservationId), eq(nodeReservations.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

function serializeBalance(b: Awaited<ReturnType<typeof getEscrowBalance>>) {
  return {
    reservation_id: b.reservationId,
    total_debit_qubic: b.totalDebitQubic.toString(),
    total_credit_qubic: b.totalCreditQubic.toString(),
    balance_qubic: b.balanceQubic.toString(),
  };
}

function serializeEntry(e: import("../db/schema.js").NodeEscrow) {
  return {
    id: e.id,
    reservation_id: e.reservationId,
    direction: e.direction,
    purpose: e.purpose,
    amount_qubic: e.amountQubic.toString(),
    tx_hash: e.txHash,
    rate_scaled_at_entry: e.rateScaledAtEntry?.toString() ?? null,
    yield_credit_ref: e.yieldCreditRef,
    note: e.note,
    created_at: e.createdAt.toISOString(),
  };
}
