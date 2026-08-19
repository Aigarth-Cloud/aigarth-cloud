/**
 * Tests for the node-reservation service (Phase 24 hardware presale).
 *
 * Pure unit tests, no DB. We exercise:
 *   - The zod schemas (input validation for the public API)
 *   - The USD-cents -> QUBIC conversion math
 *   - The tier spec table (deposit + balance amounts, ratio sanity)
 *   - The "tiers open for reservation" gate
 *
 * Integration tests with a real DB would cover the full state machine
 * (pending_funding -> spot_held -> awaiting_confirm -> confirmed/released).
 * Those are deferred until we have a test DB; the vitest harness here
 * pins the wire contract and the pure-function behavior.
 */

import { describe, it, expect } from "vitest";
import {
  CreateNodeReservationSchema,
  FundNodeReservationSchema,
  ConfirmNodeReservationSchema,
  ReleaseNodeReservationSchema,
  TIER_SPECS,
  TIERS_OPEN_FOR_RESERVATION,
  usdCentsToQubic,
} from "../services/node-reservations.js";

// ---------- Zod schemas ----------

describe("CreateNodeReservationSchema", () => {
  it("accepts tier 1 with default yieldOptIn", () => {
    const r = CreateNodeReservationSchema.safeParse({ tier: 1 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tier).toBe(1);
      expect(r.data.yieldOptIn).toBe(false);
    }
  });

  it("accepts tier 1 with yieldOptIn true", () => {
    const r = CreateNodeReservationSchema.safeParse({ tier: 1, yieldOptIn: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.yieldOptIn).toBe(true);
  });

  it("accepts tier 2 and tier 3 (schema-wise; the service gate rejects them this phase)", () => {
    expect(CreateNodeReservationSchema.safeParse({ tier: 2 }).success).toBe(true);
    expect(CreateNodeReservationSchema.safeParse({ tier: 3 }).success).toBe(true);
  });

  it("rejects tier 0 and tier 4", () => {
    expect(CreateNodeReservationSchema.safeParse({ tier: 0 }).success).toBe(false);
    expect(CreateNodeReservationSchema.safeParse({ tier: 4 }).success).toBe(false);
  });

  it("rejects missing tier", () => {
    expect(CreateNodeReservationSchema.safeParse({}).success).toBe(false);
  });

  it("rejects string tier", () => {
    expect(CreateNodeReservationSchema.safeParse({ tier: "1" }).success).toBe(false);
  });
});

describe("FundNodeReservationSchema", () => {
  it("accepts a well-formed fund payload", () => {
    const r = FundNodeReservationSchema.safeParse({
      txHashReserve: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
      depositQubic: "67415730",
      qubicUsdRateScaled: "4450",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a short txHashReserve", () => {
    const r = FundNodeReservationSchema.safeParse({
      txHashReserve: "tooshort",
      depositQubic: "67415730",
      qubicUsdRateScaled: "4450",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-numeric depositQubic", () => {
    const r = FundNodeReservationSchema.safeParse({
      txHashReserve: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
      depositQubic: "abc",
      qubicUsdRateScaled: "4450",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a negative-looking qubicUsdRateScaled", () => {
    // regex requires positive integer string with no sign
    const r = FundNodeReservationSchema.safeParse({
      txHashReserve: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
      depositQubic: "67415730",
      qubicUsdRateScaled: "-4450",
    });
    expect(r.success).toBe(false);
  });
});

describe("ConfirmNodeReservationSchema", () => {
  it("accepts a well-formed confirm payload with optional yield credit", () => {
    const r = ConfirmNodeReservationSchema.safeParse({
      txHashConfirm: "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
      balanceQubic: "1346067415",
      qubicUsdRateScaled: "4450",
      yieldCreditQubic: "1000000",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.yieldCreditQubic).toBe("1000000");
  });

  it("defaults yieldCreditQubic to 0 when omitted", () => {
    const r = ConfirmNodeReservationSchema.safeParse({
      txHashConfirm: "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
      balanceQubic: "1346067415",
      qubicUsdRateScaled: "4450",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.yieldCreditQubic).toBe("0");
  });
});

describe("ReleaseNodeReservationSchema", () => {
  it("accepts an empty body (no override rate)", () => {
    const r = ReleaseNodeReservationSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts an override rate", () => {
    const r = ReleaseNodeReservationSchema.safeParse({ qubicUsdRateScaled: "5000" });
    expect(r.success).toBe(true);
  });
});

// ---------- USD-cents -> QUBIC conversion ----------

describe("usdCentsToQubic", () => {
  it("converts $30 at the Aug 2026 median rate (~0.000000445) to ~67.4M QUBIC", () => {
    // rateScaled = 0.0000004450 stored as 4450 (scaled by 10^10)
    const rateScaled = 4450n;
    const qubic = usdCentsToQubic(3000n, rateScaled);
    // usdCents * 10^8 / rateScaled
    // = 3000 * 100_000_000 / 4450
    // = 300_000_000_000 / 4450
    // = 67_415_730 (integer division, rounded down)
    expect(qubic).toBe(67_415_730n);
    // Sanity: should be in the 60-80M QUBIC range
    expect(qubic).toBeGreaterThan(60_000_000n);
    expect(qubic).toBeLessThan(80_000_000n);
  });

  it("converts $569 at the same rate to ~1.279B QUBIC", () => {
    const rateScaled = 4450n;
    const qubic = usdCentsToQubic(56_900n, rateScaled);
    // 56900 * 10^8 / 4450 = 1_278_651_685 (integer division, rounded down)
    expect(qubic).toBe(1_278_651_685n);
    // Sanity: should be in the 1.2-1.4B QUBIC range
    expect(qubic).toBeGreaterThan(1_200_000_000n);
    expect(qubic).toBeLessThan(1_400_000_000n);
  });

  it("converts $599 (deposit + balance) to ~1.346B QUBIC", () => {
    const rateScaled = 4450n;
    const total = usdCentsToQubic(59_900n, rateScaled);
    const deposit = usdCentsToQubic(3_000n, rateScaled);
    const balance = usdCentsToQubic(56_900n, rateScaled);
    // The total is deposit + balance (within rounding)
    expect(total).toBeGreaterThanOrEqual(deposit + balance - 1n);
    expect(total).toBeLessThanOrEqual(deposit + balance);
  });

  it("rounds down (user pays at least the USD value, never less)", () => {
    // 1 USD cent at a 3-decimal rate
    // usdCents * 10^8 / rateScaled
    // = 1 * 100_000_000 / 3
    // = 33_333_333.33... -> 33_333_333 (rounded down)
    const qubic = usdCentsToQubic(1n, 3n);
    expect(qubic).toBe(33_333_333n);
  });

  it("throws on a zero rate", () => {
    expect(() => usdCentsToQubic(3000n, 0n)).toThrow();
  });

  it("throws on a negative rate", () => {
    // The function is called with a bigint from a regex-validated string,
    // so a negative would never reach here in practice. But defensive.
    expect(() => usdCentsToQubic(3000n, -1n)).toThrow();
  });

  it("returns 0 for 0 USD cents (no charge)", () => {
    expect(usdCentsToQubic(0n, 4450n)).toBe(0n);
  });
});

// ---------- Tier specs ----------

describe("TIER_SPECS", () => {
  it("tier 1: $599 total, $30 deposit, 5.0% ratio", () => {
    const t = TIER_SPECS[1];
    expect(t.tier).toBe(1);
    expect(t.depositUsdCents).toBe(3000n);
    expect(t.balanceUsdCents).toBe(56_900n);
    const ratio = Number(t.depositUsdCents) / Number(t.depositUsdCents + t.balanceUsdCents);
    expect(ratio).toBeCloseTo(0.05, 3);
  });

  it("tier 2: $899 total, $50 deposit, 5.6% ratio", () => {
    const t = TIER_SPECS[2];
    expect(t.depositUsdCents).toBe(5000n);
    expect(t.balanceUsdCents).toBe(84_900n);
    const ratio = Number(t.depositUsdCents) / Number(t.depositUsdCents + t.balanceUsdCents);
    expect(ratio).toBeCloseTo(0.0556, 3);
  });

  it("tier 3: $1,299 total, $75 deposit, 5.8% ratio", () => {
    const t = TIER_SPECS[3];
    expect(t.depositUsdCents).toBe(7500n);
    expect(t.balanceUsdCents).toBe(122_400n);
    const ratio = Number(t.depositUsdCents) / Number(t.depositUsdCents + t.balanceUsdCents);
    expect(ratio).toBeCloseTo(0.0578, 3);
  });

  it("higher tiers have higher USD totals and higher deposit ratios", () => {
    const t1 = Number(TIER_SPECS[1].depositUsdCents + TIER_SPECS[1].balanceUsdCents);
    const t2 = Number(TIER_SPECS[2].depositUsdCents + TIER_SPECS[2].balanceUsdCents);
    const t3 = Number(TIER_SPECS[3].depositUsdCents + TIER_SPECS[3].balanceUsdCents);
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);

    const r1 = Number(TIER_SPECS[1].depositUsdCents) / t1;
    const r2 = Number(TIER_SPECS[2].depositUsdCents) / t2;
    const r3 = Number(TIER_SPECS[3].depositUsdCents) / t3;
    expect(r2).toBeGreaterThan(r1);
    expect(r3).toBeGreaterThan(r2);
  });
});

describe("TIERS_OPEN_FOR_RESERVATION", () => {
  it("includes tier 1", () => {
    expect(TIERS_OPEN_FOR_RESERVATION).toContain(1);
  });

  it("does not include tier 2 or 3 this phase", () => {
    expect(TIERS_OPEN_FOR_RESERVATION).not.toContain(2);
    expect(TIERS_OPEN_FOR_RESERVATION).not.toContain(3);
  });
});

// ---------- Re-exports for downstream services ----------
// (Phase 24.2 — escrow service, Phase 24.4 — Qearn lock wrapper, both
// import the same TIER_SPECS and the same `usdCentsToQubic`. Pin the
// surface here.)

describe("Phase 24.2 re-exports", () => {
  it("exports TIER_SPECS with all three tiers", async () => {
    // Re-import to make sure the surface stays stable across edits.
    const mod = await import("../services/node-reservations.js");
    expect(mod.TIER_SPECS[1].tier).toBe(1);
    expect(mod.TIER_SPECS[2].tier).toBe(2);
    expect(mod.TIER_SPECS[3].tier).toBe(3);
  });

  it("exports usdCentsToQubic that downstream services can call", async () => {
    const mod = await import("../services/node-reservations.js");
    // Same as the standalone test above; pins the contract.
    expect(mod.usdCentsToQubic(3000n, 4450n)).toBe(67_415_730n);
  });
});

// ---------- Phase 24.4 — Qearn yield lock (linear-accrual stub) ----------

import { computeLinearAccrual } from "../services/qearn-lock.js";

describe("computeLinearAccrual", () => {
  it("returns 0 for zero principal", () => {
    expect(computeLinearAccrual(0n, 500, 31_536_000_000)).toBe(0n);
  });

  it("returns 0 for zero apyBps", () => {
    expect(computeLinearAccrual(1_000_000n, 0, 31_536_000_000)).toBe(0n);
  });

  it("returns 0 for zero elapsed", () => {
    expect(computeLinearAccrual(1_000_000n, 500, 0)).toBe(0n);
  });

  it("accrues 5% APY exactly over one year", () => {
    // 1,000,000 QUBIC at 5% APY for 1 year = 50,000 QUBIC
    expect(computeLinearAccrual(1_000_000n, 500, 31_536_000_000)).toBe(50_000n);
  });

  it("accrues ~5% APY for 1 year on the $30 deposit (67.4M QUBIC)", () => {
    // $30 deposit = 67,415,730 QUBIC. 5% APY for 1 year = 3,370,786.5 QUBIC
    // Rounded down: 3,370,786
    const yieldQubic = computeLinearAccrual(67_415_730n, 500, 31_536_000_000);
    expect(yieldQubic).toBe(3_370_786n);
  });

  it("accrues linearly for 6 months", () => {
    // 6 months = half a year -> half the yield of a full year
    const sixMonths = 31_536_000_000 / 2;
    const full = computeLinearAccrual(1_000_000n, 500, 31_536_000_000);
    const half = computeLinearAccrual(1_000_000n, 500, sixMonths);
    expect(half * 2n).toBe(full);
  });

  it("accrues proportionally to principal", () => {
    // 2x principal = 2x yield at the same time and rate
    const a = computeLinearAccrual(1_000_000n, 500, 31_536_000_000);
    const b = computeLinearAccrual(2_000_000n, 500, 31_536_000_000);
    expect(b).toBe(a * 2n);
  });

  it("rounds down (user never gets more than the actual accrual)", () => {
    // 1 QUBIC at 5% APY for 1 second = 0 (rounded down)
    expect(computeLinearAccrual(1n, 500, 1_000)).toBe(0n);
  });
});
