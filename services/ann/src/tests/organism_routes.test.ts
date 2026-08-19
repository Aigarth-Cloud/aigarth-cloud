/**
 * Tests for the Organism routes (Phase 26 / Wave 2 — Tasks 2, 3, 4).
 *
 *   37 vitest cases:
 *     - Task 2 (CRUD): 15 cases
 *     - Task 3 (lineage + fitness + fork): 10 cases
 *     - Task 4 (memory + mutation): 12 cases
 *
 *   Strategy:
 *     - Mock `../db/index.js` with an in-memory store that supports
 *       insert / select / update / execute. The mock mirrors the
 *       drizzle SQL-chunk shape enough to handle the operations the
 *       organism service uses.
 *     - Build the real server with `buildServer()` and exercise the
 *       routes via `app.inject()`. JWTs are signed with `app.jwt.sign`.
 *     - The recursive CTE in `getLineage` is implemented in our mock
 *       by detecting the `WITH RECURSIVE` shape and running a JS
 *       walk over the in-memory organisms.
 *
 *   Why an in-memory mock (vs. a real Postgres):
 *     The existing test pattern in `services/ann/src/tests/` is
 *     in-memory mocks (see proposals.test.ts, retrain.test.ts). The
 *     real-DB harness is F1 in the Wave 2 follow-up backlog; the
 *     schema-level tests for Task 1 will move there when F1 lands.
 *     For Tasks 2-4 (routes only), the in-memory mock covers the
 *     happy paths and the well-known error paths.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// ---------- Env setup ----------

// Provide the env vars the config loader needs. Done at module load
// so the cached config picks them up.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";
process.env.JWT_SECRET = "test-secret-for-routes-only-do-not-use-elsewhere-please";
process.env.ANN_TRINARY_SIGNING_KEY = "test-signing-key-rotate-in-prod-please";
process.env.HOST = "127.0.0.1";
process.env.PORT = "17006";
process.env.LOG_LEVEL = "fatal";
process.env.CORS_ORIGINS = "*";
process.env.IDENTITY_SERVICE_URL = "http://localhost:7001";
process.env.QUBIC_SERVICE_URL = "http://localhost:7002";
process.env.COMPUTE_SERVICE_URL = "http://localhost:7003";
process.env.GATEWAY_SERVICE_URL = "http://localhost:7004";
process.env.BILLING_SERVICE_URL = "http://localhost:7005";
process.env.TRAINING_SERVICE_URL = "http://localhost:7011";
process.env.TRAINING_INTERNAL_TOKEN = "test-training-internal-token";
process.env.AIGARTHPOOL_MODE = "simulator";
process.env.ANN_LLM_BACKEND = "stub";
process.env.ANN_LLM_BASE_URL = "http://localhost:11434/v1";
process.env.ANN_LLM_MODEL = "test-model";
process.env.ANN_LLM_API_KEY = "";
process.env.ANN_ADMIN_USER_IDS = "";

// ---------- Drizzle chunk parser (lifted from proposals.test.ts) ----------

type Chunk = unknown;

function getColumnName(c: Chunk): string | null {
  if (!c || typeof c !== "object") return null;
  const o = c as { name?: unknown };
  return typeof o.name === "string" ? o.name : null;
}

function getValue(c: Chunk): unknown {
  if (c === null || c === undefined) return c;
  if (typeof c !== "object") return c;
  const o = c as { value?: unknown };
  if ("value" in o) return o.value;
  return c;
}

function getStringValue(c: Chunk): string {
  if (typeof c === "string") return c;
  if (c && typeof c === "object") {
    const o = c as { value?: unknown };
    if (typeof o.value === "string") return o.value;
    if (Array.isArray(o.value)) {
      return o.value.map((v) => (typeof v === "string" ? v : "")).join("");
    }
  }
  return "";
}

function isParam(c: Chunk): boolean {
  if (!c || typeof c !== "object") return false;
  const ctor = (c as { constructor?: { name?: string } }).constructor?.name;
  return ctor === "Param";
}

function isSubFragment(c: Chunk): boolean {
  if (!c || typeof c !== "object" || isParam(c)) return false;
  if (getColumnName(c)) return false;
  const qc = (c as { queryChunks?: unknown[] }).queryChunks;
  return Array.isArray(qc);
}

function getSubChunks(c: Chunk): Chunk[] {
  return ((c as { queryChunks?: Chunk[] }).queryChunks ?? []) as Chunk[];
}

/**
 * Walk a table object and build a DB-name -> TS-name map. The Drizzle
 * columns expose `name` (DB column name in snake_case) and
 * `queryChunks` (the SQL fragment). The TS property name is the
 * camelCase key on the table object.
 */
function buildColumnMap(table: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  for (const tsName of Object.keys(table)) {
    const col = table[tsName];
    if (!col || typeof col !== "object") continue;
    const o = col as { name?: unknown; queryChunks?: unknown[]; dataType?: unknown };
    if (typeof o.name === "string" && (Array.isArray(o.queryChunks) || o.dataType)) {
      map.set(o.name, tsName);
    }
  }
  return map;
}

type Pred = (row: Record<string, unknown>) => boolean;
const TRUE_PRED: Pred = () => true;

/**
 * Recursive-descent boolean expression parser over drizzle's
 * `queryChunks`. Handles AND/OR with correct precedence, nested
 * sub-fragments (e.g. `and(eq(a,b), or(eq(c,d), eq(e,f)))`), and
 * the comparison operators the organism routes use: =, <, >, IS NULL.
 *
 * Column names are normalised to TS property names (the camelCase
 * keys on the table object) so the predicate can be evaluated
 * against the in-memory rows, which are keyed by TS name.
 */
