/**
 * Qearn watcher worker.
 *
 * The bridge between observed Qearn locks and the Aigarth off-chain
 * economy. Periodically polls `services/qubic` for transactions
 * addressed to the Qearn contract, parses the procedure (lock or
 * unlock), and writes to `economy_aigarth_locks`.
 *
 * Per ADR 002 §7. This is the missing link that turns "user locked
 * QUBIC in Qearn" into "user has a compute grant in Aigarth."
 *
 * Run: pnpm --filter @aigarth/economy worker:qearn-watcher
 *
 * The loop interval is `QEARN_WATCHER_POLL_INTERVAL_MS` (default 15s).
 * Disable with `QEARN_WATCHER_ENABLED=false`.
 */

import { loadConfig } from "../config/index.js";
import { closeDb, getDb } from "../db/index.js";
import {
  recordLock,
  markUnlocking,
  markEnded,
  getLockByQearnId,
  listActiveLocks,
} from "../services/locks.js";
// NOTE: the watcher uses services/qubic's StubQubicClient directly in
// dev (and a real Qubic client in production). This is the documented
// exception to the "no cross-service src imports" rule in ADR 001,
// because the watcher is a *peer* of the Qubic service (we both read
// the same Qubic network) rather than a *consumer* of it. The
// QubicClientLike type is defined here to avoid a tight dependency.

// Types from services/qubic's public API surface (kept loose to avoid
// a tight workspace dependency; the shape is small and stable).
interface QubicTx {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amountQubic: bigint | string;
  tickNumber: number;
  status: string;
  timestamp: number;
}

interface QubicClientLike {
  getTransactionHistory(
    address: string,
    options?: { limit?: number; fromTick?: number },
  ): Promise<QubicTx[]>;
  getCurrentTick(): Promise<{ tickNumber: number; epoch: number }>;
}

const log = (level: "info" | "warn" | "error", msg: string, extra?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console[level === "info" ? "log" : level](
    JSON.stringify({ ts: new Date().toISOString(), level, service: "qearn-watcher", msg, ...extra }),
  );
};

// ---------- Qearn week-bucket penalty table ----------
// Re-implemented here (instead of imported from services/qubic) to
// avoid the cross-service src import. KEEP IN SYNC with
// `computeEarlyUnlockPenalty` in services/qubic/src/client/stub.ts.
// The penalty table is a stable spec (see ADR 002 + the official
// Qearn docs); duplication is acceptable for ~50 lines of pure math.

interface QearnPenaltyResult {
  rewardBps: number;
  principalReturnBps: number;
}

const QEARN_PENALTY_BUCKETS: ReadonlyArray<{ minWeeks: number; rewardBps: number }> = [
  { minWeeks: 52, rewardBps: 10_000 },
  { minWeeks: 48, rewardBps: 5_500 },
  { minWeeks: 44, rewardBps: 5_000 },
  { minWeeks: 40, rewardBps: 4_500 },
  { minWeeks: 36, rewardBps: 4_000 },
  { minWeeks: 32, rewardBps: 3_500 },
  { minWeeks: 28, rewardBps: 3_000 },
  { minWeeks: 24, rewardBps: 2_500 },
  { minWeeks: 20, rewardBps: 2_000 },
  { minWeeks: 16, rewardBps: 1_500 },
  { minWeeks: 12, rewardBps: 1_000 },
  { minWeeks: 4,  rewardBps: 500 },
  { minWeeks: 0,  rewardBps: 0 },
];

function computeEarlyUnlockPenaltyLocal(
  weeksHeld: number,
  totalWeeks: number,
): QearnPenaltyResult {
  if (weeksHeld >= totalWeeks) return { rewardBps: 10_000, principalReturnBps: 10_000 };
  for (const bucket of QEARN_PENALTY_BUCKETS) {
    if (weeksHeld >= bucket.minWeeks) {
      return { rewardBps: bucket.rewardBps, principalReturnBps: 10_000 };
    }
  }
  return { rewardBps: 0, principalReturnBps: 10_000 };
}

// Minimal lock shape used by the watcher (we re-fetch from DB; this
// avoids importing the QearnLockPosition type across services).
interface QearnLockSummary {
  id: string;
  walletAddress: string;
  amountQubic: bigint;
  totalWeeks: number;
  startTick: number;
}

async function fetchQubicClient(_cfg: ReturnType<typeof loadConfig>): Promise<QubicClientLike> {
  // We use a dynamic spec-compliant import path. In the running
  // monorepo, services/qubic/src/client/stub.js resolves at runtime
  // even when TS doesn't see it (the runtime path is what matters
  // for tsx; tsc only needs the .d.ts to be visible, which we declare
  // in services/economy/src/types/qubic-stub.d.ts).
  const mod = (await import("../types/qubic-stub.js" as string)) as {
    StubQubicClient: new () => QubicClientLike;
  };
  return new mod.StubQubicClient();
}

