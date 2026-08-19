/**
 * Tests for the version router (Phase 19D.3).
 *
 * Strategy: the version router reads `ann_deployments` and
 * `ann_versions` via drizzle. We mock those two tables' `select`
 * chains. The mock walks the SQL chunk tree to extract conditions
 * (eq, and, inArray) and applies them to the seeded rows.
 *
 * The picking logic (weighted random + 50/50 shadow split) is
 * deterministic given a `rand` seed, which is what we test here.
 *
 * Coverage:
 *   - pickByWeight: empty / single / multiple / all-zero / negative
 *   - pickServingDeployment: returns null when no active/canary; with
 *     weight=100 picks that one; with 50/50 weights picks both over
 *     many calls; falls through to version lookup
 *   - pickShadowDeployment: returns null when no shadow; 50/50 split
 *     over many calls
 *   - row-level "version not found" returns null
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- Mock the DB (with real condition filtering) ----------
//
// The router calls:
//
//   db.select().from(annDeployments).where(<cond on annId+status+mode>)
//
// We parse the SQL chunk tree to extract conditions, then apply them
// to the seeded rows. The chunk tree format (drizzle-orm 0.42):
//
//   and(eq(a, "x"), eq(b, "y"))        →  SQL [ SQL, SQL ]
//   eq(col, val)                       →  SQL [ PgColumn, Param ]
//   inArray(col, [v1, v2])             →  SQL [ PgColumn, StringChunk(" IN ("), Param(v1), StringChunk(","), Param(v2), StringChunk(")") ]
//
// We walk each chunk and produce a predicate `(row) => bool`.

interface DeploymentRow {
  id: string;
  annId: string;
  versionId: string;
  status: "pending" | "running" | "stopped" | "failed";
  deployMode: "active" | "canary" | "shadow" | "deprecated";
  trafficWeight: number;
  ownerUserId: string;
  costPerCallQubic: bigint;
  replicas: number;
  endpointUrl: string | null;
  regionId: string | null;
  clusterId: string | null;
  computeJobId: string | null;
  deployedAt: Date | null;
  stoppedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface VersionRow {
  id: string;
  annId: string;
  version: string;
  isLatest: boolean;
  recipeId: string | null;
  changelog: string | null;
  trainedOnDatasetVersionId: string | null;
  createdAt: Date;
}

interface Store {
  deployments: Map<string, DeploymentRow>;
  versions: Map<string, VersionRow>;
}

const store: Store = {
  deployments: new Map(),
  versions: new Map(),
};

const DRIZZLE_NAME = Symbol.for("drizzle:Name");

function tableName(t: unknown): string | undefined {
  if (t && typeof t === "object" && DRIZZLE_NAME in t) {
    return (t as Record<symbol, string>)[DRIZZLE_NAME];
  }
  return undefined;
}

interface CondClause {
  kind: "eq" | "in";
  column: string;
  value: unknown;
}

/** Walk a SQL chunk tree and extract column-equality / column-in clauses. */
function extractCondClauses(cond: unknown, out: CondClause[] = []): CondClause[] {
  if (!cond || typeof cond !== "object") return out;
  const sqlObj = cond as { queryChunks?: unknown[] };
  const chunks = sqlObj.queryChunks ?? [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as {
      constructor?: { name?: string };
      name?: string;
      queryChunks?: unknown[];
      value?: unknown;
      shouldEscape?: boolean;
    };
    if (!chunk) continue;
    // Recurse into nested SQL chunks (handles `and(...)`)
    if (chunk.constructor?.name === "SQL") {
      extractCondClauses(chunk, out);
      continue;
    }
    // Identify a column reference (PgColumn has constructor.name starting with "Pg")
    if (typeof chunk.name === "string" && chunk.constructor?.name?.startsWith("Pg")) {
      // Look ahead. Two shapes:
      //   eq(col, val)         → StringChunks + Param (single value)
      //   inArray(col, [a,b])  → StringChunk " in " + Array of Params
      // The Array chunk is a real JS Array whose elements are Param chunks.
      let sawInMarker = false;
      for (let j = i + 1; j < chunks.length; j++) {
        const next = chunks[j] as {
          constructor?: { name?: string };
          value?: unknown;
          length?: number;
        };
        const ctorName = next?.constructor?.name;
        if (ctorName === "StringChunk") {
          if (typeof next.value === "string" && /\b(in|not in)\b/i.test(next.value)) {
            sawInMarker = true;
          }
          continue;
        }
        if (ctorName === "Param") {
          // single-value Param → eq
          if (!sawInMarker) {
            out.push({ kind: "eq", column: chunk.name, value: next.value });
          }
          // If sawInMarker, we'd have hit the Array chunk first; bail.
          break;
        }
        if (Array.isArray(next) || ctorName === "Array") {
          // inArray: collect Param values
          const arr = next as unknown as Array<{ value?: unknown; constructor?: { name?: string } }>;
          const values: unknown[] = [];
          if (Array.isArray(arr)) {
            for (const v of arr) {
              if (v && v.constructor?.name === "Param") values.push(v.value);
              else values.push(v);
            }
          }
          out.push({ kind: "in", column: chunk.name, value: values });
          break;
        }
        // Unknown chunk type — stop scanning for this column
        break;
      }
    }
  }
  return out;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function rowMatches(row: Record<string, unknown>, clauses: CondClause[]): boolean {
  for (const c of clauses) {
    const camelCol = snakeToCamel(c.column);
    const cell = row[camelCol];
    if (c.kind === "eq") {
      if (cell !== c.value) return false;
    } else {
      // in
      const arr = Array.isArray(c.value) ? c.value : [c.value];
      if (!arr.includes(cell)) return false;
    }
  }
  return true;
}

vi.mock("../db/index.js", () => {
  return {
    getDb: () => ({
      select: () => ({
        from: (table: unknown) => {
          const name = tableName(table);
          let allRows: Array<Record<string, unknown>> = [];
          if (name === "ann_deployments") {
            allRows = Array.from(store.deployments.values()).map((r) => ({ ...r }));
          } else if (name === "ann_versions") {
            allRows = Array.from(store.versions.values()).map((r) => ({ ...r }));
          }

          let filtered = allRows;
          const chain: Record<string, unknown> = {
            where: (cond: unknown) => {
              const clauses = extractCondClauses(cond);
              if (clauses.length > 0) {
                filtered = allRows.filter((r) => rowMatches(r, clauses));
              }
              return chain;
            },
            orderBy: () => chain,
            limit: () => chain,
            offset: () => chain,
          };
          Object.defineProperty(chain, "then", {
            get() {
              return (resolve: (r: unknown) => void) => resolve(filtered);
            },
          });
          return chain;
        },
      }),
    }),
    closeDb: () => Promise.resolve(),
  };
});

// ---------- Test fixtures ----------

const ANN_ID = "00000000-0000-0000-0000-000000000a01";
const VER_A = "00000000-0000-0000-0000-0000000v000a";
const VER_B = "00000000-0000-0000-0000-0000000v000b";
const VER_C = "00000000-0000-0000-0000-0000000v000c";

function seedVersion(id: string, semver: string): void {
  store.versions.set(id, {
    id,
    annId: ANN_ID,
    version: semver,
    isLatest: true,
    recipeId: null,
    changelog: null,
    trainedOnDatasetVersionId: null,
    createdAt: new Date(),
  });
}

function seedDeployment(opts: {
  id: string;
  versionId: string;
  mode: "active" | "canary" | "shadow" | "deprecated";
  weight: number;
  status?: DeploymentRow["status"];
}): void {
  store.deployments.set(opts.id, {
    id: opts.id,
    annId: ANN_ID,
    versionId: opts.versionId,
    status: opts.status ?? "running",
    deployMode: opts.mode,
    trafficWeight: opts.weight,
    ownerUserId: "00000000-0000-0000-0000-000000000owner",
    costPerCallQubic: 1000n,
    replicas: 1,
    endpointUrl: `https://example.com/${opts.id}`,
    regionId: null,
    clusterId: null,
    computeJobId: null,
    deployedAt: new Date(),
    stoppedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

beforeEach(() => {
  store.deployments.clear();
  store.versions.clear();
  seedVersion(VER_A, "1.0.0");
  seedVersion(VER_B, "1.1.0");
  seedVersion(VER_C, "2.0.0");
});

// ---------- Import after mocks are set up ----------

import { pickByWeight, pickServingDeployment, pickShadowDeployment } from "../services/versionRouter.js";

// ---------- Tests ----------

describe("pickByWeight", () => {
  it("returns null for empty input", () => {
    expect(pickByWeight([])).toBeNull();
  });

  it("returns the only item when there's just one", () => {
    const only = { trafficWeight: 50 };
    expect(pickByWeight([only], () => 0.5)).toBe(only);
  });

  it("returns the first item when all weights are zero (degenerate config)", () => {
    const a = { trafficWeight: 0 };
    const b = { trafficWeight: 0 };
    const c = { trafficWeight: 0 };
    expect(pickByWeight([a, b, c], () => 0.5)).toBe(a);
  });

  it("treats negative weights as zero (defensive)", () => {
    const a = { trafficWeight: -5 };
    const b = { trafficWeight: 0 };
    const c = { trafficWeight: -10 };
    // Total weight = 0 → falls back to the first item
    expect(pickByWeight([a, b, c], () => 0.9)).toBe(a);
  });

  it("picks deterministically by weight when rand is seeded", () => {
    const a = { trafficWeight: 100 };
    const b = { trafficWeight: 0 };
    // r=0.0 → a (its weight span [0,100) covers r)
    expect(pickByWeight([a, b], () => 0.0)).toBe(a);
    expect(pickByWeight([a, b], () => 0.5)).toBe(a);
    expect(pickByWeight([a, b], () => 0.99)).toBe(a);
  });

  it("distributes 50/50 weights evenly across many picks", () => {
    const a = { trafficWeight: 50 };
    const b = { trafficWeight: 50 };
    const N = 2000;
    let aCount = 0;
    let bCount = 0;
    for (let i = 0; i < N; i++) {
      // Use a stable LCG so this is fully deterministic
      const r = ((i * 2654435761) >>> 0) / 0x100000000;
      const picked = pickByWeight([a, b], () => r);
      if (picked === a) aCount++;
      else bCount++;
    }
    // Allow generous tolerance: ±10% of N/2
    expect(Math.abs(aCount - bCount)).toBeLessThan(N * 0.1);
    expect(aCount + bCount).toBe(N);
  });

  it("respects weighted distribution (80/20 split)", () => {
    const a = { trafficWeight: 80 };
    const b = { trafficWeight: 20 };
    const N = 2000;
    let aCount = 0;
    let bCount = 0;
    for (let i = 0; i < N; i++) {
      const r = ((i * 2654435761) >>> 0) / 0x100000000;
      const picked = pickByWeight([a, b], () => r);
      if (picked === a) aCount++;
      else bCount++;
    }
    // Expect ~80% a, ~20% b
    expect(aCount / N).toBeGreaterThan(0.7);
    expect(aCount / N).toBeLessThan(0.9);
    expect(bCount / N).toBeGreaterThan(0.1);
    expect(bCount / N).toBeLessThan(0.3);
  });
});

describe("pickServingDeployment", () => {
  it("returns null when there are no deployments", async () => {
    const result = await pickServingDeployment(ANN_ID, () => 0.5);
    expect(result).toBeNull();
  });

  it("returns null when only shadow deployments exist (no active/canary)", async () => {
    seedDeployment({ id: "d-shadow", versionId: VER_A, mode: "shadow", weight: 100 });
    const result = await pickServingDeployment(ANN_ID, () => 0.5);
    expect(result).toBeNull();
  });

  it("returns null when deployment's status is not 'running'", async () => {
    seedDeployment({ id: "d-pending", versionId: VER_A, mode: "active", weight: 100, status: "pending" });
    const result = await pickServingDeployment(ANN_ID, () => 0.5);
    expect(result).toBeNull();
  });

  it("picks the only active deployment and resolves its version", async () => {
    seedDeployment({ id: "d-active", versionId: VER_A, mode: "active", weight: 100 });
    const result = await pickServingDeployment(ANN_ID, () => 0.5);
    expect(result).not.toBeNull();
    expect(result!.deployment.id).toBe("d-active");
    expect(result!.deployment.deployMode).toBe("active");
    expect(result!.version.id).toBe(VER_A);
    expect(result!.version.version).toBe("1.0.0");
  });

  it("picks a canary deployment (canary is treated as serving)", async () => {
    seedDeployment({ id: "d-canary", versionId: VER_B, mode: "canary", weight: 100 });
    const result = await pickServingDeployment(ANN_ID, () => 0.5);
    expect(result).not.toBeNull();
    expect(result!.deployment.deployMode).toBe("canary");
    expect(result!.version.version).toBe("1.1.0");
  });

  it("returns null if the picked deployment's versionId has no matching version row", async () => {
    seedDeployment({ id: "d-active", versionId: "ghost-version", mode: "active", weight: 100 });
    const result = await pickServingDeployment(ANN_ID, () => 0.5);
    expect(result).toBeNull();
  });

  it("distributes 70/30 across two deployments over many calls", async () => {
    seedDeployment({ id: "d-a", versionId: VER_A, mode: "active", weight: 70 });
    seedDeployment({ id: "d-b", versionId: VER_B, mode: "canary", weight: 30 });
    const N = 2000;
    let aCount = 0;
    let bCount = 0;
    for (let i = 0; i < N; i++) {
      // Each call uses a fresh random — 1st call for `pickByWeight`
      const r = ((i * 2654435761) >>> 0) / 0x100000000;
      const result = await pickServingDeployment(ANN_ID, () => r);
      if (!result) throw new Error("expected a pick");
      if (result.deployment.id === "d-a") aCount++;
      else bCount++;
    }
    expect(aCount / N).toBeGreaterThan(0.6);
    expect(aCount / N).toBeLessThan(0.8);
    expect(bCount / N).toBeGreaterThan(0.2);
    expect(bCount / N).toBeLessThan(0.4);
  });
});

describe("pickShadowDeployment", () => {
  it("returns null when there are no shadow deployments", async () => {
    seedDeployment({ id: "d-active", versionId: VER_A, mode: "active", weight: 100 });
    const result = await pickShadowDeployment(ANN_ID, () => 0.9);
    expect(result).toBeNull();
  });

  it("returns the shadow when rand() >= 0.5 (picks the shadow branch)", async () => {
    seedDeployment({ id: "d-shadow", versionId: VER_C, mode: "shadow", weight: 100 });
    // rand()=0.5 is the threshold (>= 0.5 picks shadow)
    const result = await pickShadowDeployment(ANN_ID, () => 0.5);
    expect(result).not.toBeNull();
    expect(result!.deployment.deployMode).toBe("shadow");
    expect(result!.version.version).toBe("2.0.0");
  });

  it("returns null when rand() < 0.5 (skips the shadow branch)", async () => {
    seedDeployment({ id: "d-shadow", versionId: VER_C, mode: "shadow", weight: 100 });
    const result = await pickShadowDeployment(ANN_ID, () => 0.4);
    expect(result).toBeNull();
  });

  it("splits roughly 50/50 over many calls", async () => {
    seedDeployment({ id: "d-shadow", versionId: VER_C, mode: "shadow", weight: 100 });
    const N = 2000;
    let hit = 0;
    let miss = 0;
    for (let i = 0; i < N; i++) {
      // The 50/50 rand() check uses the first call to rand; the second
      // (if we get past) uses pickByWeight's internal rand. To make
      // this test deterministic we always use a value > 0.5 so the
      // 50/50 check passes, and the second call lands on 0.99 (100% a).
      // To exercise both branches, alternate.
      const r1 = i % 2 === 0 ? 0.4 : 0.6;
      const r2 = 0.99;
      // We need a function that returns r1 on first call and r2 thereafter
      let calls = 0;
      const rand = () => {
        calls++;
        return calls === 1 ? r1 : r2;
      };
      const result = await pickShadowDeployment(ANN_ID, rand);
      if (result) hit++;
      else miss++;
    }
    expect(Math.abs(hit - miss)).toBeLessThan(N * 0.1);
    expect(hit + miss).toBe(N);
  });

  it("returns null when shadow's version is missing", async () => {
    seedDeployment({ id: "d-shadow", versionId: "ghost-version", mode: "shadow", weight: 100 });
    const result = await pickShadowDeployment(ANN_ID, () => 0.9);
    expect(result).toBeNull();
  });
});
