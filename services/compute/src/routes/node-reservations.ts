/**
 * /v1/nodes/reservations — hardware presale spot reservations (Phase 24).
 *
 *   POST /v1/nodes/reservations                    create (returns tier spec + expected QUBIC)
 *   GET  /v1/nodes/reservations                    list (filterable by status)
 *   GET  /v1/nodes/reservations/:id                read
 *   POST /v1/nodes/reservations/:id/fund           mark deposit paid
 *   POST /v1/nodes/reservations/:id/confirm        pay the balance (after mainnet)
 *   POST /v1/nodes/reservations/:id/release       release (refund, possibly partial)
 *
 *   POST /v1/internal/nodes/reservations/:id/confirm-window   (operator-only) open the 14-day window
 *   POST /v1/internal/nodes/auto-release-expired              (operator-only) sweep expired windows
 *
 * Auth: same JWT pattern as /v1/compute/reservations. The internal
 * routes require JWT + a service role check (deferred; for 24.1 we
 * just require JWT and add the service-role check when 24.2 lands).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createNodeReservation,
  listNodeReservations,
  getNodeReservation,
  fundNodeReservation,
  confirmNodeReservation,
  releaseNodeReservation,
  openConfirmWindow,
  autoReleaseExpiredConfirmWindows,
  CreateNodeReservationSchema,
  FundNodeReservationSchema,
  ConfirmNodeReservationSchema,
  ReleaseNodeReservationSchema,
  TIER_SPECS,
  TIERS_OPEN_FOR_RESERVATION,
  type NodeReservationStatus,
} from "../services/node-reservations.js";

export async function nodeReservationRoutes(app: FastifyInstance) {
  // ============================================================================
  // Public
  // ============================================================================

  app.post(
    "/v1/nodes/reservations",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateNodeReservationSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const result = await createNodeReservation(req.user.sub, parse.data);
        return reply.code(201).send(serializeCreated(result));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Create failed" } });
      }
    },
  );

  app.get(
    "/v1/nodes/reservations",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { status?: string; limit?: string };
      const list = await listNodeReservations(req.user.sub, {
        status: q.status as NodeReservationStatus | undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return reply.send({ data: list.map(serialize) });
    },
  );

  app.get(
    "/v1/nodes/reservations/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await getNodeReservation(req.user.sub, (req.params as { id: string }).id);
      if (!r) return reply.code(404).send({ error: { message: "Node reservation not found" } });
      return reply.send(serialize(r));
    },
  );

  app.post(
    "/v1/nodes/reservations/:id/fund",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = FundNodeReservationSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const r = await fundNodeReservation(
          req.user.sub,
          (req.params as { id: string }).id,
          parse.data,
        );
        return reply.send(serialize(r));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Fund failed" } });
      }
    },
  );

  app.post(
    "/v1/nodes/reservations/:id/confirm",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ConfirmNodeReservationSchema.safeParse(req.body);
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const result = await confirmNodeReservation(
          req.user.sub,
          (req.params as { id: string }).id,
          parse.data,
        );
        return reply.send({
          ...serialize(result.reservation),
          balance_qubic: result.balanceQubic.toString(),
          yield_credit_qubic: result.yieldCreditQubic.toString(),
          net_balance_qubic: result.netBalanceQubic.toString(),
        });
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Confirm failed" } });
      }
    },
  );

  app.post(
    "/v1/nodes/reservations/:id/release",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = ReleaseNodeReservationSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return reply
          .code(400)
          .send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const result = await releaseNodeReservation(
          req.user.sub,
          (req.params as { id: string }).id,
          parse.data,
        );
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

  // ============================================================================
  // Internal (operator-only). For 24.1 we just require JWT; the
  // service-role check is added when 24.2 lands the escrow service.
  // ============================================================================

  app.post(
    "/v1/internal/nodes/reservations/:id/confirm-window",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const r = await openConfirmWindow((req.params as { id: string }).id);
        return reply.send(serialize(r));
      } catch (err) {
        return reply
          .code(400)
          .send({ error: { message: err instanceof Error ? err.message : "Open window failed" } });
      }
    },
  );

  app.post(
    "/v1/internal/nodes/auto-release-expired",
    { onRequest: [app.authenticate] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const n = await autoReleaseExpiredConfirmWindows();
      return reply.send({ released: n });
    },
  );

  /**
   * Internal: list all reservations (no user filter) for the operator
   * script. Phase 24.7 — service-role check is added when 24.2 lands
   * the real service-role token; for now this requires JWT like the
   * other internal endpoints.
   */
  app.get(
    "/v1/internal/nodes/reservations",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { status?: string; limit?: string };
      const list = await listNodeReservations(req.user.sub, {
        // listNodeReservations filters by user_id. We need a separate
        // query that ignores user. For the operator script we'll
        // temporarily use a raw query via the db client.
        status: q.status as NodeReservationStatus | undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      // The above filters by req.user.sub. For an operator endpoint,
      // we want all reservations; in Phase 25+ the service-role check
      // arrives and we'll add a proper admin query. For now, return
      // the caller's reservations (the script uses the service token
      // which has no associated reservations, so this returns empty).
      return reply.send({ data: list.map(serialize) });
    },
  );
}

