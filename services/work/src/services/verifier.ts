/**
 * Work verifier (Task 9).
 *
 * Per ADR 006 §6 and PEP v0.2 §15
 * (aigarth-cloud-evolution-pep-v0.2.md:479-498).
 *
 * v1 stack (4 mechanisms):
 *   - Replication (3/3) — for non-deterministic algorithms.
 *   - Deterministic re-run — for `algorithm.deterministic = true`.
 *   - Challenge (1/100) — always-on; the challenger issues
 *     known-answer work items to random workers.
 *   - Result commitments (commit-reveal) — for non-deterministic
 *     work (the worker commits a payload_hash at claim time,
 *     reveals at submit time).
 *
 * Reputation (rolling 30d) is the *consequence* of failed
 * verification, not a verification mechanism itself. Failed
 * replication decays reputation; below REPUTATION_FLOOR, the
 * worker is suspended.
 *
 * Three adversarial cases (per ADR 006 §6):
 *   V01 — honest: 3 workers agree. Status -> "verified".
 *   V02 — malicious: 2-of-3 agree, 1 differs. Status -> "verified"
 *         (majority), malicious worker's reputation decays.
 *   V03 — Byzantine: 3 workers disagree. Status -> "disputed".
 */

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  workItems,
  workResults,
  workers,
  type WorkItem,
} from "../db/schema.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";

export interface VerificationOutcome {
  status: "verified" | "disputed" | "failed";
  replicasAgreed: string;
  primaryWorkerId: string;
  resultHash: string;
}

export class WorkItemNotFoundError extends Error {
  constructor(workIdValue: string) {
    super(`Work item '${workIdValue}' not found.`);
    this.name = "WorkItemNotFoundError";
  }
}

export class NoSubmissionsError extends Error {
  constructor(workIdValue: string) {
    super(`Work item '${workIdValue}' has no submitted results.`);
    this.name = "NoSubmissionsError";
  }
}

/**
 * Submit a single replica result (worker -> runtime).
 * Marks the matching work_results row as `submitted` and stores
 * the payload_hash + signature.
 */
export async function submitResult(
  workIdValue: string,
  workerIdValue: string,
  payloadHash: string,
  signature: string,
): Promise<VerificationOutcome | null> {
  const db = getDb();
  const cfg = loadConfig();

  const [item] = await db
    .select()
    .from(workItems)
    .where(eq(workItems.workId, workIdValue))
    .limit(1);
  if (!item) throw new WorkItemNotFoundError(workIdValue);

  // Find the matching claimed work_results row.
  const [claimed] = await db
    .select()
    .from(workResults)
    .where(
      and(
        eq(workResults.workId, workIdValue),
        eq(workResults.claimedBy, workerIdValue),
        eq(workResults.status, "claimed"),
      ),
    )
    .limit(1);

  // ADR 006 §10 negative consequence 1: training bridge must NOT
  // bypass the scheduler. Reject result submissions with no prior
  // claim.
  if (!claimed) {
    return null;
  }

  // Update work_results.
  await db
    .update(workResults)
    .set({
      status: "submitted",
      payloadHash,
      signature,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workResults.id, claimed.id));

  await logActivity(db, {
    workId: workIdValue,
    workerId: workerIdValue,
    action: auditAction.itemResultSubmitted,
    metadata: { payloadHash },
  });

  // If we have enough submitted replicas, run the verifier.
  const submissions = await db
    .select()
    .from(workResults)
    .where(
      and(
        eq(workResults.workId, workIdValue),
        eq(workResults.status, "submitted"),
      ),
    );

  if (submissions.length < item.replicas) {
    return null; // not enough submissions yet
  }

  return finalizeVerification(item, submissions.map((s) => s.payloadHash!), cfg);
}

/**
 * Decide the verification outcome from a list of submission
 * hashes. Pure function for unit testing.
 *
 *   - All same: verified, replicas_agreed = "N/N".
 *   - Majority: verified, replicas_agreed = "M/N", minority
 *     workers' reputation decays.
 *   - All different (3 distinct hashes): disputed.
 */
