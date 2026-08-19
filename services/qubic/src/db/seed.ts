/**
 * Dev seed for the Qubic service.
 *
 * Idempotent. Safe to run on every dev startup.
 *
 * Seeds:
 *   - 1 Aigarth Treasury address (60-A) with alias and an opening balance snapshot.
 *   - 3 showcase validator entries (computor 0, 1, 2 of the stub network) with
 *     human-readable aliases so the dashboard can label receivers.
 *   - 1 Qearn staking contract address (also exposed via the stub as
 *     `StubQubicClient.getQearnContractAddress()`).
 *
 * Run manually:
 *   pnpm db:seed
 *
 * Or import `seedDevDefaults()` and call it from a startup hook.
 */

import { sql } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { validators, treasuryMovements } from "./schema.js";
import { QEARN_CONTRACT_ADDRESS } from "../client/stub.js";

/** Aigarth platform treasury — placeholder address for local dev. */
export const AIGARTH_TREASURY_ADDRESS = "A".repeat(60);

/** Showcase validator addresses (deterministic from the stub). */
function stubComputorAddress(index: number): string {
  const hi = Math.floor(index / 26);
  const lo = index % 26;
  const a = String.fromCharCode(65 + hi);
  const b = String.fromCharCode(65 + lo);
  return ("A".repeat(58) + a + b).slice(0, 60);
}

const SEED_VALIDATORS: Array<{
  computorIndex: number;
  qubicAddress: string;
  alias: string;
  isActive: boolean;
  performanceScore: number;
  stakeQubic: bigint;
}> = [
  {
    computorIndex: 0,
    qubicAddress: stubComputorAddress(0),
    alias: "Showcase Validator 0",
    isActive: true,
    performanceScore: 98,
    stakeQubic: 1_000_000_000_000n,
  },
  {
    computorIndex: 1,
    qubicAddress: stubComputorAddress(1),
    alias: "Showcase Validator 1",
    isActive: true,
    performanceScore: 97,
    stakeQubic: 1_100_000_000_000n,
  },
  {
    computorIndex: 2,
    qubicAddress: stubComputorAddress(2),
    alias: "Showcase Validator 2",
    isActive: true,
    performanceScore: 96,
    stakeQubic: 1_200_000_000_000n,
  },
  // Qearn contract as a non-active "validator" entry so the dashboard
  // alias lookup picks it up alongside the computors. Computor index
  // is set to a sentinel range (>675) to keep it out of computor lists.
  // performanceScore is 0 because the contract has no "performance";
  // isActive=false already distinguishes it from real computors.
  {
    computorIndex: 676,
    qubicAddress: QEARN_CONTRACT_ADDRESS,
    alias: "Qearn Staking Contract",
    isActive: false,
    performanceScore: 0,
    stakeQubic: 0n,
  },
];

export async function seedDevDefaults(): Promise<void> {
  const db = getDb();

  for (const v of SEED_VALIDATORS) {
    await db
      .insert(validators)
      .values({
        computorIndex: v.computorIndex,
        qubicAddress: v.qubicAddress,
        alias: v.alias,
        isActive: v.isActive,
        performanceScore: v.performanceScore,
        stakeQubic: v.stakeQubic,
      })
      .onConflictDoUpdate({
        target: validators.qubicAddress,
        set: {
          alias: v.alias,
          isActive: v.isActive,
          performanceScore: v.performanceScore,
          stakeQubic: v.stakeQubic,
        },
      });
  }

  // Record an opening treasury deposit so the movements log isn't empty.
  // Idempotent: keyed on the (kind, counterparty) pair; skip if it already exists.
  const existing = await db
    .select({ id: treasuryMovements.id })
    .from(treasuryMovements)
    .where(
      sql`${treasuryMovements.kind} = 'deposit' AND ${treasuryMovements.counterparty} = ${AIGARTH_TREASURY_ADDRESS}`,
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(treasuryMovements).values({
      kind: "deposit",
      amountQubic: 1_000_000_000_000n, // 1T QUBIC opening balance
      counterparty: AIGARTH_TREASURY_ADDRESS,
      signersApproved: 1,
      signersRequired: 1,
    });
  }
}

// Standalone script entry — `pnpm db:seed`.
const isMain = import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`;
if (isMain) {
  const db = getDb();
  // eslint-disable-next-line no-console
  console.log("[qubic] seeding dev defaults (treasury + showcase validators + Qearn contract)...");
  await seedDevDefaults();
  await closeDb();
  // eslint-disable-next-line no-console
  console.log("[qubic] seed complete");
}