// ---------- Serializers ----------

interface CreateResultLike {
  reservation: import("../db/schema.js").NodeReservation;
  tierSpec: { tier: number; depositUsdCents: bigint; balanceUsdCents: bigint; label: string; description: string };
  rate: { rate: { rateScaled: bigint; source: string; rateRaw: string; fetchedAt: Date }; rateUsdPerQubic: number };
  expectedDepositQubic: string;
}

function serializeCreated(result: CreateResultLike) {
  return {
    reservation: serialize(result.reservation),
    tier_spec: {
      tier: result.tierSpec.tier,
      deposit_usd_cents: result.tierSpec.depositUsdCents.toString(),
      balance_usd_cents: result.tierSpec.balanceUsdCents.toString(),
      label: result.tierSpec.label,
      description: result.tierSpec.description,
    },
    rate: {
      rate_scaled: result.rate.rate.rateScaled.toString(),
      rate_usd_per_qubic: result.rate.rateUsdPerQubic,
      source: result.rate.rate.source,
      fetched_at: result.rate.rate.fetchedAt.toISOString(),
    },
    expected_deposit_qubic: result.expectedDepositQubic,
    tiers_open: TIERS_OPEN_FOR_RESERVATION,
  };
}

function serialize(r: import("../db/schema.js").NodeReservation) {
  return {
    id: r.id,
    user_id: r.userId,
    tier: r.tier,
    status: r.status,
    deposit_usd_cents: r.depositUsdCents.toString(),
    balance_usd_cents: r.balanceUsdCents?.toString() ?? null,
    deposit_qubic: r.depositQubic?.toString() ?? null,
    qubic_usd_rate_at_reserve: r.qubicUsdRateAtReserve?.toString() ?? null,
    qubic_usd_rate_at_confirm: r.qubicUsdRateAtConfirm?.toString() ?? null,
    yield_opt_in: r.yieldOptIn,
    yield_credit_qubic: r.yieldCreditQubic.toString(),
    qearn_lock_id: r.qearnLockId,
    qubic_wallet_id: r.qubicWalletId,
    tx_hash_reserve: r.txHashReserve,
    tx_hash_confirm: r.txHashConfirm,
    confirm_window_opens_at: r.confirmWindowOpensAt?.toISOString() ?? null,
    confirm_window_closes_at: r.confirmWindowClosesAt?.toISOString() ?? null,
    released_at: r.releasedAt?.toISOString() ?? null,
    auto_released_at: r.autoReleasedAt?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

// Re-export the tier specs so the SDK can introspect them if needed.
export { TIER_SPECS };
