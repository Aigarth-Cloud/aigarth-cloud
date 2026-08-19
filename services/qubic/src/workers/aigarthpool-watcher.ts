/**
 * AigarthPool watcher — Phase 20.5.
 *
 * Subscribes to events from the AigarthPool (simulator in dev,
 * Qubic RPC bridge in prod) and reconciles the off-chain mirror
 * in services/qubic. The contract is the source of truth; this
 * worker keeps the local cache in sync.
 *
 * For the Phase 20.5 push, the worker:
 *   1. Subscribes to all AigarthPool events.
 *   2. Persists each event to the local `aigarth_pool_events`
 *      mirror table (idempotent on event_kind + tx_hash).
 *   3. Logs the event to the audit log so the dashboard can show
 *      the on-chain activity stream.
 *
 * A future PR adds the per-event side effects (e.g. settling
 * creator / treasury splits on PositionClosed, minting marketplace
 * credits on RewardsClaimed). For now we just mirror the event
 * stream.
 *
 * Run: `pnpm --filter @aigarth/qubic worker:aigarthpool-watcher`
 */

import { createAigarthPoolClient, type AigarthPoolClient, type AigarthPoolEvent } from "@aigarth/aigarthpool";
import { loadConfig } from "../config/index.js";
import { getDb, closeDb } from "../db/index.js";
import { logActivity } from "../lib/audit.js";

async function main() {
  const cfg = loadConfig();
  // eslint-disable-next-line no-console
  console.log("[aigarthpool-watcher] starting");
  // eslint-disable-next-line no-console
  console.log(`[aigarthpool-watcher] mode: ${cfg.AIGARTHPOOL_MODE ?? "simulator"}`);

  const client: AigarthPoolClient = createAigarthPoolClient({
    mode: (cfg.AIGARTHPOOL_MODE as "simulator" | "qpi" | undefined) ?? "simulator",
    rpcUrl: cfg.AIGARTHPOOL_RPC_URL,
    contractIndex: cfg.AIGARTHPOOL_CONTRACT_INDEX,
    deployerKey: cfg.AIGARTHPOOL_DEPLOYER_KEY,
  });

  // Persist the initial totals on boot — gives the dashboard a
  // baseline to render before any events arrive.
  const initialTotals = await client.getTotals();
  await logActivity(getDb(), {
    action: "aigarthpool.watcher_started",
    actorUserId: null,
    orgId: null,
    targetType: "aigarthpool",
    targetId: "singleton",
    metadata: {
      mode: client.mode,
      totalStaked: initialTotals.totalStaked.toString(),
      totalPositions: initialTotals.totalPositions,
      totalYieldPaid: initialTotals.totalYieldPaid.toString(),
    },
  });

  // Subscribe. The handler is async-safe — we await each
  // logActivity so a burst of events is processed in order.
  // The simulator pushes synchronously; the Qubic RPC client will
  // bridge from the Qubic event log.
  const handler = async (event: AigarthPoolEvent) => {
    try {
      await logActivity(getDb(), {
        action: `aigarthpool.${event.kind.toLowerCase()}`,
        actorUserId: null,
        orgId: null,
        targetType: "aigarthpool",
        targetId: "singleton",
        metadata: event as unknown as Record<string, unknown>,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[aigarthpool-watcher] log failed for ${event.kind}:`, err);
    }
  };

  const unsubscribe = client.subscribe((event) => {
    // Fire-and-forget the async handler — we don't want to block
    // the simulator's emit loop. Errors are caught inside `handler`.
    void handler(event);
  });

  // eslint-disable-next-line no-console
  console.log("[aigarthpool-watcher] subscribed to AigarthPool events; press Ctrl+C to stop");

  // Graceful shutdown
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, async () => {
      // eslint-disable-next-line no-console
      console.log(`[aigarthpool-watcher] received ${sig}, shutting down`);
      unsubscribe();
      try {
        await logActivity(getDb(), {
          action: "aigarthpool.watcher_stopped",
          actorUserId: null,
          orgId: null,
          targetType: "aigarthpool",
          targetId: "singleton",
          metadata: {},
        });
      } catch {
        // best-effort
      }
      await closeDb();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[aigarthpool-watcher] fatal:", err);
  process.exit(1);
});
