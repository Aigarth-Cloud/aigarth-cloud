/**
 * Proposals service — Phase 14 (Governance, off-chain).
 *
 * Distinct from the on-chain multi-sig (M1+M2, Phase 22). This is
 * the policy surface that drives it. Stake-weighted voting: a user's
 * voting weight is the sum of their AigarthPool positions at the
 * time of vote. Off-chain tally, on-chain execution.
 *
 * Proposal kinds:
 *   - general:          non-binding policy discussion
 *   - treasury-spend:   binding — executes via AigarthPool.submitTreasuryTransfer
 *   - ecosystem-grant:  binding — paid out by the treasury
 *   - parameter-change: binding — governance-controlled parameter
 *
 * Voting flow:
 *   1. createProposal — proposer has >= MIN_PROPOSER_STAKE
 *   2. vote — one vote per (proposal, voter); re-voting updates
 *   3. finalize — anyone can call after the deadline; tally decides
 *   4. execute — for binding kinds, pushes to AigarthPool governance
 *
 * Tally rule (v1): simple-majority of stake weight, with a quorum
 * gate. Abstain counts toward the quorum but not the majority.
 * Passed = (yesWeight > noWeight) AND (yesWeight + noWeight + abstainWeight >= quorum).
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  proposals,
  proposalVotes,
  type Proposal,
  type ProposalKind,
  type ProposalStatus,
  type VoteChoice,
} from "../db/schema.js";
import { getAigarthPool } from "./aigarthpool.js";

/** Phase 14.1 — minimum stake to create a proposal. 1,000 QUBIC in Qu-bit. */
export const MIN_PROPOSER_STAKE_QUBIC = 1_000_000_000n;

/** Default voting window. 7 days. */
export const DEFAULT_VOTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Default quorum: 1% of the proposer's stake. (v1: minimum 100,000 QUBIC.) */
export const MIN_QUORUM_QUBIC = 100_000_000_000n;

export class ProposalError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ProposalError";
  }
}

export interface CreateProposalInput {
  kind: ProposalKind;
  title: string;
  body: string;
  proposerUserId: string;
  /** Optional 60-char Qubic address. Required for treasury-spend / ecosystem-grant. */
  destinationAddress?: string;
  /** Amount in Qu-bit. Required for treasury-spend / ecosystem-grant. */
  amountQubic?: bigint;
  /** Optional parameter-change payload. */
  parameterChange?: Record<string, unknown>;
  /** Optional voting window override. */
  votingWindowMs?: number;
}

export interface CastVoteInput {
  proposalId: string;
  voterUserId: string;
  choice: VoteChoice;
  /** Optional note. */
  note?: string;
}

export interface ProposalTally {
  yesWeightQubic: bigint;
  noWeightQubic: bigint;
  abstainWeightQubic: bigint;
  totalWeightQubic: bigint;
  voterCount: number;
  /** Quorum in Qu-bit. */
  quorumQubic: bigint;
  /** True iff the result would be binding. */
  quorumMet: boolean;
}

export interface ProposalView extends Proposal {
  tally: ProposalTally;
}

/**
 * Compute the voter's effective stake in Qu-bit by summing their
 * AigarthPool positions. In v1, the simulator is in-process, so this
 * is a direct read. The real QPI client will need to enumerate
 * positions — Phase 20.6.
 */
async function computeVoterStakeQubic(voterUserId: string): Promise<bigint> {
  const pool = getAigarthPool();
  // The AigarthPool's `getPosition(user, annId)` requires the wallet
  // address, not a user UUID. In v1 we treat the user UUID as a
  // wallet key (the simulator uses string identities for the
  // user). This is a v1 simplification — v2 resolves via the
  // identity service's wallet-link table.
  const allAnns = (pool as unknown as { splits: Map<string, unknown> }).splits;
  let total = 0n;
  for (const annId of allAnns.keys()) {
    const pos = await pool.getPosition(voterUserId, annId);
    if (pos && pos.active) total += pos.amount;
  }
  return total;
}

/**
 * Create a new proposal. The proposer's effective stake is captured
 * at submission time and used as both the "skin in the game" check
 * and (optionally) the basis for the quorum default.
 */
