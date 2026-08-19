/**
 * Smoke test for the splits engine. Pure math — no DB, no network.
 *
 * Run: pnpm --filter @aigarth/economy smoke
 *
 * Verifies:
 *   - Single recipient gets the full net (no fees)
 *   - Platform fee is taken off the top, contributors share the rest
 *   - Multi-recipient bps splits are exact-integer and sum <= 10000
 *   - Reject: bps sum > 10000
 *   - Reject: bps out of range
 *   - Reject: duplicate contributor
 *   - Reject: totalRevenueQubic < 0
 *   - Reject: platformFeeBps out of range
 *   - Reject: too many contributors
 *   - computeGrantUnits scales linearly with amount and weeks
 *   - computeGrantUnits rejects weeks out of [1, 52]
 */

import {
  applySplit,
  computeGrantUnits,
  MAX_CONTRIBUTORS_PER_ANN,
  type RecipientShare,
} from "./splits.js";

let assertions = 0;
function ok(m: string) { console.log(`  ✓ ${m}`); assertions++; }
function assert(cond: unknown, m: string) {
  if (!cond) { console.error(`  ✗ ${m}`); process.exit(1); }
  ok(m);
}

console.log("=== Splits engine smoke test ===\n");

// ---------- 1. Single recipient, no fee ----------
console.log("1. Single recipient, no platform fee");
{
  const recipients: RecipientShare[] = [
    { contributorId: "c1", userId: "u1", bps: 10_000 },
  ];
  const r = applySplit({ totalRevenueQubic: 1_000_000_000n, contributors: recipients });
  assert(r.platformFeeQubic === 0n, "platform fee is 0");
  assert(r.netToContributorsQubic === 1_000_000_000n, "net = total when fee is 0");
  assert(r.payouts.length === 1, "1 payout");
  assert(r.payouts[0]!.amountQubic === 1_000_000_000n, "recipient gets the full 1B");
  assert(r.sumPayoutsQubic === 1_000_000_000n, "sum of payouts matches net");
}

// ---------- 2. Single recipient, with 10% fee ----------
console.log("\n2. Single recipient, 10% platform fee");
{
  const r = applySplit({
    totalRevenueQubic: 1_000_000_000n,
    contributors: [{ contributorId: "c1", userId: "u1", bps: 10_000 }],
    platformFeeBps: 1_000,
  });
  assert(r.platformFeeQubic === 100_000_000n, "platform fee = 100M (10% of 1B)");
  assert(r.netToContributorsQubic === 900_000_000n, "net = 900M");
  assert(r.payouts[0]!.amountQubic === 900_000_000n, "recipient gets 900M");
}

// ---------- 3. Multi-recipient split ----------
console.log("\n3. Multi-recipient split (50/30/20 with 10% fee)");
{
  const r = applySplit({
    totalRevenueQubic: 10_000_000_000n, // 10B
    contributors: [
      { contributorId: "c1", userId: "u1", bps: 5_000 },
      { contributorId: "c2", userId: "u2", bps: 3_000 },
      { contributorId: "c3", userId: "u3", bps: 2_000 },
    ],
    platformFeeBps: 1_000,
  });
  assert(r.platformFeeQubic === 1_000_000_000n, "platform fee = 1B (10% of 10B)");
  assert(r.netToContributorsQubic === 9_000_000_000n, "net = 9B");
  assert(r.payouts[0]!.amountQubic === 4_500_000_000n, "c1 (50%) = 4.5B");
  assert(r.payouts[1]!.amountQubic === 2_700_000_000n, "c2 (30%) = 2.7B");
  assert(r.payouts[2]!.amountQubic === 1_800_000_000n, "c3 (20%) = 1.8B");
  assert(r.sumPayoutsQubic === 9_000_000_000n, "sum of payouts = 9B = net");
}

// ---------- 4. BPS sum < 10000 (some unallocated) ----------
console.log("\n4. BPS sum = 7000 (30% unallocated to anyone)");
{
  const r = applySplit({
    totalRevenueQubic: 1_000_000_000n,
    contributors: [
      { contributorId: "c1", userId: "u1", bps: 5_000 },
      { contributorId: "c2", userId: "u2", bps: 2_000 },
    ],
    platformFeeBps: 0,
  });
  assert(r.netToContributorsQubic === 1_000_000_000n, "net = total when fee is 0");
  assert(r.payouts[0]!.amountQubic === 500_000_000n, "c1 (50%) = 500M");
  assert(r.payouts[1]!.amountQubic === 200_000_000n, "c2 (20%) = 200M");
  assert(r.sumPayoutsQubic === 700_000_000n, "sum = 700M (30% unallocated, expected)");
}

// ---------- 5. Validation: bps sum > 10000 ----------
console.log("\n5. Reject bps sum > 10000");
{
  let threw = false;
  try {
    applySplit({
      totalRevenueQubic: 1_000n,
      contributors: [
        { contributorId: "c1", userId: "u1", bps: 6_000 },
        { contributorId: "c2", userId: "u2", bps: 6_000 },
      ],
    });
  } catch { threw = true; }
  assert(threw, "throws when bps sum = 12000");
}