/**
 * Whether a chunk should be skipped: pure-whitespace strings, the "("
 * and ")" StringChunk wrappers drizzle adds around `and(...)` /
 * `or(...)` expressions, and undefined-ish values. A `StringChunk`
 * is detected by its `value: string[]` shape (drizzle stores the
 * literal SQL as a string array on the chunk).
 */
function isSkipChunk(c: Chunk): boolean {
  if (c === null || c === undefined) return true;
  if (typeof c === "string") {
    const t = c.trim();
    return t === "" || t === "(" || t === ")";
  }
  if (typeof c === "object") {
    const v = (c as { value?: unknown }).value;
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      const s = v.join("");
      const t = s.trim();
      return t === "" || t === "(" || t === ")";
    }
  }
  return false;
}

/**
 * Recursive-descent boolean expression parser over drizzle's
 * `queryChunks`. Handles AND/OR with correct precedence, nested
 * sub-fragments (e.g. `and(eq(a,b), or(eq(c,d), eq(e,f)))`), and
 * the comparison operators the organism routes use: =, <, >, IS NULL.
 *
 * Column names are normalised to TS property names (the camelCase
 * keys on the table object) so the predicate can be evaluated
 * against the in-memory rows, which are keyed by TS name.
 *
 * drizzle's `and(...)` produces a SQL fragment with the shape:
 *   queryChunks = [StringChunk("("), joinedSQL, StringChunk(")")]
 * where `joinedSQL` is the result of `sql.join([...conditions], " and ")`
 * — itself a SQL with `queryChunks = [cond1, StringChunk(" and "), cond2, ...]`.
 * We walk both layers via the same `parseExpr`.
 */
function parseWhereToPred(where: unknown, colMap: Map<string, string>): Pred {
  if (!where) return TRUE_PRED;
  const w = where as { queryChunks?: Chunk[] };
  const chunks = w.queryChunks ?? [];
  if (chunks.length === 0) return TRUE_PRED;
  return parseExpr(chunks, 0, 0, colMap).pred;
}

function parseExpr(
  chunks: Chunk[],
  start: number,
  minPrec: number,
  colMap: Map<string, string>,
): { pred: Pred; pos: number } {
  // Skip leading "(" / whitespace / StringChunk wrappers.
  let p = start;
  while (p < chunks.length && isSkipChunk(chunks[p])) p++;
  if (p >= chunks.length) return { pred: TRUE_PRED, pos: p };

  const left = parsePrimary(chunks, p, colMap);
  let { pred, pos } = left;

  while (pos < chunks.length) {
    // Skip trailing ")" / whitespace between operators.
    while (pos < chunks.length && isSkipChunk(chunks[pos])) pos++;
    if (pos >= chunks.length) break;

    const s = getStringValue(chunks[pos]);
    let op: "AND" | "OR" | null = null;
    if (/\bAND\b/i.test(s) || /\band\b/.test(s)) op = "AND";
    else if (/\bOR\b/i.test(s) || /\bor\b/.test(s)) op = "OR";
    if (!op) break;
    const prec = op === "AND" ? 2 : 1;
    if (prec < minPrec) break;

    // Consume the operator chunk and skip whitespace.
    pos++;
    while (pos < chunks.length && isSkipChunk(chunks[pos])) pos++;

    const right = parseExpr(chunks, pos, prec + 1, colMap);
    const leftPred = pred;
    if (op === "AND") {
      pred = (r) => leftPred(r) && right.pred(r);
    } else {
      pred = (r) => leftPred(r) || right.pred(r);
    }
    pos = right.pos;
  }

  return { pred, pos };
}

function parsePrimary(
  chunks: Chunk[],
  start: number,
  colMap: Map<string, string>,
): { pred: Pred; pos: number } {
  // Skip skip-chunks (parens, whitespace) at the start of a primary.
  let p = start;
  while (p < chunks.length && isSkipChunk(chunks[p])) p++;
  if (p >= chunks.length) return { pred: TRUE_PRED, pos: p };

  const c = chunks[p];
  if (isSubFragment(c)) {
    // Sub-fragment occupies a single outer slot — advance by 1 in the
    // outer position regardless of the inner recursion's pos.
    const subResult = parseExpr(getSubChunks(c), 0, 0, colMap);
    return { pred: subResult.pred, pos: p + 1 };
  }
  // Look for a comparison: [col, " op ", param] OR [col, " IS NULL"]
  let col: string | null = null;
  for (let i = p; i < chunks.length; i++) {
    const cc = chunks[i];
    if (isSkipChunk(cc)) continue;
    if (col === null) {
      const cn = getColumnName(cc);
      if (cn) {
        col = colMap.get(cn) ?? cn;
        continue;
      }
    }
    const ss = getStringValue(cc);
    if (/IS\s+NULL/i.test(ss) && !isParam(cc)) {
      if (col) {
        const tsCol = col;
        return { pred: (r) => r[tsCol] == null, pos: i + 1 };
      }
    }
    if (/IS\s+NOT\s+NULL/i.test(ss) && !isParam(cc)) {
      if (col) {
        const tsCol = col;
        return { pred: (r) => r[tsCol] != null, pos: i + 1 };
      }
    }
    if (isParam(cc)) {
      const value = getValue(cc);
      const prevS = i > 0 ? getStringValue(chunks[i - 1]) : " = ";
      let op: "=" | "<" | ">" = "=";
      if (prevS.includes("<") && !prevS.includes("=")) op = "<";
      else if (prevS.includes(">") && !prevS.includes("=")) op = ">";
      const tsCol = col ?? "";
      return {
        pred: (r) => {
          const v = r[tsCol];
          if (op === "=") return v === value;
          if (v == null || value == null) return false;
          if (op === "<") return (v as number | string | Date) < (value as number | string | Date);
          if (op === ">") return (v as number | string | Date) > (value as number | string | Date);
          return false;
        },
        pos: i + 1,
      };
    }
  }
  return { pred: TRUE_PRED, pos: p + 1 };
}

