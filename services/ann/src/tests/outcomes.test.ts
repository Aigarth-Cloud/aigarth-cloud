/**
 * Tests for the decision-outcomes service (Phase 19D.1).
 *
 * The DB is mocked at the drizzle layer, following the same pattern
 * as `services/training/src/tests/jobs.test.ts` — a Map-backed fake
 * that supports the small subset of operations the outcomes service
 * performs. Condition parsing walks drizzle's SQL chunk tree to
 * extract (column, value) pairs.
 *
 * Coverage:
 *   - RecordOutcomeSchema / ListOutcomesQuerySchema (Zod)
 *   - Error classes (DecisionNotFoundError, AnnMismatchError, OutcomeInvalidError)
 *   - recordOutcome happy path, idempotency, validation, mismatch
 *   - getOutcome null + present
 *   - listOutcomesForAnn pagination + outcome filter
 *   - computeOutcomeStats (successRate, recentSuccessRate, avgConfidenceInLabel)
 *   - serializeDecisionOutcome (shape + snake_case)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- Mock the DB ----------

interface AnnRow {
  id: string;
  slug: string;
  name: string;
  accuracy: string | null;
  latencyP50Ms: number | null;
  ratingAverage: string | null;
}
interface AnnVersionRow {
  id: string;
  annId: string;
  version: string;
}
interface AnnDecisionRow {
  id: string;
  annId: string;
  annVersion: string;
}
interface OutcomeRow {
  id: string;
  decisionId: string;
  annId: string;
  annVersionId: string | null;
  outcome: "success" | "failure" | "reverted" | "unknown";
  confidenceInLabel: string | null;
  notes: string | null;
  recordedBy: string;
  source: string;
  outcomeAt: Date;
  recordedAt: Date;
}

interface Store {
  anns: Map<string, AnnRow>;
  annVersions: Map<string, AnnVersionRow>;
  annDecisions: Map<string, AnnDecisionRow>;
  annDecisionOutcomes: Map<string, OutcomeRow>;
  auditLogs: Array<{ id: string; action: string; metadata: Record<string, unknown> }>;
}

const store: Store = {
  anns: new Map(),
  annVersions: new Map(),
  annDecisions: new Map(),
  annDecisionOutcomes: new Map(),
  auditLogs: [],
};

const DRIZZLE_NAME = Symbol.for("drizzle:Name");

function tableName(t: unknown): string | undefined {
  if (t && typeof t === "object" && DRIZZLE_NAME in t) {
    return (t as Record<symbol, string>)[DRIZZLE_NAME];
  }
  return undefined;
}

interface CondPair {
  column: string;
  value: unknown;
}

function extractConditions(cond: unknown): CondPair[] {
  const out: CondPair[] = [];
  if (!cond || typeof cond !== "object") return out;
  const sqlObj = cond as { queryChunks?: unknown[] };
  const chunks = sqlObj.queryChunks ?? [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as {
      constructor?: { name?: string };
      name?: string;
      queryChunks?: unknown[];
      value?: unknown;
    };
    if (!chunk) continue;
    if (chunk.constructor?.name === "SQL") {
      out.push(...extractConditions(chunk));
      continue;
    }
    if (typeof chunk.name === "string" && chunk.constructor?.name?.startsWith("Pg")) {
      for (let j = i + 1; j < chunks.length; j++) {
        const next = chunks[j] as { constructor?: { name?: string }; value?: unknown };
        if (next?.constructor?.name === "Param") {
          out.push({ column: chunk.name, value: next.value });
          break;
        }
        if (next?.constructor?.name !== "StringChunk") break;
      }
    }
  }
  return out;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function matches(row: Record<string, unknown>, conds: CondPair[]): boolean {
  for (const c of conds) {
    const camelCol = snakeToCamel(c.column);
    if (row[camelCol] !== c.value) return false;
  }
  return true;
}

function makeChain(rows: Array<Record<string, unknown>>) {
  let filteredRows = rows;
  let limitN: number | null = null;
  let offsetN = 0;
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = (cond: unknown) => {
    const conds = extractConditions(cond);
    if (conds.length === 0) return chain;
    filteredRows = filteredRows.filter((r) => matches(r, conds));
    return chain;
  };
  chain.orderBy = () => chain;
  chain.limit = (n: number) => {
    limitN = n;
    return chain;
  };
  chain.offset = (n: number) => {
    offsetN = n;
    return chain;
  };
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (r: unknown) => void) => {
        // Apply offset first, then limit — matches SQL semantics
        // (LIMIT n OFFSET m = skip m, take n).
        const sliced = filteredRows.slice(offsetN);
        const finalRows = limitN !== null ? sliced.slice(0, limitN) : sliced;
        resolve(finalRows);
      };
    },
  });
  return chain;
}

function makeCountChain(rows: Array<Record<string, unknown>>) {
  let filteredRows = rows;
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = (cond: unknown) => {
    const conds = extractConditions(cond);
    if (conds.length === 0) return chain;
    filteredRows = filteredRows.filter((r) => matches(r, conds));
    return chain;
  };
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (r: unknown) => void) => resolve([{ count: filteredRows.length }]);
    },
  });
  return chain;
}

vi.mock("../db/index.js", () => {
  return {
    getDb: () => ({
      select: (selectArg?: unknown) => ({
        from: (table: unknown) => {
          const name = tableName(table);
          const allRows = (): Array<Record<string, unknown>> => {
            if (name === "anns") return Array.from(store.anns.values()).map((r) => ({ ...r }));
            if (name === "ann_versions") return Array.from(store.annVersions.values()).map((r) => ({ ...r }));
            if (name === "ann_decisions") return Array.from(store.annDecisions.values()).map((r) => ({ ...r }));
            if (name === "ann_decision_outcomes")
              return Array.from(store.annDecisionOutcomes.values()).map((r) => ({ ...r }));
            return [];
          };
          if (selectArg && typeof selectArg === "object" && "count" in (selectArg as Record<string, unknown>)) {
            return makeCountChain(allRows());
          }
          return makeChain(allRows());
        },
      }),
      insert: (table: unknown) => ({
        values: (vals: unknown) => {
          const name = tableName(table);
          if (name === "ann_decision_outcomes") {
            const row = (Array.isArray(vals) ? vals[0] : vals) as Partial<OutcomeRow> & { id: string };
            // Apply defaults for fields the service doesn't always pass.
            const filled: OutcomeRow = {
              id: row.id,
              decisionId: row.decisionId!,
              annId: row.annId!,
              annVersionId: row.annVersionId ?? null,
              outcome: row.outcome ?? "unknown",
              confidenceInLabel: row.confidenceInLabel ?? null,
              notes: row.notes ?? null,
              recordedBy: row.recordedBy ?? "00000000-0000-0000-0000-000000000000",
              source: row.source ?? "manual",
              outcomeAt: row.outcomeAt ?? new Date(),
              recordedAt: row.recordedAt ?? new Date(),
            };
            store.annDecisionOutcomes.set(filled.id, filled);
            return { returning: async () => [filled] };
          }
          if (name === "ann_audit_logs") {
            const row = (Array.isArray(vals) ? vals[0] : vals) as {
              id: string;
              action: string;
              metadata: Record<string, unknown>;
            };
            store.auditLogs.push({ id: row.id, action: row.action, metadata: row.metadata });
            return { returning: async () => [] };
          }
          return { returning: async () => [] };
        },
      }),
      update: (table: unknown) => ({
        set: (patch: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            const name = tableName(table);
            const conds = extractConditions(cond);
            const updated: OutcomeRow[] = [];
            if (name === "ann_decision_outcomes") {
              for (const o of store.annDecisionOutcomes.values()) {
                if (matches(o as unknown as Record<string, unknown>, conds)) {
                  Object.assign(o, patch);
                  updated.push(o);
                }
              }
            }
            return {
              returning: async () => updated,
            };
          },
        }),
      }),
    }),
    closeDb: async () => undefined,
  };
});

vi.mock("../config/index.js", () => ({
  loadConfig: () => ({
    NODE_ENV: "test",
    PORT: 7006,
    HOST: "0.0.0.0",
    LOG_LEVEL: "error",
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    JWT_SECRET: "x".repeat(40),
    CORS_ORIGINS: "*",
    COOKIE_SECURE: false,
    ANN_TRINARY_SIGNING_KEY: "test-signing-key",
  }),
}));

// ---------- Test fixtures + helpers ----------

import {
  recordOutcome,
  getOutcome,
  listOutcomesForAnn,
  computeOutcomeStats,
  RecordOutcomeSchema,
  ListOutcomesQuerySchema,
  DecisionNotFoundError,
  AnnMismatchError,
  OutcomeInvalidError,
} from "../services/outcomes.js";
import { serializeDecisionOutcome } from "../lib/serialize.js";

const ANN_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_ANN_ID = "33333333-3333-3333-3333-333333333334";
const VERSION_ID = "44444444-4444-4444-4444-444444444444";
const USER_ID = "55555555-5555-5555-5555-555555555555";
const DECISION_ID = "66666666-6666-6666-6666-666666666666";
const OTHER_DECISION_ID = "66666666-6666-6666-6666-666666666667";

function makeAnn(overrides: Partial<AnnRow> = {}): AnnRow {
  return {
    id: ANN_ID,
    slug: "test-ann",
    name: "Test ANN",
    accuracy: "85.00",
    latencyP50Ms: 100,
    ratingAverage: "4.50",
    ...overrides,
  };
}

function makeVersion(): AnnVersionRow {
  return { id: VERSION_ID, annId: ANN_ID, version: "1.0.0" };
}

function makeDecision(overrides: Partial<AnnDecisionRow> = {}): AnnDecisionRow {
  return {
    id: DECISION_ID,
    annId: ANN_ID,
    annVersion: "1.0.0",
    ...overrides,
  };
}

function seedBasic() {
  store.anns.set(ANN_ID, makeAnn());
  store.anns.set(OTHER_ANN_ID, makeAnn({ id: OTHER_ANN_ID, slug: "other-ann" }));
  store.annVersions.set(VERSION_ID, makeVersion());
  store.annDecisions.set(DECISION_ID, makeDecision());
  store.annDecisions.set(OTHER_DECISION_ID, makeDecision({ id: OTHER_DECISION_ID, annId: OTHER_ANN_ID }));
}

beforeEach(() => {
  store.anns.clear();
  store.annVersions.clear();
  store.annDecisions.clear();
  store.annDecisionOutcomes.clear();
  store.auditLogs.length = 0;
  seedBasic();
});

// ---------- Schemas ----------

describe("outcomes — schemas", () => {
  describe("RecordOutcomeSchema", () => {
    it("accepts a minimal success outcome", () => {
      const r = RecordOutcomeSchema.parse({ outcome: "success" });
      expect(r.outcome).toBe("success");
      expect(r.confidenceInLabel).toBeUndefined();
      expect(r.notes).toBeUndefined();
      expect(r.outcomeAt).toBeUndefined();
    });

    it("accepts a fully populated outcome", () => {
      const r = RecordOutcomeSchema.parse({
        outcome: "failure",
        confidenceInLabel: 0.85,
        notes: "the recommendation backfired",
        outcomeAt: "2026-08-15T10:00:00.000Z",
      });
      expect(r.confidenceInLabel).toBe(0.85);
      expect(r.notes).toBe("the recommendation backfired");
      expect(r.outcomeAt).toBe("2026-08-15T10:00:00.000Z");
    });

    it("rejects an unknown outcome value", () => {
      expect(() => RecordOutcomeSchema.parse({ outcome: "made_up" })).toThrow();
    });

    it("rejects confidenceInLabel out of [0, 1]", () => {
      expect(() => RecordOutcomeSchema.parse({ outcome: "success", confidenceInLabel: 1.5 })).toThrow();
      expect(() => RecordOutcomeSchema.parse({ outcome: "success", confidenceInLabel: -0.1 })).toThrow();
    });
  });

  describe("ListOutcomesQuerySchema", () => {
    it("applies defaults", () => {
      const q = ListOutcomesQuerySchema.parse({});
      expect(q.limit).toBe(20);
      expect(q.offset).toBe(0);
      expect(q.outcome).toBeUndefined();
    });

    it("accepts the outcome filter", () => {
      const q = ListOutcomesQuerySchema.parse({ outcome: "failure" });
      expect(q.outcome).toBe("failure");
    });

    it("rejects an invalid outcome filter", () => {
      expect(() => ListOutcomesQuerySchema.parse({ outcome: "nope" })).toThrow();
    });

    it("rejects limit out of range", () => {
      expect(() => ListOutcomesQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => ListOutcomesQuerySchema.parse({ limit: 101 })).toThrow();
    });
  });
});

// ---------- Error classes ----------

describe("outcomes — errors", () => {
  it("DecisionNotFoundError names the decision id", () => {
    const e = new DecisionNotFoundError("dec_xyz");
    expect(e.name).toBe("DecisionNotFoundError");
    expect(e.message).toContain("dec_xyz");
  });

  it("AnnMismatchError names the expected and actual ANN ids", () => {
    const e = new AnnMismatchError("dec_xyz", ANN_ID, OTHER_ANN_ID);
    expect(e.name).toBe("AnnMismatchError");
    expect(e.message).toContain(ANN_ID);
    expect(e.message).toContain(OTHER_ANN_ID);
  });

  it("OutcomeInvalidError carries the reason", () => {
    const e = new OutcomeInvalidError("outcome must be one of success|failure|reverted|unknown");
    expect(e.name).toBe("OutcomeInvalidError");
    expect(e.message).toContain("outcome must");
  });
});

// ---------- recordOutcome ----------

describe("outcomes — recordOutcome", () => {
  it("happy path: creates a row and returns the outcome (created=true)", async () => {
    const result = await recordOutcome(
      ANN_ID,
      DECISION_ID,
      { outcome: "success", confidenceInLabel: 0.9, notes: "it worked" },
      USER_ID,
    );
    expect(result.created).toBe(true);
    expect(result.row.outcome).toBe("success");
    expect(result.row.decisionId).toBe(DECISION_ID);
    expect(result.row.annId).toBe(ANN_ID);
    expect(result.row.recordedBy).toBe(USER_ID);
    expect(result.row.source).toBe("manual");
    expect(result.row.confidenceInLabel).toBe("0.9");
    expect(result.row.notes).toBe("it worked");
    expect(store.annDecisionOutcomes.size).toBe(1);
    expect(store.auditLogs).toHaveLength(1);
    expect(store.auditLogs[0]!.action).toBe("ann.decision_outcome_recorded");
  });

  it("throws DecisionNotFoundError when the decision does not exist", async () => {
    await expect(
      recordOutcome(ANN_ID, "00000000-0000-0000-0000-000000000000", { outcome: "success" }, USER_ID),
    ).rejects.toBeInstanceOf(DecisionNotFoundError);
  });

  it("throws AnnMismatchError when the decision belongs to a different ANN", async () => {
    await expect(
      recordOutcome(ANN_ID, OTHER_DECISION_ID, { outcome: "success" }, USER_ID),
    ).rejects.toBeInstanceOf(AnnMismatchError);
    // The mismatch path must NOT insert a row.
    expect(store.annDecisionOutcomes.size).toBe(0);
  });

  it("is idempotent: a second call updates the existing row (created=false)", async () => {
    const first = await recordOutcome(ANN_ID, DECISION_ID, { outcome: "success" }, USER_ID);
    expect(first.created).toBe(true);

    const second = await recordOutcome(
      ANN_ID,
      DECISION_ID,
      { outcome: "failure", notes: "actually it broke" },
      USER_ID,
    );
    expect(second.created).toBe(false);
    expect(second.row.outcome).toBe("failure");
    expect(second.row.notes).toBe("actually it broke");
    // Still only one row for this decision.
    expect(store.annDecisionOutcomes.size).toBe(1);
    // The second call audited too.
    expect(store.auditLogs).toHaveLength(2);
  });

  it("validates the outcome enum (Zod rejects unknown values)", () => {
    expect(() => RecordOutcomeSchema.parse({ outcome: "nope" })).toThrow();
  });

  it("accepts every documented outcome enum value", () => {
    for (const outcome of ["success", "failure", "reverted", "unknown"] as const) {
      expect(() => RecordOutcomeSchema.parse({ outcome })).not.toThrow();
    }
  });
});

// ---------- getOutcome ----------

describe("outcomes — getOutcome", () => {
  it("returns null when no outcome has been recorded", async () => {
    const o = await getOutcome(DECISION_ID);
    expect(o).toBeNull();
  });

  it("returns the recorded outcome when present", async () => {
    await recordOutcome(ANN_ID, DECISION_ID, { outcome: "success" }, USER_ID);
    const o = await getOutcome(DECISION_ID);
    expect(o).not.toBeNull();
    expect(o!.decisionId).toBe(DECISION_ID);
    expect(o!.outcome).toBe("success");
  });
});

// ---------- listOutcomesForAnn ----------

describe("outcomes — listOutcomesForAnn", () => {
  it("paginates correctly", async () => {
    // Seed 5 outcomes (5 different decision_ids for a clean fixture)
    for (let i = 0; i < 5; i++) {
      const dId = `dec_${i.toString().padStart(8, "0")}-0000-0000-0000-000000000000`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(ANN_ID, dId, { outcome: "success" }, USER_ID);
    }
    const page1 = await listOutcomesForAnn(ANN_ID, { limit: 3, offset: 0 });
    expect(page1.data).toHaveLength(3);
    expect(page1.total).toBe(5);
    expect(page1.limit).toBe(3);
    expect(page1.offset).toBe(0);

    const page2 = await listOutcomesForAnn(ANN_ID, { limit: 3, offset: 3 });
    expect(page2.data).toHaveLength(2);
    expect(page2.total).toBe(5);
    expect(page2.offset).toBe(3);
  });

  it("filters by outcome", async () => {
    for (let i = 0; i < 3; i++) {
      const dId = `dec_s_${i}-0000-0000-0000-000000000000`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(ANN_ID, dId, { outcome: "success" }, USER_ID);
    }
    for (let i = 0; i < 2; i++) {
      const dId = `dec_f_${i}-0000-0000-0000-000000000000`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(ANN_ID, dId, { outcome: "failure" }, USER_ID);
    }
    const all = await listOutcomesForAnn(ANN_ID, { limit: 20, offset: 0 });
    expect(all.total).toBe(5);

    const onlyFailures = await listOutcomesForAnn(ANN_ID, {
      limit: 20,
      offset: 0,
      outcome: "failure",
    });
    expect(onlyFailures.total).toBe(2);
    expect(onlyFailures.data.every((o) => o.outcome === "failure")).toBe(true);
  });

  it("returns an empty page when the ANN has no outcomes", async () => {
    const result = await listOutcomesForAnn(ANN_ID, { limit: 20, offset: 0 });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ---------- computeOutcomeStats ----------

describe("outcomes — computeOutcomeStats", () => {
  it("returns null successRate when there are no graded outcomes", async () => {
    // Only "unknown" outcomes → no graded rows.
    for (let i = 0; i < 3; i++) {
      const dId = `dec_u_${i}-0000-0000-0000-000000000000`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(ANN_ID, dId, { outcome: "unknown" }, USER_ID);
    }
    const stats = await computeOutcomeStats(ANN_ID);
    expect(stats.totalOutcomes).toBe(3);
    expect(stats.successCount).toBe(0);
    expect(stats.failureCount).toBe(0);
    expect(stats.revertedCount).toBe(0);
    expect(stats.unknownCount).toBe(3);
    expect(stats.successRate).toBeNull();
    expect(stats.recentSuccessRate).toBeNull();
  });

  it("computes the success rate as success / (success + failure + reverted)", async () => {
    // 3 success, 1 failure, 1 reverted → 3 / 5 = 0.6
    const kinds: Array<"success" | "failure" | "reverted"> = [
      "success",
      "success",
      "success",
      "failure",
      "reverted",
    ];
    for (let i = 0; i < kinds.length; i++) {
      const dId = `dec_m_${i}_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(ANN_ID, dId, { outcome: kinds[i]! }, USER_ID);
    }
    const stats = await computeOutcomeStats(ANN_ID);
    expect(stats.totalOutcomes).toBe(5);
    expect(stats.successCount).toBe(3);
    expect(stats.failureCount).toBe(1);
    expect(stats.revertedCount).toBe(1);
    expect(stats.successRate).toBeCloseTo(0.6, 5);
  });

  it("treats 'unknown' as not graded and excludes from success rate", async () => {
    // 2 success, 1 failure, 1 unknown → 2 / 3 = 0.6667
    const seq: Array<"success" | "failure" | "unknown"> = [
      "success",
      "failure",
      "success",
      "unknown",
    ];
    for (let i = 0; i < seq.length; i++) {
      const dId = `dec_n_${i}_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(ANN_ID, dId, { outcome: seq[i]! }, USER_ID);
    }
    const stats = await computeOutcomeStats(ANN_ID);
    expect(stats.totalOutcomes).toBe(4);
    expect(stats.unknownCount).toBe(1);
    expect(stats.successRate).toBeCloseTo(2 / 3, 5);
  });

  it("recentSuccessRate is limited to the last 100 graded outcomes", async () => {
    // 100 outcomes, oldest 50 = all success, newest 50 = all failure.
    // → recentSuccessRate should be 0.0 (only the last 100 count,
    //   all failures).
    // But the spec says last 100 GRADED — we have 100 graded (no
    // unknowns), and the recent window is 100, so we use them all.
    // → recentSuccessRate = 0 / 100 = 0.0
    for (let i = 0; i < 100; i++) {
      const dId = `dec_r_${i.toString().padStart(8, "0")}-cccc-cccc-cccc-cccccccccccc`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      const outcome = i < 50 ? "success" : "failure";
      await recordOutcome(ANN_ID, dId, { outcome }, USER_ID);
    }
    const stats = await computeOutcomeStats(ANN_ID);
    expect(stats.totalOutcomes).toBe(100);
    expect(stats.successCount).toBe(50);
    expect(stats.failureCount).toBe(50);
    // The last 100 graded are all 50 successes (oldest) + 50 failures
    // (newest) — they all fit, so recentSuccessRate == successRate.
    expect(stats.recentSuccessRate).toBeCloseTo(0.5, 5);
    expect(stats.successRate).toBeCloseTo(0.5, 5);

    // Add 25 more success outcomes → now the first 25 successes are
    // pushed out of the recent 100-graded window, leaving the most
    // recent 100 graded = 75 failures + 25 successes → 0.25.
    for (let i = 0; i < 25; i++) {
      const dId = `dec_r_extra_${i}_dddddddd-dddd-dddd-dddd-dddddddddddd`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(ANN_ID, dId, { outcome: "success" }, USER_ID);
    }
    const stats2 = await computeOutcomeStats(ANN_ID);
    expect(stats2.totalOutcomes).toBe(125);
    expect(stats2.successCount).toBe(75);
    expect(stats2.failureCount).toBe(50);
    // Recent 100 graded = 25 newest successes + 75 newest failures
    // (wait, let me re-check) → the newest 100 graded, in order.
    // We added 50 successes, then 50 failures, then 25 successes.
    // Walking newest first: 25 successes, 50 failures, 25 successes.
    // The 100th most recent graded is the 25th success (since the
    // 50 successes are older than all 50 failures, and we have 25+50
    // = 75 graded newer than the success bucket; we need 100, so we
    // need 25 more from the 50 successes → 50 failures + 50 successes
    // wait... 25 successes + 50 failures = 75, need 25 more, which
    // come from the original 50 successes. So recentSuccessRate =
    // 50/100 = 0.5. And successRate = 75/125 = 0.6.
    expect(stats2.recentSuccessRate).toBeCloseTo(0.5, 5);
    expect(stats2.successRate).toBeCloseTo(0.6, 5);
  });

  it("avgConfidenceInLabel is the mean of non-null values", async () => {
    // 0.6 + 0.8 + 0.7 (one null) → mean over the 3 non-null = 0.7
    const seq: Array<number | null> = [0.6, 0.8, null, 0.7];
    for (let i = 0; i < seq.length; i++) {
      const dId = `dec_c_${i}_eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(
        ANN_ID,
        dId,
        seq[i] !== null ? { outcome: "success", confidenceInLabel: seq[i]! } : { outcome: "success" },
        USER_ID,
      );
    }
    const stats = await computeOutcomeStats(ANN_ID);
    expect(stats.avgConfidenceInLabel).toBeCloseTo(0.7, 5);
  });

  it("avgConfidenceInLabel is null when no confidence values are recorded", async () => {
    for (let i = 0; i < 3; i++) {
      const dId = `dec_x_${i}_ffffffff-ffff-ffff-ffff-ffffffffffff`.slice(0, 36);
      store.annDecisions.set(dId, { id: dId, annId: ANN_ID, annVersion: "1.0.0" });
      await recordOutcome(ANN_ID, dId, { outcome: "success" }, USER_ID);
    }
    const stats = await computeOutcomeStats(ANN_ID);
    expect(stats.avgConfidenceInLabel).toBeNull();
  });

  it("lastRecordedAt is the most recent recordedAt (or null)", async () => {
    expect((await computeOutcomeStats(ANN_ID)).lastRecordedAt).toBeNull();
    await recordOutcome(ANN_ID, DECISION_ID, { outcome: "success" }, USER_ID);
    const stats = await computeOutcomeStats(ANN_ID);
    expect(stats.lastRecordedAt).not.toBeNull();
    // ISO format check.
    expect(() => new Date(stats.lastRecordedAt!).toISOString()).not.toThrow();
  });
});

// ---------- serializeDecisionOutcome ----------

describe("serializeDecisionOutcome", () => {
  it("emits snake_case fields", async () => {
    const { row } = await recordOutcome(ANN_ID, DECISION_ID, { outcome: "success" }, USER_ID);
    const s = serializeDecisionOutcome(row);
    expect(s.id).toBe(row.id);
    expect(s.decision_id).toBe(DECISION_ID);
    expect(s.ann_id).toBe(ANN_ID);
    expect(s.outcome).toBe("success");
    expect(s.recorded_by).toBe(USER_ID);
    expect(s.source).toBe("manual");
    expect(s.outcome_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(s.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
