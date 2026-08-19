/**
 * /v1/proposals/* — Phase 14.1 (Governance, off-chain).
 *
 * Public-read on the listing + detail; JWT-gated on create / vote /
 * execute. Finalise is anyone (idempotent). Mutations (create +
 * execute) write to the local audit log so the dashboard can show
 * the activity feed.
 *
 * Endpoints:
 *   GET  /v1/proposals                 — list (public, paged)
 *   GET  /v1/proposals/:id             — get with tally (public)
 *   POST /v1/proposals                 — create (auth, stake check)
 *   POST /v1/proposals/:id/vote        — cast a vote (auth)
 *   POST /v1/proposals/:id/finalize    — finalise (anyone, post-deadline)
 *   POST /v1/proposals/:id/execute     — execute binding kind (auth)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createProposal,
  listProposals,
  getProposal,
  castVote,
  finalise,
  executeProposal,
  ProposalError,
} from "../services/proposals.js";
import { logActivity } from "../lib/audit.js";
import { getDb } from "../db/index.js";

const CreateSchema = z.object({
  kind: z.enum(["general", "treasury-spend", "ecosystem-grant", "parameter-change"]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  destinationAddress: z.string().regex(/^[A-Z]{60}$/).optional(),
  amountQubic: z
    .string()
    .regex(/^\d+$/)
    .transform((s) => BigInt(s))
    .optional(),
  parameterChange: z.record(z.unknown()).optional(),
  votingWindowMs: z.number().int().positive().max(30 * 24 * 60 * 60 * 1000).optional(),
});

const VoteSchema = z.object({
  choice: z.enum(["yes", "no", "abstain"]),
  note: z.string().max(1000).optional(),
});

function statusFromError(err: unknown): { status: number; message: string } {
  if (err instanceof ProposalError) {
    switch (err.code) {
      case "NOT_FOUND":
        return { status: 404, message: err.message };
      case "INSUFFICIENT_STAKE":
      case "INVALID_TITLE":
      case "INVALID_BODY":
      case "INVALID_DESTINATION":
      case "INVALID_AMOUNT":
      case "NOT_OPEN":
      case "EXPIRED":
      case "TOO_EARLY":
      case "SELF_VOTE":
      case "NO_STAKE":
      case "NOT_PASSED":
      case "NON_BINDING":
      case "INVALID_BINDING":
        return { status: 400, message: err.message };
      default:
        return { status: 500, message: err.message };
    }
  }
  return { status: 500, message: String(err) };
}

function serializeProposal(p: import("../db/schema.js").Proposal & {
  tally: import("../services/proposals.js").ProposalTally;
}) {
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    body: p.body,
    proposer_user_id: p.proposerUserId,
    proposer_stake_qubic: p.proposerStakeQubic.toString(),
    destination_address: p.destinationAddress,
    amount_qubic: p.amountQubic?.toString() ?? null,
    parameter_change: p.parameterChange,
    voting_deadline_at: p.votingDeadlineAt.toISOString(),
    status: p.status,
    yes_weight_qubic: p.yesWeightQubic.toString(),
    no_weight_qubic: p.noWeightQubic.toString(),
    abstain_weight_qubic: p.abstainWeightQubic.toString(),
    quorum_qubic: p.quorumQubic.toString(),
    execution_nonce: p.executionNonce,
    finalised_at: p.finalisedAt?.toISOString() ?? null,
    executed_at: p.executedAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    tally: {
      yes_weight_qubic: p.tally.yesWeightQubic.toString(),
      no_weight_qubic: p.tally.noWeightQubic.toString(),
      abstain_weight_qubic: p.tally.abstainWeightQubic.toString(),
      total_weight_qubic: p.tally.totalWeightQubic.toString(),
      quorum_qubic: p.tally.quorumQubic.toString(),
      quorum_met: p.tally.quorumMet,
    },
  };
}

export async function proposalsRoutes(app: FastifyInstance) {
  /**
   * GET /v1/proposals
   * Public read. Paged by status (optional) and offset/limit.
   */
  app.get("/v1/proposals", async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { status?: string; limit?: string; offset?: string };
    const status = q.status as
      | "open" | "passed" | "rejected" | "expired" | "executed" | "cancelled" | undefined;
    if (q.status && !status) {
      return reply.code(400).send({ error: { message: `unknown status: ${q.status}` } });
    }
    const list = await listProposals({
      status,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
    return reply.send({
      proposals: list.map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        proposer_user_id: p.proposerUserId,
        status: p.status,
        voting_deadline_at: p.votingDeadlineAt.toISOString(),
        amount_qubic: p.amountQubic?.toString() ?? null,
        yes_weight_qubic: p.yesWeightQubic.toString(),
        no_weight_qubic: p.noWeightQubic.toString(),
        abstain_weight_qubic: p.abstainWeightQubic.toString(),
        created_at: p.createdAt.toISOString(),
      })),
    });
  });

  /**
   * GET /v1/proposals/:id
   * Public read with full body + tally.
   */
  app.get("/v1/proposals/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const id = (req.params as { id: string }).id;
    const p = await getProposal(id);
    if (!p) return reply.code(404).send({ error: { message: "proposal not found" } });
    return reply.send(serializeProposal(p));
  });

  /**
   * POST /v1/proposals
   * Auth required. Proposer must have >= MIN_PROPOSER_STAKE_QUBIC
   * in AigarthPool positions.
   */
  app.post(
    "/v1/proposals",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = CreateSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        const proposal = await createProposal({
          ...parse.data,
          proposerUserId: req.user.sub,
        });
        await logActivity(getDb(), {
          action: "governance.proposal_created",
          actorUserId: req.user.sub,
          targetType: "proposal",
          targetId: proposal.id,
          metadata: {
            kind: proposal.kind,
            title: proposal.title,
            amountQubic: proposal.amountQubic?.toString() ?? null,
            proposerStakeQubic: proposal.proposerStakeQubic.toString(),
          },
        });
        return reply.send(serializeProposal({ ...proposal, tally: await getTallyFor(proposal) }));
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  /**
   * POST /v1/proposals/:id/vote
   * Auth required. One vote per voter; re-voting updates.
   */
  app.post(
    "/v1/proposals/:id/vote",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = (req.params as { id: string }).id;
      const parse = VoteSchema.safeParse(req.body);
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
      }
      try {
        await castVote({
          proposalId: id,
          voterUserId: req.user.sub,
          choice: parse.data.choice,
          note: parse.data.note,
        });
        await logActivity(getDb(), {
          action: "governance.vote_cast",
          actorUserId: req.user.sub,
          targetType: "proposal",
          targetId: id,
          metadata: { choice: parse.data.choice },
        });
        const p = await getProposal(id);
        return reply.send(p ? serializeProposal(p) : { ok: true });
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );

  /**
   * POST /v1/proposals/:id/finalize
   * Anyone. Idempotent. Must be after the voting deadline.
   */
  app.post("/v1/proposals/:id/finalize", async (req: FastifyRequest, reply: FastifyReply) => {
    const id = (req.params as { id: string }).id;
    try {
      const updated = await finalise(id);
      await logActivity(getDb(), {
        action: "governance.proposal_finalised",
        actorUserId: null,
        targetType: "proposal",
        targetId: id,
        metadata: { status: updated.status },
      });
      return reply.send(serializeProposal({ ...updated, tally: await getTallyFor(updated) }));
    } catch (err) {
      const { status, message } = statusFromError(err);
      return reply.code(status).send({ error: { message } });
    }
  });

  /**
   * POST /v1/proposals/:id/execute
   * Auth required. Only valid for `passed` binding-kind proposals.
   * Pushes the on-chain call (treasury-spend) or marks executed
   * (parameter-change).
   */
  app.post(
    "/v1/proposals/:id/execute",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const id = (req.params as { id: string }).id;
      try {
        const updated = await executeProposal(id);
        await logActivity(getDb(), {
          action: "governance.proposal_executed",
          actorUserId: req.user.sub,
          targetType: "proposal",
          targetId: id,
          metadata: { kind: updated.kind, status: updated.status },
        });
        return reply.send(serializeProposal({ ...updated, tally: await getTallyFor(updated) }));
      } catch (err) {
        const { status, message } = statusFromError(err);
        return reply.code(status).send({ error: { message } });
      }
    },
  );
}

async function getTallyFor(p: import("../db/schema.js").Proposal) {
  const total = p.yesWeightQubic + p.noWeightQubic + p.abstainWeightQubic;
  return {
    yesWeightQubic: p.yesWeightQubic,
    noWeightQubic: p.noWeightQubic,
    abstainWeightQubic: p.abstainWeightQubic,
    totalWeightQubic: total,
    voterCount: 0,
    quorumQubic: p.quorumQubic,
    quorumMet: total >= p.quorumQubic,
  };
}