function parseOrderBy(orderBy: unknown, colMap: Map<string, string>): { col: string; desc: boolean } | null {
  if (!orderBy) return null;
  const ob = orderBy as { queryChunks?: Chunk[] };
  const chunks = ob.queryChunks ?? [];
  let colName: string | null = null;
  let desc = false;
  for (const c of chunks) {
    const cn = getColumnName(c);
    if (cn) colName = colMap.get(cn) ?? cn;
    const s = getStringValue(c);
    if (/\bDESC\b/i.test(s)) desc = true;
    if (/\bASC\b/i.test(s)) desc = false;
  }
  if (!colName) return null;
  return { col: colName, desc };
}

// ---------- In-memory store ----------

interface OrganismRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creatorId: string;
  visibility: "public" | "unlisted" | "private";
  status: "draft" | "active" | "paused" | "deprecated" | "extinct";
  kind: string;
  genome: Record<string, unknown>;
  environment: Record<string, unknown>;
  objective: Record<string, unknown>;
  fitness: number | null;
  parentId: string | null;
  rootId: string;
  generation: number;
  computeConsumed: Record<string, unknown>;
  birthAt: Date | null;
  deathAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MemoryRow {
  id: string;
  organismId: string;
  kind: "short_term" | "long_term" | "episodic";
  payload: Record<string, unknown>;
  writtenAt: Date;
  expiresAt: Date | null;
}

interface FitnessRow {
  id: string;
  organismId: string;
  generation: number;
  fitness: number;
  components: Record<string, unknown>;
  recordedAt: Date;
}