// ---------- 6. Validation: bps out of range ----------
console.log("\n6. Reject bps out of range");
{
  let threw = false;
  try {
    applySplit({
      totalRevenueQubic: 1_000n,
      contributors: [{ contributorId: "c1", userId: "u1", bps: 12_000 }],
    });
  } catch { threw = true; }
  assert(threw, "throws when single bps = 12000");
}

// ---------- 7. Validation: duplicate contributor ----------
console.log("\n7. Reject duplicate contributorId");
{
  let threw = false;
  try {
    applySplit({
      totalRevenueQubic: 1_000n,
      contributors: [
        { contributorId: "c1", userId: "u1", bps: 5_000 },
        { contributorId: "c1", userId: "u2", bps: 5_000 },
      ],
    });
  } catch { threw = true; }
  assert(threw, "throws on duplicate contributorId");
}

// ---------- 8. Validation: negative revenue ----------
console.log("\n8. Reject negative totalRevenueQubic");
{
  let threw = false;
  try {
    applySplit({
      totalRevenueQubic: -1n,
      contributors: [],
    });
  } catch { threw = true; }
  assert(threw, "throws on negative revenue");
}

// ---------- 9. Validation: platformFeeBps out of range ----------
console.log("\n9. Reject platformFeeBps out of range");
{
  let threw = false;
  try {
    applySplit({
      totalRevenueQubic: 1_000n,
      contributors: [{ contributorId: "c1", userId: "u1", bps: 10_000 }],
      platformFeeBps: 12_000,
    });
  } catch { threw = true; }
  assert(threw, "throws when platformFeeBps = 12000");
}

// ---------- 10. Validation: too many contributors ----------
console.log("\n10. Reject too many contributors");
{
  const many: RecipientShare[] = [];
  for (let i = 0; i < MAX_CONTRIBUTORS_PER_ANN + 1; i++) {
    many.push({ contributorId: `c${i}`, userId: `u${i}`, bps: 1 });
  }
  let threw = false;
  try {
    applySplit({ totalRevenueQubic: 1_000_000n, contributors: many });
  } catch { threw = true; }
  assert(threw, `throws when contributors > ${MAX_CONTRIBUTORS_PER_ANN}`);
}

// ---------- 11. computeGrantUnits ----------
console.log("\n11. computeGrantUnits scales linearly");
// Function: returns (amountQubic * weeks) / 1_000_000n. 1 unit = 1M QUBIC × 1 week.
{
  // 1T QUBIC × 52 weeks / 1M = 52M units
  const g1 = computeGrantUnits(1_000_000_000_000n, 52);
  assert(g1 === 52_000_000n, `1T × 52 / 1M = ${g1} (expected 52M units)`);
  // 500B × 26 / 1M = 13M units
  const g2 = computeGrantUnits(500_000_000_000n, 26);
  assert(g2 === 13_000_000n, `500B × 26 / 1M = ${g2} (expected 13M units)`);
  // 10M × 1 / 1M = 10 units
  const g3 = computeGrantUnits(10_000_000n, 1);
  assert(g3 === 10n, `10M × 1 / 1M = ${g3} (expected 10 units)`);
  // 1B × 4 / 1M = 4000 units
  const g4 = computeGrantUnits(1_000_000_000n, 4);
  assert(g4 === 4_000n, `1B × 4 / 1M = ${g4} (expected 4000 units)`);
}

// ---------- 12. computeGrantUnits rejects bad weeks ----------
console.log("\n12. computeGrantUnits rejects bad weeks");
{
  for (const bad of [0, -1, 53, 100, 1.5]) {
    let threw = false;
    try {
      computeGrantUnits(1_000_000_000n, bad as number);
    } catch { threw = true; }
    assert(threw, `throws on weeks = ${bad}`);
  }
}

// ---------- 13. Realistic scenario ----------
console.log("\n13. Realistic: 100M QUBIC revenue, 10% fee, 2 creators 60/40");
{
  const r = applySplit({
    totalRevenueQubic: 100_000_000_000n, // 100M
    contributors: [
      { contributorId: "creator", userId: "u-creator", bps: 6_000 },
      { contributorId: "co-creator", userId: "u-cocreator", bps: 4_000 },
    ],
    platformFeeBps: 1_000,
  });
  assert(r.platformFeeQubic === 10_000_000_000n, "platform fee = 10M (10% of 100M)");
  assert(r.netToContributorsQubic === 90_000_000_000n, "net = 90M");
  assert(r.payouts[0]!.amountQubic === 54_000_000_000n, "creator (60%) = 54M");
  assert(r.payouts[1]!.amountQubic === 36_000_000_000n, "co-creator (40%) = 36M");
  assert(r.sumPayoutsQubic === 90_000_000_000n, "sum of payouts = 90M = net");
}

console.log(`\n=== ALL ${assertions} ASSERTIONS PASSED ===`);
