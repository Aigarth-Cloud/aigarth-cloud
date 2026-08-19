/**
 * Payouts service — the engine that:
 *
 *   1. Assembles a payout_run from usage records (called by a cron or
 *      by an admin "run now" trigger)
 *   2. Resolves the recipient list (contributor shares + their wallets)
 *   3. Applies the split via `splits.applySplit`
 *   4. Persists payout_recipients rows in `pending` state
 *   5. Settles each recipient via `services/qubic` (settlement.ts)
 *   6. Marks recipients and the run as `settled` (or `partial` on
 *      per-recipient failures)
 *
 * In this push the implementation stops at step 4 (assembly + persist).
 * The settle loop (steps 5–6) is wired to a `settleRun(runId)` method
 * that calls `settleViaQubicService` for each recipient. A worker
 * (`src/workers/payout-settler.ts`, TBD) drives the settle loop on a
 * cron; the HTTP layer exposes `POST /v1/economy/payouts/:id/settle`
 * for manual triggers.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { loadConfig } from "../config/index.js";
import {
  payoutRuns,
  payoutRecipients,
  contributorShares,
  type PayoutRun,
  type NewPayoutRun,
  type PayoutRecipient,
} from "../db/schema.js";
import { applySplit, toRecipientShare } from "./splits.js";
import { settleViaQubicService, SettlementError } from "../lib/settlement.js";
import { logActivity } from "../lib/audit.js";
import { lookupWalletsForUser, IdentityLookupError } from "../lib/identity-client.js";

export class PayoutError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "PayoutError";
  }
}

export interface AssemblePayoutInput {
  annId: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenueQubic: bigint;
  /** When set, used for the split. Defaults to config ECONOMY_PLATFORM_FEE_BPS. */
  platformFeeBps?: number;
  /** Optional explicit list of source usage record ids (for audit). */
  sourceUsageRecordIds?: string[];
}

export interface AssemblePayoutResult {
  run: PayoutRun;
  recipients: PayoutRecipient[];
}

/**
 * Assemble a payout_run for one ANN over a period. Idempotent on
 * (ann_id, period_start, period_end) — returns the existing run if
 * one already exists.
 */
export async function assemblePayout(input: AssemblePayoutInput): Promise<AssemblePayoutResult> {
  const cfg = loadConfig();
  const db = getDb();

  // Idempotency check
  const existing = await db
    .select()
    .from(payoutRuns)
    .where(
      and(
        eq(payoutRuns.annId, input.annId),
        eq(payoutRuns.periodStart, input.periodStart),
        eq(payoutRuns.periodEnd, input.periodEnd),
      ),
    );
  if (existing[0]) {
    const recipients = await db
      .select()
      .from(payoutRecipients)
      .where(eq(payoutRecipients.payoutRunId, existing[0].id));
    return { run: existing[0], recipients };
  }

  // Load active contributor shares for the ANN
  const shares = await db
    .select()
    .from(contributorShares)
    .where(
      and(
        eq(contributorShares.annId, input.annId),
        eq(contributorShares.isActive, true),
      ),
    );
  if (shares.length === 0) {
    throw new PayoutError(
      `no active contributor shares for ANN ${input.annId}`,
      "NO_CONTRIBUTORS",
    );
  }

  const platformFeeBps = input.platformFeeBps ?? cfg.ECONOMY_PLATFORM_FEE_BPS;
  const split = applySplit({
    totalRevenueQubic: input.totalRevenueQubic,
    contributors: shares.map(toRecipientShare),
    platformFeeBps,
  });

  // Create the run + recipients in a transaction
  return db.transaction(async (tx) => {
    const runRows = await tx
      .insert(payoutRuns)
      .values({
        annId: input.annId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalRevenueQubic: input.totalRevenueQubic,
        platformFeeQubic: split.platformFeeQubic,
        netToContributorsQubic: split.netToContributorsQubic,
        platformFeeBps: split.platformFeeBps,
        status: "pending",
        sourceUsageRecordIds: input.sourceUsageRecordIds ?? [],
      } satisfies Omit<NewPayoutRun, "id" | "createdAt" | "settledAt" | "cancelledAt" | "failureReason">)
      .returning();
    const run = runRows[0]!;

    if (split.payouts.length === 0) {
      // Mark settled with zero recipients (no contributors or all rounded to 0).
      const settled = await tx
        .update(payoutRuns)
        .set({ status: "settled", settledAt: new Date() })
        .where(eq(payoutRuns.id, run.id))
        .returning();
      return { run: settled[0]!, recipients: [] };
    }

    // Phase 18 closeout: we still leave wallet_address blank at
    // assembly time. The settler (`settleRun`) resolves the wallet
    // by calling services/identity at settle time, so the lookup is
    // fresh (the user might have linked a new wallet between assembly
    // and settle). This is the missing join.
    const recipientValues = split.payouts.map((p) => ({
      payoutRunId: run.id,
      userId: p.userId,
      walletAddress: "", // populated by settleRun() before broadcast
      bps: p.bps,
      amountQubic: p.amountQubic,
      status: "pending" as const,
    }));
    const recipientRows = await tx.insert(payoutRecipients).values(recipientValues).returning();

    await logActivity(
      "payout.assembled",
      `Payout run assembled for ANN ${input.annId} (${input.totalRevenueQubic} QUBIC, ${recipientRows.length} recipients)`,
      { targetType: "payout_run", targetId: run.id },
    );

    return { run, recipients: recipientRows };
  });
}

