/**
 * P3 stake-attribution audit — Phase 23.3 (p3).
 *
 * Picks N random (user, ann) positions from the AigarthPool
 * simulator and verifies the contract view, an off-chain "mirror"
 * view (representing services/qubic's stake mirror), and a
 * services/ann view all agree on every field.
 *
 * The audit is the post-mainnet check from
 * docs/aigarthpool/audit-checklist.md (P3): "pick 10 random
 * (user, ann) positions and verify the contract + mirror +
 * services/ann agree on every field." This test exercises the
 * audit logic against a deterministic simulator.
 *
 * If the audit detects a divergence it returns the offending
 * field + the three observed values. The standalone Node
 * script at `apps/dashboard/scripts/p3-stake-audit.ts` runs the
 * same audit against a fresh simulator + an injected mismatch,
 * so operators can dry-run before going to production.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AigarthPoolSimulator,
  createSimulator,
  type AigarthPoolEvent,
  type Position,
} from "../src/index.js";

/**
 * Off-chain mirror view. Represents the row that services/qubic's
 * stake mirror would have. Populated in lockstep with the
 * simulator; if the simulator and the mirror disagree, the audit
 * flags it.
 */
type MirrorPosition = Position;

/** services/ann's projection of the same position. */
type AnnPosition = Position;

interface Divergence {
  user: string;
  annId: string;
  field: keyof Position;
  simulator: unknown;
  mirror: unknown;
  ann: unknown;
}

/**
 * Compare a single position across the three views. Returns the
 * first divergence (or null if all three agree).
 */
function diffPosition(
  user: string,
  annId: string,
  sim: Position | null,
  mirror: MirrorPosition | null,
  ann: AnnPosition | null,
): Divergence | null {
  if (sim === null || mirror === null || ann === null) {
    if (sim?.active === false && mirror === null && ann === null) return null;
    if (sim === null && mirror === null && ann === null) return null;
    return {
      user,
      annId,
      field: "active",
      simulator: sim?.active ?? null,
      mirror: mirror?.active ?? null,
      ann: ann?.active ?? null,
    };
  }
  const fields: (keyof Position)[] = ["annId", "amount", "lockUntilEpoch", "qearnLockId", "active"];
  for (const f of fields) {
    if (sim[f] !== mirror[f] || sim[f] !== ann[f]) {
      return { user, annId, field: f, simulator: sim[f], mirror: mirror[f], ann: ann[f] };
    }
  }
  return null;
}

/**
 * Mirror implementation that records every event the simulator
 * emits. In production, this is the watcher in services/qubic.
 *
 * Faithful to the simulator's `getPosition` semantics: it tracks
 * a list of positions per (user, ann) and exposes the FIRST
 * ACTIVE one. PositionClosed pops the first active for that pair
 * and moves it to the closed list. (The simulator's `unlock`
 * marks the first matching position as inactive, so the mirror
 * follows the same shape.)
 */
class MirrorRecorder {
  private active = new Map<string, Position[]>();   // key = `${user}|${annId}` → ordered by open time
  private closed = new Map<string, Position[]>();   // same key → positions that were unlocked

  apply(event: AigarthPoolEvent): void {
    if (event.kind === "PositionOpened") {
      const key = `${event.user}|${event.annId}`;
      const list = this.active.get(key) ?? [];
      list.push({
        annId: event.annId,
        amount: event.amount,
        lockUntilEpoch: event.lockUntilEpoch,
        qearnLockId: event.qearnLockId,
        active: true,
      });
      this.active.set(key, list);
    } else if (event.kind === "PositionClosed") {
      const key = `${event.user}|${event.annId}`;
      const list = this.active.get(key) ?? [];
      // Mirror the simulator's `unlock`: pop the first active for this
      // (user, ann) and mark it as closed. (The simulator keeps the
      // record with active=false; we mirror by moving to `closed`.)
      const first = list.shift();
      if (first) {
        const closedList = this.closed.get(key) ?? [];
        closedList.push({ ...first, active: false });
        this.closed.set(key, closedList);
      }
      if (list.length === 0) {
        this.active.delete(key);
      } else {
        this.active.set(key, list);
      }
    }
  }

