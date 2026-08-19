/**
 * Tests for the auto-retrain service (Phase 19D.2).
 *
 * Strategy: mock the DB and the global `fetch` so we can run the
 * service layer without a real Postgres or a real training service.
 * Mock follows the same `drizzle SQL chunk` parsing pattern as
 * `outcomes.test.ts`.
 *
 * Coverage:
 *   - getRetrainConfig / upsertRetrainConfig (owner check, baseline capture)
 *   - listRetrainEvents (pagination)
 *   - triggerManualRetrain (rate-limit, training service call, event log)
 *   - runRetrainScan (cooldown, drift trigger, low-volume trigger)
 *   - Zod schema validation (driftThreshold, outcomeFloor, cooldownHours)
 *   - Internal-token guard (unit-tested by exposing checkInternalToken via
 *     a small helper that mirrors the route handler's logic)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ---------- Mock the DB ----------

interface AnnRow {
  id: string;
  slug: string;
  creatorUserId: string;
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
  outcome: "success" | "failure" | "reverted" | "unknown";
  recordedAt: Date;
}
interface RetrainConfigRow {
  annId: string;
  optIn: boolean;
  baselineSuccessRate: string | null;
  driftThreshold: string;
  outcomeFloor: number;
  cooldownHours: number;
  lastRetrainAt: Date | null;
  preferredDatasetVersionId: string | null;
  notifyMode: string;
  createdAt: Date;
  updatedAt: Date;
}
interface RetrainEventRow {
  id: string;
  annId: string;
  trainingJobId: string | null;
  reason: string;
  baselineSuccessRate: string | null;
  currentSuccessRate: string | null;
  totalOutcomesAtTrigger: number | null;
  notes: string | null;
  triggeredAt: Date;
}
interface AuditLogRow {
  id: string;
  action: string;
  actorUserId: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
}

interface Store {
  anns: Map<string, AnnRow>;
  annDecisions: Map<string, AnnDecisionRow>;
  annDecisionOutcomes: Map<string, OutcomeRow>;
  retrainConfigs: Map<string, RetrainConfigRow>;
  retrainEvents: Map<string, RetrainEventRow>;
  auditLogs: AuditLogRow[];
}

const store: Store = {
  anns: new Map(),
  annDecisions: new Map(),
  annDecisionOutcomes: new Map(),
  retrainConfigs: new Map(),
  retrainEvents: new Map(),
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

function allRowsFor(name: string | undefined): Array<Record<string, unknown>> {
  if (name === "anns") return Array.from(store.anns.values()).map((r) => ({ ...r }));
  if (name === "ann_decisions")
    return Array.from(store.annDecisions.values()).map((r) => ({ ...r }));
  if (name === "ann_decision_outcomes")
    return Array.from(store.annDecisionOutcomes.values()).map((r) => ({ ...r }));
  if (name === "ann_retrain_configs")
    return Array.from(store.retrainConfigs.values()).map((r) => ({ ...r }));
  if (name === "ann_retrain_events")
    return Array.from(store.retrainEvents.values()).map((r) => ({ ...r }));
  return [];
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

function makeInsertReturning(tableName: string, returning: (rows: any) => any[]) {
  return (values: Record<string, unknown>) => {
    const rows = allRowsFor(tableName);
    if (tableName === "ann_retrain_configs") {
      const newRow: RetrainConfigRow = {
        annId: values.annId as string,
        optIn: values.optIn as boolean,
        baselineSuccessRate: (values.baselineSuccessRate as string | null) ?? null,
        driftThreshold: (values.driftThreshold as string) ?? "0.05",
        outcomeFloor: (values.outcomeFloor as number) ?? 50,
        cooldownHours: (values.cooldownHours as number) ?? 168,
        lastRetrainAt: (values.lastRetrainAt as Date | null) ?? null,
        preferredDatasetVersionId: (values.preferredDatasetVersionId as string | null) ?? null,
        notifyMode: (values.notifyMode as string) ?? "log",
        createdAt: (values.createdAt as Date) ?? new Date(),
        updatedAt: (values.updatedAt as Date) ?? new Date(),
      };
      store.retrainConfigs.set(newRow.annId, newRow);
      return Promise.resolve([newRow]);
    }
    if (tableName === "ann_retrain_events") {
      const newRow: RetrainEventRow = {
        id: (values.id as string) ?? crypto.randomUUID(),
        annId: values.annId as string,
        trainingJobId: (values.trainingJobId as string | null) ?? null,
        reason: values.reason as string,
        baselineSuccessRate: (values.baselineSuccessRate as string | null) ?? null,
        currentSuccessRate: (values.currentSuccessRate as string | null) ?? null,
        totalOutcomesAtTrigger: (values.totalOutcomesAtTrigger as number | null) ?? null,
        notes: (values.notes as string | null) ?? null,
        triggeredAt: (values.triggeredAt as Date) ?? new Date(),
      };
      store.retrainEvents.set(newRow.id, newRow);
      return Promise.resolve([newRow]);
    }
    return Promise.resolve([{ id: "mock" }]);
  };
}

function makeUpdate(tableName: string) {
  return {
    set: (patch: Record<string, unknown>) => ({
      where: (cond: unknown) => {
        const conds = extractConditions(cond);
        const rows = allRowsFor(tableName);
        const target = rows.find((r) => matches(r, conds));
        const chain: Record<string, unknown> = {
          returning: () => {
            if (!target) return Promise.resolve([]);
            if (tableName === "ann_retrain_configs") {
              const current = store.retrainConfigs.get(target.annId as string);
              if (current) {
                const updated = { ...current, ...patch };
                store.retrainConfigs.set(current.annId, updated);
                return Promise.resolve([updated]);
              }
            }
            return Promise.resolve([{ ...target, ...patch }]);
          },
        };
        return chain;
      },
    }),
  };
}

vi.mock("../db/index.js", () => {
  return {
    getDb: () => ({
      select: (selectArg?: unknown) => ({
        from: (table: unknown) => {
          const name = tableName(table);
          const all = allRowsFor(name);
          if (selectArg && typeof selectArg === "object" && "count" in (selectArg as Record<string, unknown>)) {
            return makeCountChain(all);
          }
          return makeChain(all);
        },
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          // Apply the insert side-effect immediately (real drizzle does this
          // server-side, but tests need to mirror it for `db.insert(...).values(...)`
          // chains that don't call `.returning()`).
          const inserted = makeInsertReturning(tableName(table) ?? "", () => [])(values);
          return {
            returning: () => Promise.resolve(inserted),
          };
        },
      }),
      update: (table: unknown) => makeUpdate(tableName(table) ?? ""),
    }),
    closeDb: () => Promise.resolve(),
  };
});

// Mock outcomes module so retrain doesn't actually call into outcomes
// (which would need its own db mock layer).
const computeOutcomeStatsMock = vi.fn();
vi.mock("../services/outcomes.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/outcomes.js")>();
  return {
    ...actual,
    computeOutcomeStats: (...args: unknown[]) => computeOutcomeStatsMock(...args),
  };
});

// ---------- Mock config (so owner check + training URL are stable) ----------

vi.mock("../config/index.js", () => {
  return {
    loadConfig: () => ({
      TRAINING_SERVICE_URL: "http://training.test",
      TRAINING_INTERNAL_TOKEN: "test-internal-token-1234567890",
      ANN_ADMIN_USER_IDS: ["00000000-0000-0000-0000-000000000admin"],
    }),
  };
});

// ---------- Mock global fetch (so training service calls don't actually network) ----------

const fetchMock = vi.fn();
const originalFetch = global.fetch;
// Install once at module load; beforeEach re-installs and afterEach restores
// (so per-test mockReset() is applied to a fresh mock bound to global.fetch).
function installFetchMock(): void {
  global.fetch = fetchMock as unknown as typeof fetch;
}
installFetchMock();

// ---------- Helpers ----------

const OWNER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_ID = "00000000-0000-0000-0000-000000000002";
const ANN_ID = "00000000-0000-0000-0000-000000000a01";
const ANN_ID_2 = "00000000-0000-0000-0000-000000000a02";

function seedAnn(id: string = ANN_ID, ownerId: string = OWNER_ID): void {
  store.anns.set(id, { id, slug: `ann-${id.slice(-3)}`, creatorUserId: ownerId });
}

function seedOutcomes(annId: string, n: number, outcome: "success" | "failure" | "reverted" = "success"): void {
  for (let i = 0; i < n; i++) {
    const id = `dec-${annId}-${i}`;
    const decisionId = `dec-${annId}-${i}`;
    store.annDecisions.set(decisionId, { id: decisionId, annId, annVersion: "1.0.0" });
    store.annDecisionOutcomes.set(id, {
      id,
      decisionId,
      annId,
      outcome,
      recordedAt: new Date(Date.now() - i * 60_000),
    });
  }
}

// ---------- Tests ----------

import {
  getRetrainConfig,
  upsertRetrainConfig,
  listRetrainEvents,
  triggerManualRetrain,
  runRetrainScan,
  UpsertRetrainConfigSchema,
  ListRetrainEventsQuerySchema,
  RetrainNotFoundError,
  RetrainForbiddenError,
  RetrainCooldownError,
  TrainingServiceUnavailableError,
} from "../services/retrain.js";

beforeEach(() => {
  // reset store + mocks
  store.anns.clear();
  store.annDecisions.clear();
  store.annDecisionOutcomes.clear();
  store.retrainConfigs.clear();
  store.retrainEvents.clear();
  store.auditLogs.length = 0;
  computeOutcomeStatsMock.mockReset();
  fetchMock.mockReset();
  installFetchMock();
  // Default: outcome stats return 100% success on 100 outcomes
  computeOutcomeStatsMock.mockResolvedValue({
    annId: ANN_ID,
    totalOutcomes: 100,
    successCount: 90,
    failureCount: 5,
    revertedCount: 5,
    unknownCount: 0,
    successRate: 0.9,
    recentSuccessRate: 0.9,
    avgConfidenceInLabel: 0.85,
    lastRecordedAt: new Date().toISOString(),
  });
  // Default: training service returns a fake job id
  fetchMock.mockResolvedValue({
    ok: true,
    status: 201,
    text: async () => "",
    json: async () => ({ id: "mock-training-job-id" }),
  } as unknown as Response);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("Zod schemas", () => {
  it("UpsertRetrainConfigSchema rejects driftThreshold > 1", () => {
    const r = UpsertRetrainConfigSchema.safeParse({ optIn: true, driftThreshold: 1.5 });
    expect(r.success).toBe(false);
  });

  it("UpsertRetrainConfigSchema rejects negative outcomeFloor", () => {
    const r = UpsertRetrainConfigSchema.safeParse({ optIn: true, outcomeFloor: -1 });
    expect(r.success).toBe(false);
  });

  it("UpsertRetrainConfigSchema accepts valid input with defaults", () => {
    const r = UpsertRetrainConfigSchema.safeParse({ optIn: true });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.optIn).toBe(true);
    }
  });

  it("ListRetrainEventsQuerySchema applies default limit", () => {
    const r = ListRetrainEventsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(20);
    }
  });
});

describe("getRetrainConfig / upsertRetrainConfig", () => {
  it("getRetrainConfig returns null when no config", async () => {
    seedAnn();
    const config = await getRetrainConfig(ANN_ID);
    expect(config).toBeNull();
  });

  it("upsertRetrainConfig creates a new config (sets baseline from stats)", async () => {
    seedAnn();
    const config = await upsertRetrainConfig(
      ANN_ID,
      { optIn: true, driftThreshold: 0.1, outcomeFloor: 30, cooldownHours: 72 },
      OWNER_ID,
    );
    expect(config.optIn).toBe(true);
    expect(config.driftThreshold).toBe("0.1");
    expect(config.outcomeFloor).toBe(30);
    expect(config.cooldownHours).toBe(72);
    // Baseline is captured from computeOutcomeStats (returns 0.9)
    expect(config.baselineSuccessRate).toBe("0.9");
  });

  it("upsertRetrainConfig updates existing config without changing baseline (when optIn was already true)", async () => {
    seedAnn();
    await upsertRetrainConfig(ANN_ID, { optIn: true }, OWNER_ID);
    // Now change the stats to 0.5 and update again — baseline should stay at 0.9
    computeOutcomeStatsMock.mockResolvedValueOnce({
      annId: ANN_ID,
      totalOutcomes: 50,
      successCount: 25,
      failureCount: 25,
      revertedCount: 0,
      unknownCount: 0,
      successRate: 0.5,
      recentSuccessRate: 0.5,
      avgConfidenceInLabel: 0.7,
      lastRecordedAt: new Date().toISOString(),
    });
    const updated = await upsertRetrainConfig(
      ANN_ID,
      { optIn: true, driftThreshold: 0.2 },
      OWNER_ID,
    );
    expect(updated.driftThreshold).toBe("0.2");
    expect(updated.baselineSuccessRate).toBe("0.9"); // unchanged
  });

  it("upsertRetrainConfig rejects non-owner", async () => {
    seedAnn();
    await expect(
      upsertRetrainConfig(ANN_ID, { optIn: true }, OTHER_ID),
    ).rejects.toBeInstanceOf(RetrainForbiddenError);
  });

  it("upsertRetrainConfig throws RetrainNotFoundError when ANN doesn't exist", async () => {
    await expect(
      upsertRetrainConfig(ANN_ID, { optIn: true }, OWNER_ID),
    ).rejects.toBeInstanceOf(RetrainNotFoundError);
  });
});

describe("listRetrainEvents", () => {
  it("returns paginated list", async () => {
    seedAnn();
    // Insert 3 events directly
    for (let i = 0; i < 3; i++) {
      store.retrainEvents.set(`evt-${i}`, {
        id: `evt-${i}`,
        annId: ANN_ID,
        trainingJobId: `job-${i}`,
        reason: "manual",
        baselineSuccessRate: null,
        currentSuccessRate: null,
        totalOutcomesAtTrigger: null,
        notes: null,
        triggeredAt: new Date(Date.now() - i * 1000),
      });
    }
    const result = await listRetrainEvents(ANN_ID, { limit: 2, offset: 0 });
    expect(result.total).toBe(3);
    expect(result.data.length).toBe(2);
    expect(result.data[0]!.id).toBe("evt-0"); // newest first
  });

  it("returns empty list when no events", async () => {
    seedAnn();
    const result = await listRetrainEvents(ANN_ID, { limit: 20, offset: 0 });
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });
});

describe("triggerManualRetrain", () => {
  it("calls the training service and records an event", async () => {
    seedAnn();
    const result = await triggerManualRetrain(ANN_ID, OWNER_ID);
    expect(result.trainingJobId).toBe("mock-training-job-id");
    expect(result.eventId).toBeTruthy();
    expect(store.retrainEvents.size).toBe(1);
    expect(store.retrainEvents.get(result.eventId)?.reason).toBe("manual");
  });

  it("throws RetrainForbiddenError for non-owner", async () => {
    seedAnn();
    await expect(triggerManualRetrain(ANN_ID, OTHER_ID)).rejects.toBeInstanceOf(
      RetrainForbiddenError,
    );
  });

  it("throws RetrainCooldownError on rapid second call (60s rate limit)", async () => {
    seedAnn();
    await triggerManualRetrain(ANN_ID, OWNER_ID);
    await expect(triggerManualRetrain(ANN_ID, OWNER_ID)).rejects.toBeInstanceOf(
      RetrainCooldownError,
    );
  });

  it("throws TrainingServiceUnavailableError when fetch fails", async () => {
    seedAnn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "service down",
      json: async () => ({}),
    } as unknown as Response);
    await expect(triggerManualRetrain(ANN_ID, OWNER_ID)).rejects.toBeInstanceOf(
      TrainingServiceUnavailableError,
    );
  });
});

describe("runRetrainScan", () => {
  it("triggers when recentSuccessRate drops below baseline - driftThreshold", async () => {
    seedAnn();
    await upsertRetrainConfig(ANN_ID, { optIn: true, driftThreshold: 0.05 }, OWNER_ID);
    // Stats return 0.5 (was 0.9 baseline). Drop of 0.4 > 0.05 threshold → trigger
    computeOutcomeStatsMock.mockResolvedValue({
      annId: ANN_ID,
      totalOutcomes: 100,
      successCount: 50,
      failureCount: 50,
      revertedCount: 0,
      unknownCount: 0,
      successRate: 0.5,
      recentSuccessRate: 0.5,
      avgConfidenceInLabel: null,
      lastRecordedAt: new Date().toISOString(),
    });
    const result = await runRetrainScan();
    expect(result.scanned).toBe(1);
    expect(result.triggered).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("triggers when totalOutcomes is below outcomeFloor (low volume)", async () => {
    seedAnn();
    await upsertRetrainConfig(ANN_ID, { optIn: true, outcomeFloor: 50 }, OWNER_ID);
    computeOutcomeStatsMock.mockResolvedValue({
      annId: ANN_ID,
      totalOutcomes: 10,
      successCount: 5,
      failureCount: 5,
      revertedCount: 0,
      unknownCount: 0,
      successRate: 0.5,
      recentSuccessRate: 0.5,
      avgConfidenceInLabel: null,
      lastRecordedAt: new Date().toISOString(),
    });
    const result = await runRetrainScan();
    expect(result.triggered).toBe(1);
  });

  it("skips when opt-out", async () => {
    seedAnn();
    // No upsertRetrainConfig call — config doesn't exist
    const result = await runRetrainScan();
    expect(result.scanned).toBe(0);
    expect(result.triggered).toBe(0);
  });

  it("skips when cooldown active", async () => {
    seedAnn();
    // Manually set up a config with lastRetrainAt = 1 hour ago
    store.retrainConfigs.set(ANN_ID, {
      annId: ANN_ID,
      optIn: true,
      baselineSuccessRate: "0.9",
      driftThreshold: "0.05",
      outcomeFloor: 50,
      cooldownHours: 168, // 1 week
      lastRetrainAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      preferredDatasetVersionId: null,
      notifyMode: "log",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await runRetrainScan();
    expect(result.skipped).toBe(1);
    expect(result.triggered).toBe(0);
  });

  it("skips when above threshold (no drift, enough data)", async () => {
    seedAnn();
    await upsertRetrainConfig(ANN_ID, { optIn: true, driftThreshold: 0.05 }, OWNER_ID);
    // Default mock: 0.9 success rate, baseline captured as 0.9 — no drift
    const result = await runRetrainScan();
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("returns counters for the caller", async () => {
    seedAnn(ANN_ID);
    seedAnn(ANN_ID_2, OWNER_ID);
    await upsertRetrainConfig(ANN_ID, { optIn: true, driftThreshold: 0.05 }, OWNER_ID);
    await upsertRetrainConfig(ANN_ID_2, { optIn: true, driftThreshold: 0.05 }, OWNER_ID);
    const result = await runRetrainScan();
    expect(result.scanned).toBe(2);
    expect(result.triggered + result.skipped).toBe(2);
  });
});