async function processTick(cfg: ReturnType<typeof loadConfig>, client: QubicClientLike): Promise<void> {
  const tick = await client.getCurrentTick();
  const history = await client.getTransactionHistory(cfg.QUBIC_QEARN_CONTRACT_ADDRESS, {
    limit: 100,
  });

  for (const tx of history) {
    const amountQubic: bigint = typeof tx.amountQubic === "string" ? BigInt(tx.amountQubic) : tx.amountQubic;

    // We don't have a clean "procedure index" on the tx shape exposed
    // by getTransactionHistory (it's a generic Qubic transaction, not
    // a contract-specific record). For the demo we infer the procedure
    // from the receiver + amount: a non-zero amount to the Qearn
    // contract is a lock; a zero-amount tx with an existing lock hash
    // is an unlock.
    //
    // In production, the Qubic gateway returns a structured
    // `inputData` field that includes the procedure index. That wire
    // shape is a TODO on services/qubic. Until it lands, this
    // heuristic is enough to drive the demo.
    const isLikelyLock = amountQubic > 0n;

    if (isLikelyLock) {
      const existing = await getLockByQearnId(tx.txHash);
      if (existing) continue;

      // Heuristic totalWeeks: we don't know the lock duration from
      // the tx history alone (it's a procedure input). Until the
      // qubic service exposes the structured inputData, we default
      // to 52 weeks (the max). Real wiring lands in a follow-up.
      const totalWeeks = 52;
      const startEpoch = tick.epoch;

      await recordLock({
        userId: await resolveUserIdForAddress(cfg, tx.fromAddress),
        walletAddress: tx.fromAddress,
        qearnLockId: tx.txHash,
        lockTxHash: tx.txHash,
        amountQubic,
        totalWeeks,
        startEpoch,
        startTick: tx.tickNumber,
        netRewardQubic: 0n,
        penaltyBurnedQubic: 0n,
        status: "active",
      });
      log("info", "recorded new Qearn lock", { txHash: tx.txHash, amountQubic: amountQubic.toString() });
    } else {
      // Heuristic unlock detection: find the most recent active lock
      // from this wallet and mark it as unlocking.
      const lock = await findActiveLockByWallet(tx.fromAddress);
      if (lock) {
        await markUnlocking(lock.id, tx.txHash);
        log("info", "observed unlock intent for lock", { lockId: lock.id, txHash: tx.txHash });

        // Apply penalty based on elapsed weeks since the lock started.
        const weeksHeld = elapsedWeeks(lock.startTick, tx.tickNumber);
        const { rewardBps } = computeEarlyUnlockPenaltyLocal(
          weeksHeld,
          lock.totalWeeks,
        );
        const grossRewardQubic = (lock.amountQubic * 12_500n) / 10_000n / 52n * BigInt(weeksHeld);
        const netRewardQubic = (grossRewardQubic * BigInt(rewardBps)) / 10_000n;
        const penaltyBurnedQubic = (grossRewardQubic - netRewardQubic) / 2n;

        await markEnded(lock.id, netRewardQubic, penaltyBurnedQubic);
        log("info", "lock ended", { lockId: lock.id, weeksHeld, netReward: netRewardQubic.toString() });
      }
    }
  }
}

// ---------- helpers ----------

async function resolveUserIdForAddress(
  _cfg: ReturnType<typeof loadConfig>,
  _walletAddress: string,
): Promise<string> {
  // Identity lookup: query services/identity for the user who owns
  // this Qubic address. Until the identity join lands, fall back to
  // a deterministic "system" user so the demo still works.
  //
  // TODO: replace with a real call to services/identity. The shape:
  //   GET /v1/identity/wallets?qubicAddress=<addr> → { user_id, ... }
  return "00000000-0000-0000-0000-000000000001";
}

async function findActiveLockByWallet(walletAddress: string): Promise<QearnLockSummary | null> {
  // Inefficient single-wallet scan; fine for the demo, replace with a
  // proper indexed query in a follow-up.
  const all = await listActiveLocks();
  const match = all.find((l) => l.walletAddress === walletAddress);
  if (!match) return null;
  return {
    id: match.id,
    walletAddress: match.walletAddress,
    amountQubic: match.amountQubic,
    totalWeeks: match.totalWeeks,
    startTick: match.startTick,
  };
}

function elapsedWeeks(fromTick: number, toTick: number): number {
  // Mirrors the stub's WEEKS_PER_EPOCH = 1 + TICK_PER_EPOCH = 14400
  // model. Returns whole weeks (rounded down).
  const TICKS_PER_WEEK = 14_400;
  return Math.max(0, Math.floor((toTick - fromTick) / TICKS_PER_WEEK));
}

async function main() {
  const cfg = loadConfig();
  if (!cfg.QEARN_WATCHER_ENABLED) {
    log("info", "qearn-watcher disabled (QEARN_WATCHER_ENABLED=false), exiting");
    return;
  }
  // Touch getDb to fail fast on misconfiguration
  getDb();

  log("info", "starting qearn-watcher", {
    qearnContract: cfg.QUBIC_QEARN_CONTRACT_ADDRESS,
    pollIntervalMs: cfg.QEARN_WATCHER_POLL_INTERVAL_MS,
  });

  const client = await fetchQubicClient(cfg);

  // Graceful shutdown
  let running = true;
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      running = false;
      log("info", `${sig} received, shutting down`);
    });
  }

  while (running) {
    try {
      await processTick(cfg, client);
    } catch (err) {
      log("error", "tick processing failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(cfg.QEARN_WATCHER_POLL_INTERVAL_MS);
  }

  await closeDb();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("qearn-watcher crashed:", err);
  process.exit(1);
});