  get(user: string, annId: string): Position | null {
    const list = this.active.get(`${user}|${annId}`);
    if (!list || list.length === 0) return null;
    return list[0]!;
  }
}

/**
 * services/ann's projection. For now identical to the simulator's
 * view — services/ann reads from the AigarthPool client directly
 * via getPosition(). In a future where the off-chain world has its
 * own cache, this is the layer that would diverge if the cache
 * goes stale.
 */
class AnnProjector {
  constructor(private pool: AigarthPoolSimulator) {}
  async get(user: string, annId: string): Promise<Position | null> {
    return this.pool.getPosition(user, annId);
  }
}

interface AuditResult {
  sampled: number;
  divergences: Divergence[];
  passed: boolean;
}

/**
 * Sample N random (user, ann) keys and compare across the three views.
 * Uses a deterministic shuffle for reproducibility.
 */
async function runAudit(
  pool: AigarthPoolSimulator,
  mirror: MirrorRecorder,
  ann: AnnProjector,
  allKeys: Array<{ user: string; annId: string }>,
  sampleSize: number,
  seed: number,
): Promise<AuditResult> {
  // Deterministic Fisher-Yates with a tiny LCG.
  const rng = (s: number) => () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const r = rng(seed);
  const indices = Array.from({ length: allKeys.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  const sampled = indices.slice(0, Math.min(sampleSize, allKeys.length));
  const divergences: Divergence[] = [];
  for (const idx of sampled) {
    const { user, annId } = allKeys[idx]!;
    const sim = await pool.getPosition(user, annId);
    const m = mirror.get(user, annId);
    const a = await ann.get(user, annId);
    const d = diffPosition(user, annId, sim, m, a);
    if (d) divergences.push(d);
  }
  return { sampled: sampled.length, divergences, passed: divergences.length === 0 };
}

// ---------- Tests ----------

describe("P3 stake-attribution audit (Phase 23.3)", () => {
  let pool: AigarthPoolSimulator;
  let mirror: MirrorRecorder;
  let ann: AnnProjector;
  let allKeys: Array<{ user: string; annId: string }>;

  const USERS = ["U".padEnd(60, "A"), "U".padEnd(59, "B"), "U".padEnd(58, "C"), "U".padEnd(57, "D")];
  const ANN_1 = "00000000-0000-0000-0000-000000000001";
  const ANN_2 = "00000000-0000-0000-0000-000000000002";
  const CREATOR = "CREATORCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

  beforeEach(async () => {
    pool = createSimulator();
    mirror = new MirrorRecorder();
    ann = new AnnProjector(pool);
    allKeys = [];

    // Wire the mirror to the simulator.
    pool.subscribe((ev) => mirror.apply(ev));

    // Register both ANNs.
    await pool.setAnnSplits(CREATOR, ANN_1, 3_000, 6_000, 1_000, CREATOR);
    await pool.setAnnSplits(CREATOR, ANN_2, 3_000, 6_000, 1_000, CREATOR);

    // Stake 5 amounts for USER_A, 3 for USER_B, 2 for USER_C across both ANNs.
    // 4 of USER_A's stakes will mature + be unlocked + claimed.
    const smallStake = 10_000_000_000n;
    for (let i = 0; i < 5; i++) {
      const annId = i % 2 === 0 ? ANN_1 : ANN_2;
      await pool.stakeForAnn(USERS[0]!, annId, smallStake, 52);
      allKeys.push({ user: USERS[0]!, annId });
    }
    for (let i = 0; i < 3; i++) {
      await pool.stakeForAnn(USERS[1]!, ANN_1, smallStake, 52);
      allKeys.push({ user: USERS[1]!, annId: ANN_1 });
    }
    for (let i = 0; i < 2; i++) {
      await pool.stakeForAnn(USERS[2]!, ANN_2, smallStake, 26);
      allKeys.push({ user: USERS[2]!, annId: ANN_2 });
    }
    // USER_D is a no-op (0 positions) — the audit should still pass on it.

    // Mature USER_A's first 4 positions, then unlock + claim.
    pool.advanceEpochs(52);
    for (let i = 0; i < 4; i++) {
      const k = allKeys[i]!;
      await pool.unlock(k.user, k.annId);
      await pool.claimRewards(k.user, k.annId);
    }
  });

  it("agrees across simulator / mirror / ann for 10 random positions", async () => {
    const result = await runAudit(pool, mirror, ann, allKeys, 10, 0xC0FFEE);
    expect(result.sampled).toBe(10);
    expect(result.passed).toBe(true);
    expect(result.divergences).toEqual([]);
  });

  it("agrees when sample size exceeds available positions (uses min)", async () => {
    const result = await runAudit(pool, mirror, ann, allKeys, 100, 1);
    expect(result.sampled).toBe(allKeys.length);
    expect(result.passed).toBe(true);
  });

  it("agrees with a fresh seed (sample selection is deterministic)", async () => {
    const a = await runAudit(pool, mirror, ann, allKeys, 10, 42);
    const b = await runAudit(pool, mirror, ann, allKeys, 10, 42);
    expect(a.sampled).toBe(b.sampled);
    expect(a.divergences).toEqual(b.divergences);
  });

  it("detects a divergence when the mirror drops an event", async () => {
    // Build a "broken" mirror that ignores the next event.
    const broken = new MirrorRecorder();
    let dropped = 0;
    const original = mirror.apply.bind(mirror);
    void original;
    pool.subscribe((ev) => {
      if (ev.kind === "PositionOpened" && dropped === 0) {
        dropped += 1;
        return;  // skip — simulates a watcher that lost the event
      }
      broken.apply(ev);
    });

    const result = await runAudit(pool, broken, ann, allKeys, 100, 7);
    expect(result.passed).toBe(false);
    expect(result.divergences.length).toBeGreaterThan(0);
  });

  it("detects a divergence when the simulator's state is tampered with", async () => {
    // Reach into the simulator's private state and change the amount
    // of the FIRST ACTIVE position for (USER_A, ANN_1). The first two
    // were unlocked in beforeEach, so the third stake is still active.
    // The mirror + ann stay correct → audit must flag it.
    const internal = pool as unknown as {
      users: Map<string, { positions: Position[] }>;
    };
    const userState = internal.users.get(USERS[0]!);
    expect(userState).toBeDefined();
    // After 2 unlocks of (USER_A, ANN_1), positions[2] is the active one.
    // (positions[0] and [1] are inactive.) Find the active one and tamper.
    const activeIdx = userState!.positions.findIndex((p) => p.active && p.annId === ANN_1);
    expect(activeIdx).toBeGreaterThanOrEqual(0);
    userState!.positions[activeIdx]!.amount = 99_999_999_999n;

    const result = await runAudit(pool, mirror, ann, allKeys, 100, 7);
    expect(result.passed).toBe(false);
    const d = result.divergences[0]!;
    expect(d.field).toBe("amount");
    expect(d.simulator).toBe(99_999_999_999n);
  });

  it("empty mirror (no events seen) flags every active position as a divergence", async () => {
    const emptyMirror = new MirrorRecorder();
    const result = await runAudit(pool, emptyMirror, ann, allKeys, 100, 7);
    expect(result.passed).toBe(false);
    // 6 active positions remain (5+3+2 = 10, minus 4 unlocked = 6 active)
    // + 4 closed positions. The audit compares active + closed.
    expect(result.divergences.length).toBeGreaterThan(0);
  });
});