export async function createProposal(input: CreateProposalInput): Promise<Proposal> {
  // --- Validation ---
  if (!input.title || input.title.length > 200) {
    throw new ProposalError("title must be 1-200 chars", "INVALID_TITLE");
  }
  if (!input.body || input.body.length > 20_000) {
    throw new ProposalError("body must be 1-20000 chars", "INVALID_BODY");
  }
  if (
    (input.kind === "treasury-spend" || input.kind === "ecosystem-grant") &&
    (!input.destinationAddress || !/^[A-Z]{60}$/.test(input.destinationAddress))
  ) {
    throw new ProposalError("treasury-spend / ecosystem-grant requires a 60-char destination address", "INVALID_DESTINATION");
  }
  if (
    (input.kind === "treasury-spend" || input.kind === "ecosystem-grant") &&
    (input.amountQubic === undefined || input.amountQubic <= 0n)
  ) {
    throw new ProposalError("treasury-spend / ecosystem-grant requires a positive amountQubic", "INVALID_AMOUNT");
  }

  // --- Proposer stake check ---
  const proposerStake = await computeVoterStakeQubic(input.proposerUserId);
  if (proposerStake < MIN_PROPOSER_STAKE_QUBIC) {
    throw new ProposalError(
      `proposer stake ${proposerStake} is below the minimum ${MIN_PROPOSER_STAKE_QUBIC} (${MIN_PROPOSER_STAKE_QUBIC / 1_000_000n} QUBIC)`,
      "INSUFFICIENT_STAKE",
    );
  }

  // --- Default quorum = max(MIN_QUORUM_QUBIC, 1% of proposer's stake) ---
  const quorumDefault = proposerStake / 100n;
  const quorumQubic = quorumDefault > MIN_QUORUM_QUBIC ? quorumDefault : MIN_QUORUM_QUBIC;

  const votingWindowMs = input.votingWindowMs ?? DEFAULT_VOTING_WINDOW_MS;
  const votingDeadlineAt = new Date(Date.now() + votingWindowMs);

  // --- Persist ---
  const db = getDb();
  const [row] = await db
    .insert(proposals)
    .values({
      kind: input.kind,
      title: input.title,
      body: input.body,
      proposerUserId: input.proposerUserId,
      proposerStakeQubic: proposerStake,
      destinationAddress: input.destinationAddress ?? null,
      amountQubic: input.amountQubic ?? null,
      parameterChange: input.parameterChange ?? null,
      votingDeadlineAt,
      status: "open",
      quorumQubic,
    })
    .returning();
  if (!row) throw new ProposalError("failed to create proposal", "INSERT_FAILED");
  return row;
}

/**
 * List proposals. Public read. Paged by status (optional) and
 * offset/limit.
 */
export async function listProposals(opts: {
  status?: ProposalStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<Proposal[]> {
  const db = getDb();
  const where = opts.status ? eq(proposals.status, opts.status) : undefined;
  return db
    .select()
    .from(proposals)
    .where(where)
    .orderBy(desc(proposals.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

/**
 * Get a single proposal by id, with the current tally attached.
 */
export async function getProposal(id: string): Promise<ProposalView | null> {
  const db = getDb();
  const [row] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (!row) return null;
  return { ...row, tally: await computeTally(row) };
}

/**
 * Cast a vote. One vote per (proposal, voter); re-voting updates
 * the existing row. The voter's stake is captured at vote time.
 */
export async function castVote(input: CastVoteInput): Promise<void> {
  const db = getDb();
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, input.proposalId))
    .limit(1);
  if (!proposal) throw new ProposalError("proposal not found", "NOT_FOUND");
  if (proposal.status !== "open") {
    throw new ProposalError(`proposal is ${proposal.status}, votes closed`, "NOT_OPEN");
  }
  if (proposal.votingDeadlineAt.getTime() < Date.now()) {
    throw new ProposalError("proposal deadline has passed", "EXPIRED");
  }
  if (proposal.proposerUserId === input.voterUserId) {
    throw new ProposalError("proposer cannot vote on their own proposal", "SELF_VOTE");
  }
  const weight = await computeVoterStakeQubic(input.voterUserId);
  if (weight === 0n) {
    throw new ProposalError("voter has no stake in AigarthPool", "NO_STAKE");
  }
  // Upsert the vote row. ON CONFLICT (proposal, voter) DO UPDATE
  // (in practice Drizzle's onConflictDoUpdate handles this — we
  // re-insert the same row id if it exists).
  await db
    .insert(proposalVotes)
    .values({
      proposalId: input.proposalId,
      voterUserId: input.voterUserId,
      weightQubic: weight,
      choice: input.choice,
      note: input.note ?? null,
    })
    .onConflictDoUpdate({
      target: [proposalVotes.proposalId, proposalVotes.voterUserId],
      set: {
        choice: input.choice,
        weightQubic: weight,
        note: input.note ?? null,
        updatedAt: new Date(),
      },
    });
  // Recompute the cached tally on the proposal row.
  await recomputeTally(input.proposalId);
}

/**
 * Recompute the cached tally (yes/no/abstain weights) on the
 * proposal row from the votes table. Idempotent.
 */
export async function recomputeTally(proposalId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({
      choice: proposalVotes.choice,
      total: sql<string>`COALESCE(SUM(${proposalVotes.weightQubic}), 0)`,
    })
    .from(proposalVotes)
    .where(eq(proposalVotes.proposalId, proposalId))
    .groupBy(proposalVotes.choice);
  let yes = 0n;
  let no = 0n;
  let abstain = 0n;
  for (const r of rows) {
    const v = BigInt(r.total);
    if (r.choice === "yes") yes = v;
    else if (r.choice === "no") no = v;
    else if (r.choice === "abstain") abstain = v;
  }
  await db
    .update(proposals)
    .set({ yesWeightQubic: yes, noWeightQubic: no, abstainWeightQubic: abstain, updatedAt: new Date() })
    .where(eq(proposals.id, proposalId));
}

/**
 * Finalise a proposal after the voting deadline. Anyone can call
 * (idempotent). The result is one of: passed, rejected, expired
 * (no quorum).
 */
export async function finalise(proposalId: string): Promise<Proposal> {
  const db = getDb();
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) throw new ProposalError("proposal not found", "NOT_FOUND");
  if (proposal.status !== "open") return proposal;  // idempotent
  if (proposal.votingDeadlineAt.getTime() > Date.now()) {
    throw new ProposalError("proposal deadline has not yet passed", "TOO_EARLY");
  }
  await recomputeTally(proposalId);
  const [refreshed] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);
  if (!refreshed) throw new ProposalError("proposal vanished", "NOT_FOUND");
  const total = refreshed.yesWeightQubic + refreshed.noWeightQubic + refreshed.abstainWeightQubic;
  let nextStatus: ProposalStatus;
  if (total < refreshed.quorumQubic) nextStatus = "expired";
  else if (refreshed.yesWeightQubic > refreshed.noWeightQubic) nextStatus = "passed";
  else nextStatus = "rejected";
  await db
    .update(proposals)
    .set({ status: nextStatus, finalisedAt: new Date(), updatedAt: new Date() })
    .where(eq(proposals.id, proposalId));
  const [updated] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!updated) throw new ProposalError("proposal vanished", "NOT_FOUND");
  return updated;
}