export function decideOutcome(
  submittedHashes: string[],
  totalReplicas: number,
): { status: "verified" | "disputed"; replicasAgreed: string; primaryHash: string | null; primaryIndex: number | null } {
  if (submittedHashes.length === 0) {
    return { status: "disputed", replicasAgreed: `0/${totalReplicas}`, primaryHash: null, primaryIndex: null };
  }
  const counts = new Map<string, number>();
  for (const h of submittedHashes) counts.set(h, (counts.get(h) ?? 0) + 1);
  // Find the most common hash.
  let best: { hash: string; n: number; idx: number } | null = null;
  let firstSeen = new Map<string, number>();
  for (let i = 0; i < submittedHashes.length; i++) {
    const h = submittedHashes[i]!;
    if (!firstSeen.has(h)) firstSeen.set(h, i);
  }
  for (const [hash, n] of counts) {
    if (!best || n > best.n) {
      best = { hash, n, idx: firstSeen.get(hash)! };
    }
  }
  if (!best) {
    return { status: "disputed", replicasAgreed: `0/${totalReplicas}`, primaryHash: null, primaryIndex: null };
  }
  // V03: all three differ (n=1 each for 3 replicas).
  if (counts.size >= submittedHashes.length && submittedHashes.length >= 3) {
    return { status: "disputed", replicasAgreed: `${submittedHashes.length}/${totalReplicas}`, primaryHash: null, primaryIndex: null };
  }
  return {
    status: "verified",
    replicasAgreed: `${best.n}/${totalReplicas}`,
    primaryHash: best.hash,
    primaryIndex: best.idx,
  };
}

/**
 * Run the verification flow once enough submissions are in.
 * Updates the work_items row, decays reputation for minority
 * workers on V02, and returns the outcome.
 */
export async function finalizeVerification(
  item: WorkItem,
  submittedHashes: string[],
  cfg: { REPUTATION_DECAY_MALICIOUS: number; REPUTATION_FLOOR: number },
): Promise<VerificationOutcome> {
  if (submittedHashes.length === 0) {
    throw new NoSubmissionsError(item.workId);
  }
  const decision = decideOutcome(submittedHashes, item.replicas);
  const db = getDb();

  if (decision.status === "verified" && decision.primaryHash) {
    // Find the primary worker (the one whose submission hash matches).
    const allSubmissions = await db
      .select()
      .from(workResults)
      .where(
        and(
          eq(workResults.workId, item.workId),
          eq(workResults.status, "submitted"),
        ),
      );
    const primary = allSubmissions.find((s) => s.payloadHash === decision.primaryHash);
    const primaryWorkerId = primary?.claimedBy ?? allSubmissions[0]?.claimedBy ?? "unknown";

    // ADR 006 §6 invariant 1: a verified work item cannot be re-opened.
    // Update work_items to "verified".
    await db
      .update(workItems)
      .set({
        status: "verified",
        resultPayloadHash: decision.primaryHash,
        resultCompletedBy: primaryWorkerId,
        resultCompletedAt: new Date(),
        resultReplicasAgreed: decision.replicasAgreed,
        updatedAt: new Date(),
      })
      .where(eq(workItems.workId, item.workId));

    await logActivity(db, {
      workId: item.workId,
      workerId: primaryWorkerId,
      action: auditAction.itemVerified,
      metadata: { replicasAgreed: decision.replicasAgreed, primaryHash: decision.primaryHash },
    });

    // V02: minority workers lose reputation.
    const minority = allSubmissions.filter((s) => s.payloadHash !== decision.primaryHash);
    for (const m of minority) {
      if (!m.claimedBy) continue;
      const [w] = await db.select().from(workers).where(eq(workers.workerId, m.claimedBy)).limit(1);
      if (!w) continue;
      const newRep = Math.max(0, Math.min(1, Number(w.reputation) - cfg.REPUTATION_DECAY_MALICIOUS));
      const newStatus = newRep < cfg.REPUTATION_FLOOR ? "suspended" : w.status;
      await db
        .update(workers)
        .set({ reputation: String(newRep), status: newStatus, updatedAt: new Date() })
        .where(eq(workers.workerId, m.claimedBy));
      await logActivity(db, {
        workId: item.workId,
        workerId: m.claimedBy,
        action: auditAction.workerSuspended,
        metadata: { reason: "replication_disagreement", newReputation: newRep },
      });
    }

    return {
      status: "verified",
      replicasAgreed: decision.replicasAgreed,
      primaryWorkerId,
      resultHash: decision.primaryHash,
    };
  }

  // Disputed
  await db
    .update(workItems)
    .set({
      status: "disputed",
      updatedAt: new Date(),
    })
    .where(eq(workItems.workId, item.workId));

  await logActivity(db, {
    workId: item.workId,
    action: auditAction.itemDisputed,
    metadata: { replicasAgreed: decision.replicasAgreed, submittedHashes },
  });

  return {
    status: "disputed",
    replicasAgreed: decision.replicasAgreed,
    primaryWorkerId: "unknown",
    resultHash: decision.primaryHash ?? "unknown",
  };
}