interface AuditRow {
  id: string;
  actorUserId: string | null;
  orgId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface IdempRow {
  userId: string;
  idempotencyKey: string;
  route: string;
  requestHash: string;
  responseStatus: number;
  responseBody: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
}

const store = {
  organisms: new Map<string, OrganismRow>(),
  memories: new Map<string, MemoryRow>(),
  fitness: new Map<string, FitnessRow>(),
  audit: [] as AuditRow[],
  idemp: new Map<string, IdempRow>(), // key = userId|key|route
};

let nextId = 0;
const newUuid = (): string => {
  nextId += 1;
  return `00000000-0000-0000-0000-${String(nextId).padStart(12, "0")}`;
};

function resetStore() {
  store.organisms.clear();
  store.memories.clear();
  store.fitness.clear();
  store.audit = [];
  store.idemp.clear();
  nextId = 0;
}

// ---------- DB mock ----------

// We `vi.mock` the DB module BEFORE importing the service. The mock
// inspects the table objects passed to `select().from(table)` and
// `update(table)` to decide which in-memory store to use.

vi.mock("../db/index.js", () => {
  /**
   * Detect which in-memory table corresponds to a Drizzle table object.
   * The discriminator is the set of column TS-names on the table.
   */
  function tableKind(t: Record<string, unknown>): "organisms" | "memories" | "fitness" | "audit" | "idemp" | null {
    if (t.organismId !== undefined && t.kind !== undefined && t.payload !== undefined) return "memories";
    if (t.organismId !== undefined && t.fitness !== undefined && t.components !== undefined) return "fitness";
    if (t.action !== undefined && t.actorUserId !== undefined && t.targetType !== undefined) return "audit";
    if (t.idempotencyKey !== undefined && t.userId !== undefined && t.route !== undefined) return "idemp";
    if (t.creatorId !== undefined && t.genome !== undefined && t.parentId !== undefined) return "organisms";
    return null;
  }

  function rows(kind: ReturnType<typeof tableKind>) {
    if (kind === "organisms") return Array.from(store.organisms.values()) as unknown as Record<string, unknown>[];
    if (kind === "memories") return Array.from(store.memories.values()) as unknown as Record<string, unknown>[];
    if (kind === "fitness") return Array.from(store.fitness.values()) as unknown as Record<string, unknown>[];
    if (kind === "audit") return store.audit as unknown as Record<string, unknown>[];
    if (kind === "idemp") return Array.from(store.idemp.values()) as unknown as Record<string, unknown>[];
    return [];
  }

  function rowsMap(kind: ReturnType<typeof tableKind>) {
    if (kind === "organisms") return store.organisms;
    if (kind === "memories") return store.memories;
    if (kind === "fitness") return store.fitness;
    if (kind === "idemp") return store.idemp;
    return null;
  }

  // (Unused helper removed during cleanup.)

  const db = {
    insert(table: unknown) {
      const t = (table ?? {}) as Record<string, unknown>;
      const kind = tableKind(t);
      const chain: Record<string, unknown> = {};
      let pendingRow: Record<string, unknown> | null = null;
      const commit = () => {
        if (!pendingRow) return [] as Record<string, unknown>[];
        if (kind === "organisms") {
          // Auto-generate id/slug/createdAt/updatedAt if not present.
          if (!pendingRow["id"]) pendingRow["id"] = newUuid();
          if (!pendingRow["createdAt"]) pendingRow["createdAt"] = new Date();
          pendingRow["updatedAt"] = pendingRow["updatedAt"] ?? pendingRow["createdAt"];
          if (pendingRow["rootId"] == null) pendingRow["rootId"] = pendingRow["id"];
          if (pendingRow["generation"] == null) pendingRow["generation"] = 0;
          if (pendingRow["status"] == null) pendingRow["status"] = "draft";
          if (pendingRow["computeConsumed"] == null) pendingRow["computeConsumed"] = {};
          if (pendingRow["deletedAt"] === undefined) pendingRow["deletedAt"] = null;
          store.organisms.set(pendingRow["id"] as string, pendingRow as unknown as OrganismRow);
        } else if (kind === "memories") {
          if (!pendingRow["id"]) pendingRow["id"] = newUuid();
          if (!pendingRow["writtenAt"]) pendingRow["writtenAt"] = new Date();
          store.memories.set(pendingRow["id"] as string, pendingRow as unknown as MemoryRow);
        } else if (kind === "fitness") {
          if (!pendingRow["id"]) pendingRow["id"] = newUuid();
          if (!pendingRow["recordedAt"]) pendingRow["recordedAt"] = new Date();
          store.fitness.set(pendingRow["id"] as string, pendingRow as unknown as FitnessRow);
        } else if (kind === "audit") {
          if (!pendingRow["id"]) pendingRow["id"] = newUuid();
          if (!pendingRow["createdAt"]) pendingRow["createdAt"] = new Date();
          store.audit.push(pendingRow as unknown as AuditRow);
        } else if (kind === "idemp") {
          if (!pendingRow["createdAt"]) pendingRow["createdAt"] = new Date();
          const k = `${pendingRow["userId"]}|${pendingRow["idempotencyKey"]}|${pendingRow["route"]}`;
          store.idemp.set(k, pendingRow as unknown as IdempRow);
        }
        return [pendingRow];
      };
      chain.values = (row: Record<string, unknown>) => {
        pendingRow = { ...row };
        const ret: Record<string, unknown> = {
          returning: async () => commit(),
        };
        ret.onConflictDoNothing = async () => {
          commit();
          return [];
        };
        return ret;
      };
      return chain;
    },

    select(_cols?: unknown) {
      const builder: Record<string, unknown> = {};
      let pending: Record<string, unknown>[] = [];
      let pendingOrder: { col: string; desc: boolean } | null = null;
      let pendingLimit: number | null = null;
      let pendingOffset: number | null = null;

      builder.from = (table: unknown) => {
        const t = (table ?? {}) as Record<string, unknown>;
        const kind = tableKind(t);
        const colMap = buildColumnMap(t);
        pending = rows(kind);

        const finalize = (): Record<string, unknown>[] => {
          let out = pending;
          if (pendingOrder) {
            out = [...out].sort((a, b) => {
              const av = a[pendingOrder!.col];
              const bv = b[pendingOrder!.col];
              if (av === bv) return 0;
              if (av == null) return pendingOrder!.desc ? 1 : -1;
              if (bv == null) return pendingOrder!.desc ? -1 : 1;
              if (av < bv) return pendingOrder!.desc ? 1 : -1;
              if (av > bv) return pendingOrder!.desc ? -1 : 1;
              return 0;
            });
          }
          if (pendingOffset != null) out = out.slice(pendingOffset);
          if (pendingLimit != null) out = out.slice(0, pendingLimit);
          return out;
        };

        const result: Record<string, unknown> = {};
        result.where = (cond: unknown) => {
          const pred = parseWhereToPred(cond, colMap);
          pending = pending.filter((r) => pred(r));
          return result;
        };
        result.orderBy = (col: unknown) => {
          pendingOrder = parseOrderBy(col, colMap);
          return result;
        };
        result.limit = (n: number) => {
          pendingLimit = n;
          return result;
        };
        result.offset = (n: number) => {
          pendingOffset = n;
          return result;
        };
        // Terminal: thenable.
        result.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
          try {
            return Promise.resolve(finalize()).then(resolve, reject);
          } catch (e) {
            return reject ? reject(e) : Promise.reject(e);
          }
        };
        return result;
      };
      return builder;
    },

    update(table: unknown) {
      const t = (table ?? {}) as Record<string, unknown>;
      const kind = tableKind(t);
      const colMap = buildColumnMap(t);
      const allRows = rowsMap(kind);
      return {
        set: (patch: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            const pred = parseWhereToPred(cond, colMap);
            const updated: Record<string, unknown>[] = [];
            if (allRows) {
              for (const r of Array.from(allRows.values() as Iterable<Record<string, unknown>>)) {
                if (pred(r)) {
                  Object.assign(r, patch);
                  updated.push(r);
                }
              }
            }
            const ret: Record<string, unknown> = {
              returning: async () => updated,
            };
            ret.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
              Promise.resolve(updated).then(resolve, reject);
            return ret;
          },
        }),
      };
    },

    async execute<T = Record<string, unknown>>(sqlFrag: { queryChunks?: Chunk[] }): Promise<{ rows: T[] }> {
      const chunks = sqlFrag?.queryChunks ?? [];
      const flat = chunks.map((c) => getStringValue(c)).join(" ");
      // Detect the recursive CTE on organisms (lineage).
      if (/WITH\s+RECURSIVE/i.test(flat) && /FROM\s+organisms/i.test(flat)) {
        // Extract the start id. The drizzle sql template may inline a
        // string value directly (as a plain string chunk) or wrap it
        // in a Param. We accept either: scan all chunks (including
        // StringChunks' joined value) for a uuid pattern.
        let startId: string | null = null;
        for (const c of chunks) {
          let candidate: string | null = null;
          if (isParam(c)) {
            const v = getValue(c);
            if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) candidate = v;
          } else if (typeof c === "string") {
            const m = c.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            if (m) candidate = m[0];
          } else if (c && typeof c === "object") {
            const v = (c as { value?: unknown }).value;
            if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) candidate = v;
            if (Array.isArray(v)) {
              const joined = v.join("");
              const m = joined.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
              if (m) candidate = m[0];
            }
          }
          if (candidate) {
            startId = candidate;
            break;
          }
        }
        if (!startId) return { rows: [] };
        const start = store.organisms.get(startId);
        if (!start) return { rows: [] };
        // Walk descendants.
        const out: Array<{ id: string; slug: string; name: string; generation: number; parent_id: string; depth: number }> = [];
        const queue: Array<{ row: OrganismRow; depth: number }> = [{ row: start, depth: 0 }];
        while (queue.length) {
          const { row, depth } = queue.shift()!;
          out.push({
            id: row.id,
            slug: row.slug,
            name: row.name,
            generation: row.generation,
            parent_id: row.parentId ?? "",
            depth,
          });
          if (depth < 100) {
            for (const child of store.organisms.values()) {
              if (child.parentId === row.id && child.deletedAt == null) {
                queue.push({ row: child, depth: depth + 1 });
              }
            }
          }
        }
        return { rows: out as unknown as T[] };
      }
      return { rows: [] };
    },
  };

  return {
    getDb: () => db,
    closeDb: async () => {
      // no-op
    },
  };
});