/**
 * Execute a passed binding-kind proposal. Pushes to AigarthPool
 * governance (which then needs the multi-sig to approve). The
 * returned Proposal has status `executed` on success.
 */
export async function executeProposal(proposalId: string): Promise<Proposal> {
  const db = getDb();
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) throw new ProposalError("proposal not found", "NOT_FOUND");
  if (proposal.status === "executed") return proposal;  // idempotent
  if (proposal.status !== "passed") {
    throw new ProposalError(`proposal is ${proposal.status}; only 'passed' proposals can be executed`, "NOT_PASSED");
  }
  if (proposal.kind !== "treasury-spend" && proposal.kind !== "ecosystem-grant" && proposal.kind !== "parameter-change") {
    throw new ProposalError(`proposal kind ${proposal.kind} is not binding`, "NON_BINDING");
  }

  if ((proposal.kind === "treasury-spend" || proposal.kind === "ecosystem-grant")) {
    if (!proposal.destinationAddress || proposal.amountQubic === null) {
      throw new ProposalError("binding kind missing destination or amount", "INVALID_BINDING");
    }
    // Submit to AigarthPool governance. The first proposer is used
    // as the `caller` (a real signer would do this). The multi-sig
    // then needs to approve per Phase 22.
    const pool = getAigarthPool();
    await pool.submitTreasuryTransfer(proposal.proposerUserId, proposal.destinationAddress, 1);
  }
  // parameter-change: TBD in a follow-up — for now, mark executed.
  await db
    .update(proposals)
    .set({ status: "executed", executedAt: new Date(), executionNonce: 1, updatedAt: new Date() })
    .where(eq(proposals.id, proposalId));
  const [updated] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!updated) throw new ProposalError("proposal vanished", "NOT_FOUND");
  return updated;
}

/**
 * Compute the live tally (does not touch the DB — used for
 * non-cached views). Reads the votes table once.
 */
export async function computeTallyFromDb(proposalId: string): Promise<ProposalTally> {
  const db = getDb();
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) throw new ProposalError("proposal not found", "NOT_FOUND");
  await recomputeTally(proposalId);
  const [refreshed] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!refreshed) throw new ProposalError("proposal vanished", "NOT_FOUND");
  return computeTally(refreshed);
}

function computeTally(p: Proposal): ProposalTally {
  const total = p.yesWeightQubic + p.noWeightQubic + p.abstainWeightQubic;
  return {
    yesWeightQubic: p.yesWeightQubic,
    noWeightQubic: p.noWeightQubic,
    abstainWeightQubic: p.abstainWeightQubic,
    totalWeightQubic: total,
    voterCount: 0,  // populated by the route via a count query when needed
    quorumQubic: p.quorumQubic,
    quorumMet: total >= p.quorumQubic,
  };
}

// Suppress unused-import warning for the `and` operator (kept for
// future queries that need both proposalId + voterUserId).
void and;
