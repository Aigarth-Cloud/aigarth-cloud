/**
 * Smoke test for the Qearn-aware stub. Run with:
 *   pnpm tsx src/client/stub.smoke.ts
 *
 * No DB / network required. Verifies:
 *   - QEARN_CONTRACT_ADDRESS is a valid 60-char A-Z address
 *   - computeEarlyUnlockPenalty returns the correct basis points for
 *     representative weeks-held values
 *   - StubQubicClient.broadcastStake to the Qearn contract records a position
 *   - unlockQearn applies the right penalty and splits burn/redistribute 50/50
 *   - getQearnState reflects the lock + unlock state
 */

import { StubQubicClient, QEARN_CONTRACT_ADDRESS, computeEarlyUnlockPenalty } from "./stub.js";

let assertions = 0;
function ok(m: string) { console.log(`  ✓ ${m}`); assertions++; }
function assert(cond: unknown, m: string) {
  if (!cond) { console.error(`  ✗ ${m}`); process.exit(1); }
  ok(m);
}

console.log("=== Qearn stub smoke test ===\n");

// 1. Contract address
console.log("1. Contract address shape");
assert(QEARN_CONTRACT_ADDRESS.length === 60, "address is 60 chars");
assert(/^[A-Z]{60}$/.test(QEARN_CONTRACT_ADDRESS), "address is uppercase A-Z only");
assert(QEARN_CONTRACT_ADDRESS.startsWith("QEARN"), "address is human-recognisable");

// 2. Penalty table
console.log("\n2. computeEarlyUnlockPenalty");
const cases: Array<[number, number, number, string]> = [
  [0, 52, 0, "under 4 weeks → 0% reward"],
  [3, 52, 0, "3 weeks → 0%"],
  [4, 52, 500, "4 weeks → 5%"],
  [11, 52, 500, "11 weeks → 5%"],
  [12, 52, 1000, "12 weeks → 10%"],
  [20, 52, 2000, "20 weeks → 20%"],
  [36, 52, 4000, "36 weeks → 40%"],
  [44, 52, 5000, "44 weeks → 50%"],
  [51, 52, 5500, "51 weeks → 55%"],
  [52, 52, 10000, "52 weeks (full term) → 100%"],
  [100, 52, 10000, "100 weeks (past full term) → 100%"],
];
for (const [held, total, expected, label] of cases) {
  const r = computeEarlyUnlockPenalty(held, total);
  assert(r.rewardBps === expected, `${label} → ${r.rewardBps} bps`);
  assert(r.principalReturnBps === 10000, `  principal always returned: ${r.principalReturnBps} bps`);
}

// 3. Stub end-to-end
console.log("\n3. StubQubicClient lock + unlock roundtrip");
const client = new StubQubicClient();
const staker = "A".repeat(60);
const lockAmount = 1_000_000_000_000n; // 1T QUBIC
const sig = "x".repeat(32);

(async () => {
  const intent = {
    staker,
    receiver: QEARN_CONTRACT_ADDRESS,
    amountQubic: lockAmount,
    epochsLocked: 52, // 52 weeks
    startEpoch: 150,
    tickNumber: 14_000_000,
    signature: sig,
  };
  const broadcast = await client.broadcastStake(intent);
  assert(typeof broadcast.txHash === "string" && broadcast.txHash.length === 60, "broadcast returned 60-char tx hash");

  // The Qearn lock should now be recorded
  const stateAfterLock = await client.getQearnState();
  assert(stateAfterLock.totalLockedQubic === lockAmount, "state shows the locked amount");
  assert(stateAfterLock.positions.length === 1, "1 active position");
  const position = stateAfterLock.positions[0]!;
  assert(position.staker === staker, "position staker matches");
  assert(position.totalWeeks === 52, "position totalWeeks = 52");
  assert(position.isActive, "position is active");

  // Unlock after 20 weeks (penalty: 20% reward kept)
  const unlock = await client.unlockQearn(position.lockId, 20);
  assert(unlock.principalReturnedQubic === lockAmount, "principal returned in full");
  assert(unlock.rewardPaidQubic > 0n, "some reward paid (not 0)");
  assert(unlock.penaltyBurnedQubic + unlock.penaltyRedistributedQubic > 0n, "penalty split > 0");
  assert(unlock.penaltyBurnedQubic === unlock.penaltyRedistributedQubic, "penalty split is 50/50");

  // State after unlock
  const stateAfterUnlock = await client.getQearnState();
  assert(stateAfterUnlock.totalLockedQubic === 0n, "no active positions after unlock");
  assert(stateAfterUnlock.totalRewardsPaidQubic === unlock.rewardPaidQubic, "rewards paid tracked");
  assert(stateAfterUnlock.totalBurnedQubic === unlock.penaltyBurnedQubic, "burned tracked");

  // Listing positions for the staker
  const list = await client.listQearnPositions(staker);
  assert(list.length === 1, "list returns 1 position (now closed)");
  assert(list[0]!.isActive === false, "closed position flagged");
  assert(list[0]!.isEarly === true, "20/52 weeks is early");

  console.log(`\n=== ALL ${assertions} ASSERTIONS PASSED ===`);
  console.log(`\nSample: lock ${lockAmount} QUBIC for 52 weeks, unlock at week 20.`);
  console.log(`  principal returned : ${unlock.principalReturnedQubic} QUBIC`);
  console.log(`  reward paid (net)  : ${unlock.rewardPaidQubic} QUBIC`);
  console.log(`  penalty burned     : ${unlock.penaltyBurnedQubic} QUBIC`);
  console.log(`  penalty redistrib. : ${unlock.penaltyRedistributedQubic} QUBIC`);
})();
