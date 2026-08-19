/**
 * /v1/aigarthpool/governance/* — Phase 22 (M1+M2).
 *
 * Admin endpoints for the AigarthPool multi-sig governance. All
 * endpoints are JWT-authenticated; the actual signer authorization
 * is enforced by the AigarthPool client (caller must be a current
 * signer to submit / approve; execute is open once threshold is
 * met).
 *
 * Endpoints:
 *   GET  /v1/aigarthpool/governance/state                 — full governance state
 *   POST /v1/aigarthpool/governance/init                  — one-time init (deploy)
 *   POST /v1/aigarthpool/governance/treasury-transfer     — submit | approve | execute
 *   POST /v1/aigarthpool/governance/signer-change        — submit | approve | execute
 *
 * Each "submit / approve / execute" endpoint is a single route
 * with a discriminated body (kind field) so the client can pick
 * the action in one HTTP call.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { AigarthPoolError } from "@aigarth/aigarthpool";
import { logActivity } from "../lib/audit.js";
import { getDb } from "../db/index.js";
import {
  initGovernance,
  submitTreasuryTransfer,
  approveTreasuryTransfer,
  executeTreasuryTransfer,
  submitSignerChange,
  approveSignerChange,
  executeSignerChange,
  getGovernanceState,
  pausePool,
  unpausePool,
} from "../services/governance.js";

const QubicAddress = z.string().regex(/^[A-Z]{60}$/);

const InitSchema = z.object({
  initialSigners: z.array(QubicAddress).min(1).max(16),
  threshold: z.number().int().min(1).max(16),
});

const TreasuryTransferSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    caller: QubicAddress,
    to: QubicAddress,
    nonce: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("approve"),
    caller: QubicAddress,
    nonce: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("execute"),
    nonce: z.number().int().min(1),
  }),
]);

const SignerChangeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    caller: QubicAddress,
    toAdd: z.array(QubicAddress).max(16).default([]),
    toRemove: z.array(QubicAddress).max(16).default([]),
    newThreshold: z.number().int().min(1).max(16).nullable(),
    nonce: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("approve"),
    caller: QubicAddress,
    nonce: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("execute"),
    nonce: z.number().int().min(1),
  }),
]);

// Phase 23.2 (M4) — circuit breaker. The caller must be a current
// governance signer; the AigarthPool client enforces that. Idempotent
// on both sides.
const PauseSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pause"),
    caller: QubicAddress,
  }),
  z.object({
    action: z.literal("unpause"),
    caller: QubicAddress,
  }),
]);

function governanceEventFromError(err: unknown): { status: number; message: string } {
  if (err instanceof AigarthPoolError) {
    // Map our error codes to HTTP statuses.
    switch (err.code) {
      case "ALREADY_INITIALIZED":
      case "PENDING_EXISTS":
        return { status: 409, message: err.message };
      case "NOT_INITIALIZED":
      case "NO_PENDING":
        return { status: 404, message: err.message };
      case "NOT_SIGNER":
      case "UNAUTHORIZED":
      case "INVALID_REMOVE":
      case "INVALID_THRESHOLD":
      case "INVALID_SIGNERS":
      case "DUPLICATE_SIGNER":
      case "ALREADY_SIGNER":
      case "EMPTY_SIGNER_SET":
      case "TOO_MANY_SIGNERS":
      case "THRESHOLD_NOT_MET":
      case "EXPIRED":
      case "NONCE_MISMATCH":
        return { status: 400, message: err.message };
      default:
        return { status: 400, message: err.message };
    }
  }
  return { status: 500, message: String(err) };
}

export async function governanceRoutes(app: FastifyInstance) {
  /**
   * GET /v1/aigarthpool/governance/state
   * Returns the full governance state — signers, threshold,
   * treasury wallet, and any pending ops. Used by the command
   * centre and by services that need to render the "approve" UI.
   * Public read: anyone can observe governance, but mutations
   * (init, submit, approve, execute) all require JWT.
   */
  app.get(
    "/v1/aigarthpool/governance/state",
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const s = await getGovernanceState();
        return reply.send({
          initialized: s.initialized,
          signers: s.signers,
          threshold: s.threshold,
          treasury_wallet: s.treasuryWallet,
          has_pending_treasury_transfer: s.hasPendingTreasuryTransfer,
          has_pending_signer_change: s.hasPendingSignerChange,
          pending_treasury_transfer: s.pendingTreasuryTransfer
            ? {
                to: s.pendingTreasuryTransfer.to,
                nonce: s.pendingTreasuryTransfer.nonce,
                submitted_at_epoch: s.pendingTreasuryTransfer.submittedAtEpoch,
                approvals: Array.from(s.pendingTreasuryTransfer.approvals.keys()),
                approval_count: s.pendingTreasuryTransfer.approvalCount,
              }
            : null,
          pending_signer_change: s.pendingSignerChange
            ? {
                to_add: s.pendingSignerChange.toAdd,
                to_remove: s.pendingSignerChange.toRemove,
                new_threshold: s.pendingSignerChange.newThreshold,
                nonce: s.pendingSignerChange.nonce,
                submitted_at_epoch: s.pendingSignerChange.submittedAtEpoch,
                approvals: Array.from(s.pendingSignerChange.approvals.keys()),
                approval_count: s.pendingSignerChange.approvalCount,
              }
            : null,
          pending_op_expires_at_epoch: s.pendingOpExpiresAtEpoch,
          // Phase 23.2 (M4) — circuit breaker flag.
          paused: s.paused,
        });
      } catch (err) {
        const { status, message } = governanceEventFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  /**
   * POST /v1/aigarthpool/governance/init
   * Body: { initialSigners, threshold }
   * One-time, deploy-time operation. Idempotent: returns 409 if
   * already initialized.
   */
  app.post(
    "/v1/aigarthpool/governance/init",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = InitSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        await initGovernance(parse.data.initialSigners, parse.data.threshold);
        await logActivity(getDb(), {
          action: "aigarthpool.governance.init",
          actorUserId: req.user.sub,
          targetType: "aigarthpool",
          targetId: "governance",
          metadata: { initialSigners: parse.data.initialSigners, threshold: parse.data.threshold },
        });
        return reply.send({ initialized: true, signers: parse.data.initialSigners, threshold: parse.data.threshold });
      } catch (err) {
        const { status, message } = governanceEventFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  /**
   * POST /v1/aigarthpool/governance/treasury-transfer
   * Body (discriminated by `action`):
   *   { action: "submit",  caller, to, nonce }
   *   { action: "approve", caller, nonce }
   *   { action: "execute", nonce }
   */
  app.post(
    "/v1/aigarthpool/governance/treasury-transfer",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = TreasuryTransferSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        if (parse.data.action === "submit") {
          await submitTreasuryTransfer(parse.data.caller, parse.data.to, parse.data.nonce);
          await logActivity(getDb(), {
            action: "aigarthpool.governance.treasury_submit",
            actorUserId: req.user.sub,
            targetType: "aigarthpool",
            targetId: "governance",
            metadata: { caller: parse.data.caller, to: parse.data.to, nonce: parse.data.nonce },
          });
          return reply.send({ action: "submit", nonce: parse.data.nonce });
        }
        if (parse.data.action === "approve") {
          await approveTreasuryTransfer(parse.data.caller, parse.data.nonce);
          await logActivity(getDb(), {
            action: "aigarthpool.governance.treasury_approve",
            actorUserId: req.user.sub,
            targetType: "aigarthpool",
            targetId: "governance",
            metadata: { caller: parse.data.caller, nonce: parse.data.nonce },
          });
          return reply.send({ action: "approve", nonce: parse.data.nonce });
        }
        // execute
        await executeTreasuryTransfer(parse.data.nonce);
        await logActivity(getDb(), {
          action: "aigarthpool.governance.treasury_execute",
          actorUserId: req.user.sub,
          targetType: "aigarthpool",
          targetId: "governance",
          metadata: { nonce: parse.data.nonce },
        });
        return reply.send({ action: "execute", nonce: parse.data.nonce });
      } catch (err) {
        const { status, message } = governanceEventFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  /**
   * POST /v1/aigarthpool/governance/signer-change
   * Body (discriminated by `action`):
   *   { action: "submit",  caller, toAdd, toRemove, newThreshold, nonce }
   *   { action: "approve", caller, nonce }
   *   { action: "execute", nonce }
   */
  app.post(
    "/v1/aigarthpool/governance/signer-change",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = SignerChangeSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        if (parse.data.action === "submit") {
          await submitSignerChange(
            parse.data.caller,
            parse.data.toAdd,
            parse.data.toRemove,
            parse.data.newThreshold,
            parse.data.nonce,
          );
          await logActivity(getDb(), {
            action: "aigarthpool.governance.signer_submit",
            actorUserId: req.user.sub,
            targetType: "aigarthpool",
            targetId: "governance",
            metadata: {
              caller: parse.data.caller,
              toAdd: parse.data.toAdd,
              toRemove: parse.data.toRemove,
              newThreshold: parse.data.newThreshold,
              nonce: parse.data.nonce,
            },
          });
          return reply.send({ action: "submit", nonce: parse.data.nonce });
        }
        if (parse.data.action === "approve") {
          await approveSignerChange(parse.data.caller, parse.data.nonce);
          await logActivity(getDb(), {
            action: "aigarthpool.governance.signer_approve",
            actorUserId: req.user.sub,
            targetType: "aigarthpool",
            targetId: "governance",
            metadata: { caller: parse.data.caller, nonce: parse.data.nonce },
          });
          return reply.send({ action: "approve", nonce: parse.data.nonce });
        }
        // execute
        await executeSignerChange(parse.data.nonce);
        await logActivity(getDb(), {
          action: "aigarthpool.governance.signer_execute",
          actorUserId: req.user.sub,
          targetType: "aigarthpool",
          targetId: "governance",
          metadata: { nonce: parse.data.nonce },
        });
        return reply.send({ action: "execute", nonce: parse.data.nonce });
      } catch (err) {
        const { status, message } = governanceEventFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  /**
   * POST /v1/aigarthpool/governance/pause
   * Body (discriminated by `action`):
   *   { action: "pause",   caller }
   *   { action: "unpause", caller }
   *
   * Phase 23.2 (M4) — circuit breaker. Toggles the pool's pause
   * flag. While paused, every mutation procedure rejects with
   * PAUSED. The AigarthPool client enforces governance-only
   * authorization; the route layer additionally requires JWT.
   */
  app.post(
    "/v1/aigarthpool/governance/pause",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = PauseSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        if (parse.data.action === "pause") {
          await pausePool(parse.data.caller);
          await logActivity(getDb(), {
            action: "aigarthpool.governance.pause",
            actorUserId: req.user.sub,
            targetType: "aigarthpool",
            targetId: "governance",
            metadata: { caller: parse.data.caller },
          });
          return reply.send({ action: "pause", paused: true });
        }
        await unpausePool(parse.data.caller);
        await logActivity(getDb(), {
          action: "aigarthpool.governance.unpause",
          actorUserId: req.user.sub,
          targetType: "aigarthpool",
          targetId: "governance",
          metadata: { caller: parse.data.caller },
        });
        return reply.send({ action: "unpause", paused: false });
      } catch (err) {
        const { status, message } = governanceEventFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );
}