/**
 * Settle a payout run:
 *   1. Resolve each recipient's verified wallet address via the
 *      identity service (`/v1/internal/wallets/by-user/:userId`,
 *      Phase 18 closeout). Persist the resolved address on each
 *      recipient row.
 *   2. For each recipient, broadcast the transfer via services/qubic.
 *   3. Update run + recipient statuses (`settled` / `partial` /
 *      `failed` / `skipped`).
 *
 * The wallet lookup is fresh on every call, so a user who links a
 * wallet between `assemblePayout` and `settleRun` will be picked up
 * automatically on the next settle.
 */
export async function settleRun(runId: string): Promise<{ run: PayoutRun; recipients: PayoutRecipient[] }> {
  const cfg = loadConfig();
  const db = getDb();

  const runRows = await db.select().from(payoutRuns).where(eq(payoutRuns.id, runId));
  const run = runRows[0];
  if (!run) throw new PayoutError(`payout run not found: ${runId}`, "RUN_NOT_FOUND");
  if (run.status === "settled") {
    const recipients = await db
      .select()
      .from(payoutRecipients)
      .where(eq(payoutRecipients.payoutRunId, run.id));
    return { run, recipients };
  }
  if (run.status !== "pending" && run.status !== "partial") {
    throw new PayoutError(`cannot settle run in status ${run.status}`, "RUN_NOT_SETTLEABLE");
  }

  // Mark the run as settling so concurrent settle calls bail.
  await db
    .update(payoutRuns)
    .set({ status: "settling" })
    .where(and(eq(payoutRuns.id, runId), eq(payoutRuns.status, run.status)));

  const recipients = await db
    .select()
    .from(payoutRecipients)
    .where(eq(payoutRecipients.payoutRunId, runId));

  // Phase 18 closeout: resolve each recipient's wallet via the identity
  // service. We dedupe userIds so a contributor who appears in multiple
  // payout lines (rare, but possible across runs) only triggers one HTTP
  // call. The first verified wallet address wins — the user can revoke
  // the others later if they want, but for settlement we just need a
  // destination. We update each recipient row with its resolved address
  // before the broadcast loop, so the persistent state matches what
  // we actually paid.
  const uniqueUserIds = Array.from(new Set(recipients.map((r) => r.userId)));
  const walletByUserId = new Map<string, string | null>();
  for (const userId of uniqueUserIds) {
    try {
      const addresses = await lookupWalletsForUser(userId);
      walletByUserId.set(userId, addresses[0] ?? null);
    } catch (err) {
      // Transport / 401 / bad-payload errors → mark this user as
      // unresolvable for this run. The recipient stays pending and
      // we surface a single audit-log entry per failed user.
      const message =
        err instanceof IdentityLookupError ? err.message : String(err);
      await logActivity(
        "payout.wallet_lookup_failed",
        `Wallet lookup failed for user ${userId}: ${message}`,
        { targetType: "payout_run", targetId: runId },
      );
      walletByUserId.set(userId, null);
    }
  }

  // Persist the resolved addresses on each recipient row. A null
  // address means "no verified wallet" — the broadcast step below
  // will skip the row, and a subsequent re-call to settleRun() will
  // re-resolve (the user may have linked a wallet in the meantime).
  for (const r of recipients) {
    const resolved = walletByUserId.get(r.userId) ?? null;
    if (resolved && r.walletAddress !== resolved) {
      await db
        .update(payoutRecipients)
        .set({ walletAddress: resolved })
        .where(eq(payoutRecipients.id, r.id));
      r.walletAddress = resolved;
    }
  }

  let anyFailed = false;
  for (const r of recipients) {
    if (r.status === "confirmed") continue;
    if (!r.walletAddress || r.walletAddress === "") {
      // No verified wallet for this user — leave recipient pending.
      // A subsequent settleRun() will re-resolve (the user may link
      // a wallet later). Do not mark failed: it's a real waiting state.
      continue;
    }
    if (r.amountQubic <= 0n) {
      await db
        .update(payoutRecipients)
        .set({ status: "skipped" })
        .where(eq(payoutRecipients.id, r.id));
      continue;
    }
    try {
      const result = await settleViaQubicService(cfg.QUBIC_SERVICE_URL, {
        fromAddress: cfg.QUBIC_QEARN_CONTRACT_ADDRESS, // treasury, in real wiring
        toAddress: r.walletAddress,
        amountQubic: r.amountQubic,
        refType: "payout_recipient",
        refId: r.id,
      });
      await db
        .update(payoutRecipients)
        .set({ status: "confirmed", txHash: result.txHash, confirmedAt: new Date() })
        .where(eq(payoutRecipients.id, r.id));
    } catch (err) {
      anyFailed = true;
      const message = err instanceof SettlementError ? err.message : String(err);
      await db
        .update(payoutRecipients)
        .set({ status: "failed", failureReason: message })
        .where(eq(payoutRecipients.id, r.id));
    }
  }

  // Re-read recipients to get current statuses
  const finalRecipients = await db
    .select()
    .from(payoutRecipients)
    .where(eq(payoutRecipients.payoutRunId, runId));

  const failedCount = finalRecipients.filter((r) => r.status === "failed").length;
  const pendingCount = finalRecipients.filter((r) => r.status === "pending").length;
  const newStatus = failedCount > 0 || pendingCount > 0 ? "partial" : "settled";
  const updated = await db
    .update(payoutRuns)
    .set({
      status: newStatus,
      settledAt: newStatus === "settled" ? new Date() : null,
    })
    .where(eq(payoutRuns.id, runId))
    .returning();

  await logActivity(
    "payout.settled",
    `Payout run ${runId} → ${newStatus} (${finalRecipients.length} recipients, ${failedCount} failed)`,
    { targetType: "payout_run", targetId: runId },
  );

  return { run: updated[0]!, recipients: finalRecipients };
}

export async function getRun(id: string): Promise<PayoutRun | null> {
  const db = getDb();
  const rows = await db.select().from(payoutRuns).where(eq(payoutRuns.id, id));
  return rows[0] ?? null;
}

export async function listRunsForAnn(annId: string): Promise<PayoutRun[]> {
  const db = getDb();
  return db
    .select()
    .from(payoutRuns)
    .where(eq(payoutRuns.annId, annId))
    .orderBy(sql`${payoutRuns.periodStart} DESC`);
}
