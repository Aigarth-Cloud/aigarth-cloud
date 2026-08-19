/**
 * Transaction monitor worker.
 *
 * Subscribes to NATS for outbound transaction events. For each event:
 *   1. Looks up the transaction in our DB
 *   2. Polls the Qubic client for the latest tick + tx status
 *   3. Flips status: queued → broadcast → confirming → active / failed
 *   4. Updates the related stake / treasury / reward rows
 *
 * In production this also subscribes to a Qubic node's tick stream
 * to drive poll-based confirmation. For now it relies on NATS events.
 *
 * Run: `pnpm worker:tx-monitor`
 */

import { eq, and, sql, inArray } from "drizzle-orm";
import { connect, type NatsConnection } from "nats";
import { loadConfig } from "../config/index.js";
import { getDb, closeDb } from "../db/index.js";
import { transactions, stakes, auditLogs } from "../db/schema.js";
import { getQubicClient } from "../client/index.js";
import { logActivity } from "../lib/audit.js";
import { uid } from "../lib/ids.js";

const POLL_INTERVAL_MS = 10_000;
const CONFIRM_THRESHOLD_TICKS = 5; // a tx is "confirmed" after N ticks

async function main() {
  const cfg = loadConfig();
  // eslint-disable-next-line no-console
  console.log("[tx-monitor] starting");
  // eslint-disable-next-line no-console
  console.log(`[tx-monitor] NATS: ${cfg.NATS_URL} (subject: ${cfg.NATS_TX_SUBJECT})`);

  let nc: NatsConnection | null = null;
  try {
    nc = await connect({ servers: cfg.NATS_URL });
    // eslint-disable-next-line no-console
    console.log("[tx-monitor] connected to NATS");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[tx-monitor] NATS not reachable: ${err instanceof Error ? err.message : err}`);
    // eslint-disable-next-line no-console
    console.warn("[tx-monitor] continuing in poll-only mode");
  }

  // Periodic poll of "in-flight" transactions
  const tick = async () => {
    try {
      await pollInFlight();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[tx-monitor] poll error:`, err);
    }
  };

  setInterval(tick, POLL_INTERVAL_MS);
  await tick(); // run once on boot

  if (nc) {
    const sub = nc.subscribe(cfg.NATS_TX_SUBJECT);
    for await (const msg of sub) {
      try {
        const data = JSON.parse(msg.string());
        await handleTxEvent(data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[tx-monitor] msg error:`, err);
      }
    }
  } else {
    // No NATS: just stay alive on the poll loop
    setInterval(() => {}, 1 << 30);
  }
}

async function pollInFlight() {
  const db = getDb();
  const client = getQubicClient();
  const tick = await client.getCurrentTick();

  // Find txs that are not yet finalized
  const inFlight = await db
    .select()
    .from(transactions)
    .where(inArray(transactions.status, ["queued", "broadcast", "confirmed"]))
    .limit(50);
  for (const tx of inFlight) {
    if (!tx.txHash) continue;
    const live = await client.getTransaction(tx.txHash);
    if (!live) continue;
    if (live.status === "finalized" && tx.status !== "finalized") {
      await db
        .update(transactions)
        .set({ status: "finalized", confirmedAt: new Date(), tickNumber: live.tickNumber })
        .where(eq(transactions.id, tx.id));
      await handleFinalized(tx.refType, tx.refId, tx.txHash, live);
      continue;
    }
    if (live.status === "failed" && tx.status !== "failed") {
      await db
        .update(transactions)
        .set({ status: "failed", failureReason: "broadcast_failed_on_chain" })
        .where(eq(transactions.id, tx.id));
      await handleFailed(tx.refType, tx.refId, tx.txHash);
      continue;
    }
    if (tx.status === "broadcast" && live.tickNumber > 0 && tick.tickNumber - live.tickNumber >= CONFIRM_THRESHOLD_TICKS) {
      await db
        .update(transactions)
        .set({ status: "confirmed", confirmedAt: new Date() })
        .where(eq(transactions.id, tx.id));
    }
  }
}

async function handleTxEvent(data: { txHash?: string; refType?: string; refId?: string }) {
  if (!data.txHash) return;
  const db = getDb();
  // Try to find by hash
  const rows = await db.select().from(transactions).where(eq(transactions.txHash, data.txHash)).limit(1);
  if (rows[0]) {
    // Force a status refresh
    const live = await getQubicClient().getTransaction(data.txHash);
    if (live) {
      await db
        .update(transactions)
        .set({ status: live.status, tickNumber: live.tickNumber })
        .where(eq(transactions.id, rows[0].id));
    }
  }
}

async function handleFinalized(refType: string | null, refId: string | null, txHash: string, _tx: unknown) {
  const db = getDb();
  if (refType === "stake" && refId) {
    await db
      .update(stakes)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(stakes.id, refId));
    await logActivity(db, {
      action: "tx.confirmed",
      targetType: "stake",
      targetId: refId,
      metadata: { txHash },
    });
  } else {
    await logActivity(db, {
      action: "tx.confirmed",
      targetType: refType ?? undefined,
      targetId: refId ?? undefined,
      metadata: { txHash },
    });
  }
}

async function handleFailed(refType: string | null, refId: string | null, txHash: string) {
  const db = getDb();
  if (refType === "stake" && refId) {
    await db
      .update(stakes)
      .set({ status: "failed", failureReason: "broadcast_failed", updatedAt: new Date() })
      .where(eq(stakes.id, refId));
  }
  await logActivity(db, {
    action: "tx.failed",
    targetType: refType ?? undefined,
    targetId: refId ?? undefined,
    metadata: { txHash },
  });
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[tx-monitor] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });

// Suppress unused
void sql;
void and;
void uid;
void auditLogs;