// ---------- Build server ----------

let app: FastifyInstance;

beforeAll(async () => {
  const { buildServer } = await import("../server.js");
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(() => {
  resetStore();
});

// ---------- Test helpers ----------

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

function jwtFor(userId: string): string {
  // app.jwt is decorated by @fastify/jwt after the plugin registers.
  return (app.jwt as { sign: (payload: object) => string }).sign({ sub: userId });
}

function authedReq(
  userId: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ statusCode: number; body: string }> {
  // The Fastify inject signature has overloads; the cast below is a
  // pragmatic concession to keep the test helper terse.
  return (app.inject as unknown as (opts: unknown) => Promise<{ statusCode: number; body: string }>)({
    method,
    url,
    headers: {
      authorization: `Bearer ${jwtFor(userId)}`,
      ...(extraHeaders ?? {}),
    },
    payload,
  });
}

function anonReq(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) {
  return (app.inject as unknown as (opts: unknown) => Promise<{ statusCode: number; body: string }>)({
    method,
    url,
    payload,
  });
}

async function createOrganism(
  userId: string,
  overrides: Partial<{
    slug: string;
    name: string;
    description: string;
    kind: "researcher" | "optimizer" | "predictor" | "synthetist" | "custom";
    visibility: "public" | "unlisted" | "private";
    genome: Record<string, unknown>;
    environment: Record<string, unknown>;
    objective: Record<string, unknown>;
  }> = {},
) {
  const body = {
    slug: overrides.slug ?? "test-organism",
    name: overrides.name ?? "Test Organism",
    description: overrides.description,
    kind: overrides.kind ?? "researcher",
    visibility: overrides.visibility ?? "private",
    genome: overrides.genome ?? { version: 1, mutation: { rate: 0.05, operators: ["gaussian"] }, recombination: { enabled: false, strategy: "uniform" as const } },
    environment: overrides.environment ?? { type: "test-env", config: {} },
    objective: overrides.objective ?? { fitnessFunction: "tire.v1", weights: { wet: 0.5 }, thresholds: { minFitness: 0.6, maxStallGenerations: 10 } },
  };
  const res = await authedReq(userId, "POST", "/v1/organisms", body);
  if (res.statusCode !== 201) {
    throw new Error(`createOrganism failed: ${res.statusCode} ${res.body}`);
  }
  return JSON.parse(res.body) as Record<string, unknown>;
}

// ============================================================================
// Task 2 — Organism CRUD routes (15 cases)
// ============================================================================

describe("Task 2 — Organism CRUD", () => {
  // ---------- POST /v1/organisms (6 cases) ----------

  it("1. POST /v1/organisms with valid body -> 201 + slug", async () => {
    const res = await authedReq(USER_A, "POST", "/v1/organisms", {
      slug: "tire-mvp",
      name: "TireMind MVP",
      kind: "researcher",
      genome: { version: 1, mutation: { rate: 0.05, operators: ["gaussian"] }, recombination: { enabled: false, strategy: "uniform" } },
      environment: { type: "tire-mixer", config: {} },
      objective: { fitnessFunction: "tire.v1", weights: { wet: 0.4 }, thresholds: { minFitness: 0.6, maxStallGenerations: 10 } },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.slug).toBe("tire-mvp");
    expect(body.status).toBe("draft");
    expect(body.id).toBeTruthy();
    expect(body.kind).toBe("researcher");
  });

  it("2. POST /v1/organisms with invalid slug -> 400", async () => {
    const res = await authedReq(USER_A, "POST", "/v1/organisms", {
      slug: "AB", // too short, uppercase
      name: "X",
      kind: "researcher",
      genome: { version: 1 },
      environment: { type: "x", config: {} },
      objective: { fitnessFunction: "x", weights: {}, thresholds: { minFitness: 0, maxStallGenerations: 0 } },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    // The Zod issues array should include the failing field path.
    expect(Array.isArray(body.error.issues)).toBe(true);
    const slugIssue = body.error.issues.find((i: { path: string[] }) => i.path.includes("slug"));
    expect(slugIssue).toBeTruthy();
  });

  it("3. POST /v1/organisms with unknown field -> 400", async () => {
    const res = await authedReq(USER_A, "POST", "/v1/organisms", {
      slug: "valid-slug",
      name: "Test",
      kind: "researcher",
      genome: { version: 1 },
      environment: { type: "x", config: {} },
      objective: { fitnessFunction: "x", weights: {}, thresholds: { minFitness: 0, maxStallGenerations: 0 } },
      mystery: "field", // not in the schema
    });
    expect(res.statusCode).toBe(400);
  });

  it("4. POST /v1/organisms with invalid kind -> 400", async () => {
    const res = await authedReq(USER_A, "POST", "/v1/organisms", {
      slug: "valid-slug",
      name: "Test",
      kind: "unknown_kind",
      genome: { version: 1 },
      environment: { type: "x", config: {} },
      objective: { fitnessFunction: "x", weights: {}, thresholds: { minFitness: 0, maxStallGenerations: 0 } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("5. POST /v1/organisms with non-object genome -> 400", async () => {
    const res = await authedReq(USER_A, "POST", "/v1/organisms", {
      slug: "valid-slug",
      name: "Test",
      kind: "researcher",
      genome: ["not", "an", "object"],
      environment: { type: "x", config: {} },
      objective: { fitnessFunction: "x", weights: {}, thresholds: { minFitness: 0, maxStallGenerations: 0 } },
    });
    expect(res.statusCode).toBe(400);
  });

  // ---------- GET /v1/organisms (2 cases) ----------

  it("6. GET /v1/organisms as anonymous -> 200 + paginated public only", async () => {
    // USER_A creates a public one and a private one.
    await createOrganism(USER_A, { slug: "public-one", visibility: "public" });
    await createOrganism(USER_A, { slug: "private-one", visibility: "private" });
    // USER_B creates another public one.
    await createOrganism(USER_B, { slug: "user-b-public", visibility: "public" });
    const res = await anonReq("GET", "/v1/organisms");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    const slugs = body.data.map((o: { slug: string }) => o.slug).sort();
    expect(slugs).toEqual(["public-one", "user-b-public"]);
    expect(typeof body.limit).toBe("number");
  });

  it("7. GET /v1/organisms as creator -> 200 + includes own private", async () => {
    await createOrganism(USER_A, { slug: "a-public", visibility: "public" });
    await createOrganism(USER_A, { slug: "a-private", visibility: "private" });
    await createOrganism(USER_B, { slug: "b-public", visibility: "public" });
    await createOrganism(USER_B, { slug: "b-private", visibility: "private" });
    const res = await authedReq(USER_A, "GET", "/v1/organisms");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const slugs = body.data.map((o: { slug: string }) => o.slug).sort();
    expect(slugs).toEqual(["a-private", "a-public", "b-public"]);
  });

  // ---------- GET /v1/organisms/:slug (2 cases) ----------

  it("8. GET /v1/organisms/:slug -> 200 + full body", async () => {
    await createOrganism(USER_A, { slug: "my-org", name: "My Organism" });
    const res = await anonReq("GET", "/v1/organisms/my-org");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.slug).toBe("my-org");
    expect(body.name).toBe("My Organism");
    expect(body.kind).toBe("researcher");
    expect(body.genome).toBeDefined();
    expect(body.environment).toBeDefined();
    expect(body.objective).toBeDefined();
  });

  it("9. GET /v1/organisms/:slug unknown -> 404", async () => {
    const res = await anonReq("GET", "/v1/organisms/nonexistent");
    expect(res.statusCode).toBe(404);
  });

  // ---------- PATCH /v1/organisms/:slug (2 cases) ----------

  it("10. PATCH /v1/organisms/:slug own -> 200 + updated body", async () => {
    await createOrganism(USER_A, { slug: "my-org", name: "Old" });
    const res = await authedReq(USER_A, "PATCH", "/v1/organisms/my-org", {
      name: "New Name",
      description: "Updated description",
      visibility: "public",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("New Name");
    expect(body.description).toBe("Updated description");
    expect(body.visibility).toBe("public");
  });

  it("11. PATCH /v1/organisms/:slug another user's -> 403", async () => {
    await createOrganism(USER_A, { slug: "user-a-org" });
    const res = await authedReq(USER_B, "PATCH", "/v1/organisms/user-a-org", { name: "Hacked" });
    expect(res.statusCode).toBe(403);
  });

  // ---------- POST /v1/organisms/:slug/activate (2 cases) ----------

  it("12. POST /v1/organisms/:slug/activate on own draft -> 200 + active", async () => {
    await createOrganism(USER_A, { slug: "to-activate" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/to-activate/activate");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("active");
    expect(body.birth_at).toBeTruthy();
  });

  it("13. POST /v1/organisms/:slug/activate on already-active -> 409", async () => {
    await createOrganism(USER_A, { slug: "active-twice" });
    await authedReq(USER_A, "POST", "/v1/organisms/active-twice/activate");
    const res = await authedReq(USER_A, "POST", "/v1/organisms/active-twice/activate");
    expect(res.statusCode).toBe(409);
  });

  // ---------- POST /v1/organisms/:slug/pause (2 cases) ----------

  it("14. POST /v1/organisms/:slug/pause on own active -> 200 + paused", async () => {
    await createOrganism(USER_A, { slug: "to-pause" });
    await authedReq(USER_A, "POST", "/v1/organisms/to-pause/activate");
    const res = await authedReq(USER_A, "POST", "/v1/organisms/to-pause/pause");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("paused");
  });

  it("15. POST /v1/organisms/:slug/pause on draft -> 409", async () => {
    await createOrganism(USER_A, { slug: "draft-pause" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/draft-pause/pause");
    expect(res.statusCode).toBe(409);
  });
});

// ============================================================================
// Task 3 — Lineage + fitness + fork (10 cases)
// ============================================================================

describe("Task 3 — Lineage + fitness + fork", () => {
  // ---------- GET /v1/organisms/:slug/lineage (3 cases) ----------

  it("16. GET /v1/organisms/:slug/lineage of founder (single node) -> 200", async () => {
    await createOrganism(USER_A, { slug: "founder" });
    const res = await anonReq("GET", "/v1/organisms/founder/lineage");
    expect(res.statusCode).toBe(200);
    const tree = JSON.parse(res.body);
    expect(tree.slug).toBe("founder");
    expect(tree.generation).toBe(0);
    expect(tree.children).toEqual([]);
  });

  it("17. GET /v1/organisms/:slug/lineage 3-generation tree -> 3 levels", async () => {
    // Build a 3-generation tree:
    //   founder -> child1 -> grandchild
    //         \-> child2 (separate branch)
    await createOrganism(USER_A, { slug: "founder" });
    const child1 = await authedReq(USER_A, "POST", "/v1/organisms/founder/fork");
    expect(child1.statusCode).toBe(201);
    const child1Body = JSON.parse(child1.body);
    await authedReq(USER_A, "POST", "/v1/organisms/founder/fork"); // child2
    // grandchild off child1
    const grandchild = await authedReq(USER_A, "POST", `/v1/organisms/${child1Body.slug}/fork`);
    expect(grandchild.statusCode).toBe(201);

    const res = await anonReq("GET", "/v1/organisms/founder/lineage");
    expect(res.statusCode).toBe(200);
    const tree = JSON.parse(res.body);
    // root: founder, generation 0
    expect(tree.slug).toBe("founder");
    expect(tree.generation).toBe(0);
    // 2 children at generation 1
    expect(tree.children).toHaveLength(2);
    expect(tree.children.every((c: { generation: number }) => c.generation === 1)).toBe(true);
    // 1 grandchild at generation 2 (under child1)
    const grandchildren = tree.children.flatMap((c: { children: unknown[] }) => c.children);
    expect(grandchildren).toHaveLength(1);
    expect(grandchildren[0].generation).toBe(2);
  });

  it("18. GET /v1/organisms/:slug/lineage unknown -> 404", async () => {
    const res = await anonReq("GET", "/v1/organisms/nonexistent/lineage");
    expect(res.statusCode).toBe(404);
  });

  // ---------- GET /v1/organisms/:slug/fitness (2 cases) ----------

  it("19. GET /v1/organisms/:slug/fitness empty history -> 200, []", async () => {
    await createOrganism(USER_A, { slug: "no-fitness" });
    const res = await anonReq("GET", "/v1/organisms/no-fitness/fitness");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual([]);
  });

  it("20. GET /v1/organisms/:slug/fitness?limit=1 -> 200, 1 row", async () => {
    const created = await createOrganism(USER_A, { slug: "has-fitness" });
    // Insert 3 fitness rows directly into the in-memory store. We
    // intentionally do NOT include a `kind` field — that's a memory
    // column, not a fitness column; the mock's tableKind discriminator
    // checks `kind` first and would misclassify the row.
    for (let i = 0; i < 3; i++) {
      store.fitness.set(newUuid(), {
        id: newUuid(),
        organismId: created.id as string,
        generation: i,
        fitness: 0.1 * (i + 1),
        components: { wet: 0.5 },
        recordedAt: new Date(Date.now() - (3 - i) * 1000),
      } as unknown as FitnessRow);
    }
    const res = await anonReq("GET", "/v1/organisms/has-fitness/fitness?limit=1");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.next_offset).toBe(1);
  });

  // ---------- POST /v1/organisms/:slug/fork (5 cases) ----------

  it("21. POST /v1/organisms/:slug/fork a founder -> 201, child has generation=1", async () => {
    await createOrganism(USER_A, { slug: "founder" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/founder/fork");
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.generation).toBe(1);
    expect(body.parent_id).toBeTruthy();
    expect(body.status).toBe("draft");
  });

  it("22. POST /v1/organisms/:slug/fork a forked organism -> 201, child has generation=2", async () => {
    await createOrganism(USER_A, { slug: "founder" });
    const c1 = JSON.parse((await authedReq(USER_A, "POST", "/v1/organisms/founder/fork")).body);
    const c2 = JSON.parse((await authedReq(USER_A, "POST", `/v1/organisms/${c1.slug}/fork`)).body);
    expect(c2.generation).toBe(2);
    // root_id is preserved across forks
    expect(c2.root_id).toBe(c1.root_id);
  });

  it("23. POST /v1/organisms/:slug/fork unknown parent -> 404", async () => {
    const res = await authedReq(USER_A, "POST", "/v1/organisms/nonexistent/fork");
    expect(res.statusCode).toBe(404);
  });

  it("24. POST /v1/organisms/:slug/fork an extinct parent -> 409", async () => {
    const created = await createOrganism(USER_A, { slug: "extinct-parent" });
    // Manually mark the parent as extinct (no transition route in v1).
    const row = store.organisms.get(created.id as string)!;
    row.status = "extinct";
    store.organisms.set(row.id, row);
    const res = await authedReq(USER_A, "POST", "/v1/organisms/extinct-parent/fork");
    expect(res.statusCode).toBe(409);
  });

  it("25. POST /v1/organisms/:slug/fork by non-creator -> 403", async () => {
    await createOrganism(USER_A, { slug: "user-a-org" });
    const res = await authedReq(USER_B, "POST", "/v1/organisms/user-a-org/fork");
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================================
// Task 4 — Memory + manual mutation (12 cases)
// ============================================================================

describe("Task 4 — Memory + mutation", () => {
  // ---------- POST /v1/organisms/:slug/memory (4 cases) ----------

  it("26. POST /v1/organisms/:slug/memory kind=episodic -> 201, entry has signature", async () => {
    await createOrganism(USER_A, { slug: "mem-host" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/mem-host/memory", {
      kind: "episodic",
      payload: { event: "task_completed", score: 0.87 },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.kind).toBe("episodic");
    expect(typeof body.payload.signature).toBe("string");
    expect(body.payload.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("27. POST /v1/organisms/:slug/memory kind=episodic, no payload -> 400", async () => {
    await createOrganism(USER_A, { slug: "mem-host" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/mem-host/memory", {
      kind: "episodic",
    });
    expect(res.statusCode).toBe(400);
  });

  it("28. POST /v1/organisms/:slug/memory kind=short_term, no expires_at -> 400", async () => {
    await createOrganism(USER_A, { slug: "mem-host" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/mem-host/memory", {
      kind: "short_term",
      payload: { scratch: "data" },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    // The Zod issues should point at the missing expiresAt field.
    expect(Array.isArray(body.error.issues)).toBe(true);
    const expiresIssue = body.error.issues.find(
      (i: { path: (string | number)[]; message: string }) =>
        i.path.includes("expiresAt") || /expiresAt/i.test(i.message),
    );
    expect(expiresIssue).toBeTruthy();
  });

  it("29. POST /v1/organisms/:slug/memory kind=long_term with expires_at -> 400", async () => {
    await createOrganism(USER_A, { slug: "mem-host" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/mem-host/memory", {
      kind: "long_term",
      payload: { lesson: "always" },
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(res.statusCode).toBe(400);
  });

  // ---------- GET /v1/organisms/:slug/memory (3 cases) ----------

  it("30. GET /v1/organisms/:slug/memory?kind=episodic -> 200, all entries", async () => {
    await createOrganism(USER_A, { slug: "mem-host" });
    // Write 3 entries.
    for (let i = 0; i < 3; i++) {
      await authedReq(USER_A, "POST", "/v1/organisms/mem-host/memory", {
        kind: "episodic",
        payload: { i },
      });
    }
    const res = await authedReq(USER_A, "GET", "/v1/organisms/mem-host/memory?kind=episodic");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
  });

  it("31. GET /v1/organisms/:slug/memory?kind=episodic&since=... -> 200, only entries after that timestamp", async () => {
    await createOrganism(USER_A, { slug: "mem-host" });
    // Write 1 entry, capture its writtenAt, wait, write another.
    await authedReq(USER_A, "POST", "/v1/organisms/mem-host/memory", {
      kind: "episodic",
      payload: { i: 0 },
    });
    const since = new Date().toISOString();
    // Small wait to ensure the second write has writtenAt > since.
    await new Promise((r) => setTimeout(r, 10));
    await authedReq(USER_A, "POST", "/v1/organisms/mem-host/memory", {
      kind: "episodic",
      payload: { i: 1 },
    });
    const res = await authedReq(USER_A, "GET", `/v1/organisms/mem-host/memory?kind=episodic&since=${encodeURIComponent(since)}`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].payload.i).toBe(1);
  });

  it("32. GET /v1/organisms/:slug/memory?kind=unknown -> 400", async () => {
    await createOrganism(USER_A, { slug: "mem-host" });
    const res = await authedReq(USER_A, "GET", "/v1/organisms/mem-host/memory?kind=unknown_kind");
    expect(res.statusCode).toBe(400);
  });

  // ---------- POST /v1/organisms/:slug/mutate (5 cases) ----------

  it("33. POST /v1/organisms/:slug/mutate with valid partial genome -> 200, version bumped", async () => {
    await createOrganism(USER_A, { slug: "mut-host" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/mut-host/mutate", {
      genome: { mutation: { rate: 0.1, operators: ["gaussian", "crossover"] } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const genome = body.genome as Record<string, unknown>;
    expect(genome.version).toBe(2);
    const mutation = genome.mutation as Record<string, unknown>;
    expect(mutation.rate).toBe(0.1);
  });

  it("34. POST /v1/organisms/:slug/mutate with empty body -> 400", async () => {
    await createOrganism(USER_A, { slug: "mut-host" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/mut-host/mutate", {
      genome: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("35. POST /v1/organisms/:slug/mutate records a long_term memory entry with the diff", async () => {
    await createOrganism(USER_A, { slug: "mut-host" });
    const res = await authedReq(USER_A, "POST", "/v1/organisms/mut-host/mutate", {
      genome: { mutation: { rate: 0.2, operators: ["gaussian"] } },
    });
    expect(res.statusCode).toBe(200);
    // Now read the memory log; we expect a long_term entry.
    const memRes = await authedReq(USER_A, "GET", "/v1/organisms/mut-host/memory?kind=long_term");
    expect(memRes.statusCode).toBe(200);
    const memBody = JSON.parse(memRes.body);
    expect(memBody.data).toHaveLength(1);
    const payload = memBody.data[0].payload as Record<string, unknown>;
    expect(payload.event).toBe("mutation");
    expect(payload.old_version).toBe(1);
    expect(payload.new_version).toBe(2);
    expect(Array.isArray(payload.diff)).toBe(true);
  });

  it("36. POST /v1/organisms/:slug/mutate by non-creator -> 403", async () => {
    await createOrganism(USER_A, { slug: "mut-host" });
    const res = await authedReq(USER_B, "POST", "/v1/organisms/mut-host/mutate", {
      genome: { mutation: { rate: 0.5, operators: ["x"] } },
    });
    expect(res.statusCode).toBe(403);
  });

  it("37. POST /v1/organisms/:slug/mutate on extinct organism -> 409 (terminal)", async () => {
    const created = await createOrganism(USER_A, { slug: "ext-mut" });
    // Manually mark as extinct.
    const row = store.organisms.get(created.id as string)!;
    row.status = "extinct";
    store.organisms.set(row.id, row);
    const res = await authedReq(USER_A, "POST", "/v1/organisms/ext-mut/mutate", {
      genome: { mutation: { rate: 0.1, operators: ["x"] } },
    });
    expect(res.statusCode).toBe(409);
  });
});
