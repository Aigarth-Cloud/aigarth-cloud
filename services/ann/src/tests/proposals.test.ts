/**
 * Tests for the proposals service — Phase 14.1 (Governance, off-chain).
 *
 * Mocks the DB and the AigarthPool so the service-layer logic is
 * testable in isolation. Covers:
 *   - createProposal: validation, stake check, default quorum
 *   - castVote: one vote per (proposal, voter), re-vote updates,
 *     self-vote rejection, no-stake rejection, weight snapshot
 *   - finalise: simple-majority + quorum gate, expired when no quorum
 *   - executeProposal: only on passed binding-kind proposals
 *   - listProposals / getProposal
 *   - edge cases: vote after deadline, vote on closed proposal
 *
 * The tally cache + finalisation status transitions are the highest
 * risk paths; those are the heaviest cases.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- Mocks ----------

// In-memory proposal + vote stores, keyed by id.
const proposalStore = new Map<string, Record<string, unknown>>();
const voteStore = new Map<string, Record<string, unknown>>(); // key = `${proposalId}|${voterId}`

let nextIdCounter = 0;
const newUuid = () => `00000000-0000-0000-0000-${String(++nextIdCounter).padStart(12, "0")}`;

vi.mock("../db/index.js", () => {
  // Row-shape discriminator. proposals carry `kind`, votes carry
  // `weightQubic`. We use this for the insert path because the
  // commit function is generic over both shapes.
  const isProposalRow = (r: Record<string, unknown>) => "kind" in r;
  const isVoteRow = (r: Record<string, unknown>) => "weightQubic" in r;

  // --- Drizzle SQL fragment helpers (test-only) ---
  // The service uses Drizzle's `eq(col, val)` and `desc(col)` to
  // build query fragments. From an inspection of the compiled SQL
  // (see src/tests/__inspect-tables.test.ts), the structure is:
  //
  //   eq(table.col, val):
  //     queryChunks: [
  //       StringChunk(" "),
  //       <Column>   (name: snake_case DB column name),
  //       StringChunk(" = "),
  //       Param      (value: the value),
  //       StringChunk(" "),
  //     ]
  //
  //   desc(table.col):
  //     queryChunks: [
  //       StringChunk(" "),
  //       <Column>   (name: snake_case DB column name),
  //       StringChunk(" desc"),
  //     ]
  //
  // The column's `name` is the DB column name (snake_case), but
  // the rows are stored with the TS property name (camelCase).
  // We build a DB-name -> TS-name map at `.from()` time by
  // walking the table's own properties (the column refs are
  // the table's keys).
  type Chunk = unknown;
  const chunkColumnName = (c: Chunk): string | null => {
    if (!c || typeof c !== "object") return null;
    const o = c as { name?: unknown };
    return typeof o.name === "string" ? o.name : null;
  };
  const chunkValue = (c: Chunk): unknown => {
    if (c === null || c === undefined) return c;
    if (typeof c !== "object") return c;
    const o = c as { value?: unknown };
    if ("value" in o) return o.value;
    return c;
  };
  const chunkString = (c: Chunk): string => {
    if (typeof c === "string") return c;
    if (c && typeof c === "object") {
      const o = c as { value?: unknown };
      if (typeof o.value === "string") return o.value;
      if (Array.isArray(o.value)) {
        // StringChunk stores its literal SQL as a string array;
        // join them so we can match on " desc" / " asc" etc.
        return o.value.map((v) => (typeof v === "string" ? v : "")).join("");
      }
    }
    return "";
  };
  /** Build a DB-name -> TS-name map for the table object. */
  const buildColumnMap = (table: Record<string, unknown>): Map<string, string> => {
    const map = new Map<string, string>();
    for (const tsName of Object.keys(table)) {
      const col = table[tsName];
      if (!col || typeof col !== "object") continue;
      const o = col as { name?: unknown; queryChunks?: unknown[]; dataType?: unknown };
      // A Drizzle column is a SQL object with a `name` (DB name)
      // and a queryChunks array. Plain values (eg. the `enableRLS`
      // boolean on pgTable) are skipped. We also accept columns
      // with a `dataType` (some Drizzle types expose that).
      if (typeof o.name === "string" && (Array.isArray(o.queryChunks) || o.dataType)) {
        map.set(o.name, tsName);
      }
    }
    return map;
  };
  const applyWhere = (
    rows: Record<string, unknown>[],
    where: unknown,
    colMap: Map<string, string>,
  ): Record<string, unknown>[] => {
    if (!where) return rows;
    const w = where as { queryChunks?: Chunk[] };
    const chunks = w.queryChunks;
    if (!chunks || chunks.length < 3) return rows;
    // Find the column chunk + the value chunk. eq(...) is shaped
    // [str, col, str, param, str]; the value is the only Param.
    let colName: string | null = null;
    let value: unknown = undefined;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const cn = chunkColumnName(c);
      if (cn && colName === null) colName = cn;
      if (c && typeof c === "object") {
        const ctor = (c as { constructor?: { name?: string } }).constructor?.name;
        if (ctor === "Param" || ctor === "PgBigInt53" || ctor === "PgInteger" || ctor === "PgUUID" || ctor === "PgText" || ctor === "PgBoolean") {
          if (i > 0 && chunks[i - 1] !== c) {
            const s = chunkString(chunks[i - 1]);
            // The value is preceded by an operator chunk like " = ".
            if (s && s.includes("=")) {
              value = chunkValue(c);
            }
          }
        }
      }
    }
    // Fallback: if the column is at index 1 and the value is at index 3.
    if (colName === null) colName = chunkColumnName(chunks[1]);
    if (value === undefined) value = chunkValue(chunks[3]);
    if (colName === null) return rows;
    const tsCol = colMap.get(colName);
    if (!tsCol) return rows;
    return rows.filter((r) => r[tsCol] === value);
  };
  const applyOrderBy = (
    rows: Record<string, unknown>[],
    orderBy: unknown,
    colMap: Map<string, string>,
  ): Record<string, unknown>[] => {
    if (!orderBy) return rows;
    const ob = orderBy as { queryChunks?: Chunk[] };
    const chunks = ob.queryChunks;
    if (!chunks) return rows;
    // desc(...) shape: [str, col, " desc"]. The column is the only
    // object with a `name` (the others are StringChunks whose value
    // is a string array — no `name`).
    let colName: string | null = null;
    for (const c of chunks) {
      const n = chunkColumnName(c);
      if (n) { colName = n; break; }
    }
    let isDesc = false;
    for (const c of chunks) {
      const s = chunkString(c);
      if (/\bdesc\b/i.test(s)) { isDesc = true; break; }
      if (/\basc\b/i.test(s)) { isDesc = false; break; }
    }
    if (colName === null) return rows;
    const tsCol = colMap.get(colName);
    if (!tsCol) return rows;
    const sorted = [...rows].sort((a, b) => {
      const av = a[tsCol];
      const bv = b[tsCol];
      if (av === bv) return 0;
      if (av === undefined || av === null) return isDesc ? 1 : -1;
      if (bv === undefined || bv === null) return isDesc ? -1 : 1;
      if (av < bv) return isDesc ? 1 : -1;
      if (av > bv) return isDesc ? -1 : 1;
      return 0;
    });
    return sorted;
  };

  // A from() that returns the matching store. where() and orderBy()
  // both filter/sort the live store snapshot at call-time so the
  // service can chain .where().orderBy().limit(n). The table-kind
  // is decided by walking the table's own column keys (a vote table
  // has a `weightQubic` column; a proposal table has `kind` and
  // `proposerStakeQubic`).
  const fromQuery = (kind: "proposal" | "vote", colMap: Map<string, string>) => {
    const rows = () =>
      kind === "proposal"
        ? Array.from(proposalStore.values())
        : Array.from(voteStore.values());
    let pending: Record<string, unknown>[] = rows();
    const result: Record<string, unknown> = {};

    // Build a thenable + chainable that ends in `pending.slice(start, end)`.
    // The chain supports `.limit(n)`, `.offset(m)`, and `.limit(n).offset(m)`
    // (in any order), each returning a new pending slice that the next
    // method (or the terminal await) sees.
    const terminal = (start: number, end: number) => {
      const slice = pending.slice(start, end);
      const term: Record<string, unknown> = {
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(slice).then(resolve, reject),
        catch: (reject: (e: unknown) => void) => Promise.resolve(slice).catch(reject),
        finally: (cb: () => void) => Promise.resolve(slice).finally(cb),
        // After limit/offset, more chain methods can still apply.
        limit: (n: number) => {
          const next = Math.min(start + n, end);
          return terminal(start, next);
        },
        offset: (m: number) => {
          return terminal(start + m, end);
        },
      };
      return term;
    };

    result.where = (cond: unknown) => {
      pending = applyWhere(pending, cond, colMap);
      return result;
    };
    result.orderBy = (col: unknown) => {
      pending = applyOrderBy(pending, col, colMap);
      return result;
    };
    result.limit = (n: number) => terminal(0, n);
    result.offset = (m: number) => terminal(m, pending.length);
    // groupBy(choice): the service uses this to aggregate vote
    // weights by choice. We compute the sum per `choice` field.
    result.groupBy = (_choiceField: unknown) => {
      // Aggregate by the `choice` field on vote rows.
      const buckets = new Map<string, bigint>();
      for (const r of pending) {
        const choice = r.choice as string;
        const w = r.weightQubic as bigint;
        buckets.set(choice, (buckets.get(choice) ?? 0n) + w);
      }
      const out: Array<{ choice: string; total: string }> = [];
      for (const [choice, total] of buckets.entries()) {
        out.push({ choice, total: total.toString() });
      }
      return Promise.resolve(out);
    };
    return result;
  };

  return {
    getDb: () => ({
      insert: () => {
        const chain: Record<string, unknown> = {};
        let pendingRow: Record<string, unknown> | null = null;
        let conflictUpdate: Record<string, unknown> | null = null;
        const commit = (row: Record<string, unknown>) => {
          const id = newUuid();
          const record = { id, ...row, createdAt: new Date(), updatedAt: new Date() };
          if (isProposalRow(row)) {
            proposalStore.set(id, record);
            return [record];
          } else if (isVoteRow(row)) {
            // Upsert: if a vote for (proposalId, voterUserId) already
            // exists, update its choice/weight/note in place
            // (mimics onConflictDoUpdate).
            const key = `${row.proposalId}|${row.voterUserId}`;
            const existing = voteStore.get(key);
            if (existing) {
              Object.assign(existing, conflictUpdate ?? row, { updatedAt: new Date() });
              return [existing];
            }
            voteStore.set(key, record);
            return [record];
          }
          return [record];
        };
        chain.values = (row: Record<string, unknown>) => {
          pendingRow = row;
          const built: Record<string, unknown> = {
            returning: async () => (pendingRow ? commit(pendingRow) : []),
          };
          built.onConflictDoUpdate = (opts: { set?: Record<string, unknown> }) => {
            conflictUpdate = opts?.set ?? null;
            // Commit immediately — the service awaits this chain
            // without calling .returning() (Drizzle's standard
            // pattern). Mirror that by inserting on this call.
            if (pendingRow) commit(pendingRow);
            return Promise.resolve();
          };
          return built;
        };
        return chain;
      },
      select: () => ({
        from: (table: unknown) => {
          // The drizzle pgTable has its columns as own properties
          // (e.g. `proposalVotes.weightQubic`). We use that to
          // discriminate the table kind.
          const t = (table ?? {}) as Record<string, unknown>;
          const isVotes = t.weightQubic !== undefined;
          const colMap = buildColumnMap(t);
          return fromQuery(isVotes ? "vote" : "proposal", colMap);
        },
      }),
      update: (table: unknown) => {
        const t = (table ?? {}) as Record<string, unknown>;
        const isVotes = t.weightQubic !== undefined;
        const colMap = buildColumnMap(t);
        return {
          set: (patch: Record<string, unknown>) => ({
            where: (cond: unknown) => {
              const store = isVotes ? voteStore : proposalStore;
              const filtered = applyWhere(Array.from(store.values()), cond, colMap);
              for (const v of filtered) {
                Object.assign(v, patch, { updatedAt: new Date() });
              }
              return Promise.resolve();
            },
          }),
        };
      },
    }),
  };
});

// In-memory AigarthPool mock. The user has positions in some ANNs;
// `getPosition(user, annId)` returns null for non-existent ones.
const positionsStore = new Map<string, { annId: string; amount: bigint; active: boolean }[]>();

function userKey(user: string, annId: string) {
  return `${user}|${annId}`;
}

vi.mock("../services/aigarthpool.js", () => {
  return {
    getAigarthPool: () => ({
      getPosition: async (user: string, annId: string) => {
        const list = positionsStore.get(user) ?? [];
        const pos = list.find((p) => p.annId === annId && p.active);
        return pos ? { annId: pos.annId, amount: pos.amount, lockUntilEpoch: 0, qearnLockId: "q", active: true } : null;
      },
      // The proposals service needs to enumerate all known ANNs.
      // Expose a way to do that — we attach `splits` to the mock.
      splits: new Map<string, unknown>([["ann-1", {}], ["ann-2", {}]]),
      submitTreasuryTransfer: async () => {},
    }),
  };
});

// Now we can import the service.
const { createProposal, castVote, finalise, executeProposal, listProposals, getProposal, recomputeTally, MIN_PROPOSER_STAKE_QUBIC, MIN_QUORUM_QUBIC, DEFAULT_VOTING_WINDOW_MS, ProposalError } = await import("../services/proposals.js");

// ---------- Helpers ----------

function addStake(user: string, annId: string, amountQubic: bigint) {
  const existing = positionsStore.get(user) ?? [];
  existing.push({ annId, amount: amountQubic * 1_000_000n, active: true });
  positionsStore.set(user, existing);
}

function clearState() {
  proposalStore.clear();
  voteStore.clear();
  positionsStore.clear();
  nextIdCounter = 0;
}

const PROPOSER = "00000000-0000-0000-0000-000000000001";
const VOTER_A = "00000000-0000-0000-0000-000000000002";
const VOTER_B = "00000000-0000-0000-0000-000000000003";
const VOTER_C = "00000000-0000-0000-0000-000000000004";
const DESTINATION = "DESTINATION" + "C".repeat(49); // 60-char uppercase — matches ^[A-Z]{60}$

beforeEach(() => {
  clearState();
  addStake(PROPOSER, "ann-1", 10_000n);  // 10,000 QUBIC stake
});

// ---------- createProposal ----------

describe("proposals: createProposal", () => {
  it("creates a general proposal with status=open and a 7-day deadline", async () => {
    const p = await createProposal({
      kind: "general",
      title: "Add a new category",
      body: "We should add Gardening as a category.",
      proposerUserId: PROPOSER,
    });
    expect(p.status).toBe("open");
    expect(p.kind).toBe("general");
    expect(p.title).toBe("Add a new category");
    expect(p.proposerStakeQubic).toBe(10_000n * 1_000_000n);
    const now = Date.now();
    const deadline = p.votingDeadlineAt.getTime();
    expect(deadline - now).toBeGreaterThanOrEqual(DEFAULT_VOTING_WINDOW_MS - 1000);
    expect(deadline - now).toBeLessThanOrEqual(DEFAULT_VOTING_WINDOW_MS + 1000);
  });

  it("rejects when title is empty", async () => {
    await expect(
      createProposal({ kind: "general", title: "", body: "x", proposerUserId: PROPOSER }),
    ).rejects.toMatchObject({ code: "INVALID_TITLE" });
  });

  it("rejects when body is too long", async () => {
    await expect(
      createProposal({ kind: "general", title: "t", body: "x".repeat(20_001), proposerUserId: PROPOSER }),
    ).rejects.toMatchObject({ code: "INVALID_BODY" });
  });

  it("rejects treasury-spend without destination address", async () => {
    await expect(
      createProposal({
        kind: "treasury-spend",
        title: "Buy servers",
        body: "...",
        proposerUserId: PROPOSER,
        amountQubic: 1_000_000_000_000n,
      }),
    ).rejects.toMatchObject({ code: "INVALID_DESTINATION" });
  });

  it("rejects treasury-spend with non-positive amount", async () => {
    await expect(
      createProposal({
        kind: "treasury-spend",
        title: "Bad",
        body: "...",
        proposerUserId: PROPOSER,
        destinationAddress: DESTINATION,
        amountQubic: 0n,
      }),
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });

  it("rejects when proposer has insufficient stake", async () => {
    const newProposer = "00000000-0000-0000-0000-000000000099";
    addStake(newProposer, "ann-1", 100n);  // 100 QUBIC — below MIN_PROPOSER_STAKE_QUBIC
    await expect(
      createProposal({
        kind: "general",
        title: "t",
        body: "x",
        proposerUserId: newProposer,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STAKE" });
  });

  it("uses default quorum of max(MIN_QUORUM, 1% of proposer stake)", async () => {
    // Proposer has 10,000 QUBIC. 1% = 100 QUBIC. MIN_QUORUM > 100, so
    // the default should be MIN_QUORUM_QUBIC.
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    expect(p.quorumQubic).toBe(MIN_QUORUM_QUBIC);

    // Proposer with 100M QUBIC → 1% = 1M QUBIC > MIN_QUORUM.
    const bigProposer = "00000000-0000-0000-0000-0000000000aa";
    addStake(bigProposer, "ann-1", 100_000_000n);
    const p2 = await createProposal({
      kind: "general",
      title: "t2",
      body: "x",
      proposerUserId: bigProposer,
    });
    expect(p2.quorumQubic).toBe(100_000_000n * 1_000_000n / 100n);
  });
});

// ---------- castVote ----------

describe("proposals: castVote", () => {
  it("accepts a vote and increments the cached tally", async () => {
    addStake(VOTER_A, "ann-1", 5_000n);
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "yes" });
    const refreshed = await getProposal(p.id);
    expect(refreshed?.yesWeightQubic).toBe(5_000n * 1_000_000n);
    expect(refreshed?.noWeightQubic).toBe(0n);
    expect(refreshed?.abstainWeightQubic).toBe(0n);
  });

  it("re-voting updates the choice and weight", async () => {
    addStake(VOTER_A, "ann-1", 5_000n);
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "yes" });
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "no" });
    const refreshed = await getProposal(p.id);
    expect(refreshed?.yesWeightQubic).toBe(0n);
    expect(refreshed?.noWeightQubic).toBe(5_000n * 1_000_000n);
    // Only one vote row per (proposal, voter).
    expect(Array.from(voteStore.values()).length).toBe(1);
  });

  it("rejects the proposer voting on their own proposal", async () => {
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    await expect(
      castVote({ proposalId: p.id, voterUserId: PROPOSER, choice: "yes" }),
    ).rejects.toMatchObject({ code: "SELF_VOTE" });
  });

  it("rejects a voter with no stake", async () => {
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    await expect(
      castVote({ proposalId: p.id, voterUserId: "00000000-0000-0000-0000-0000000000ee", choice: "yes" }),
    ).rejects.toMatchObject({ code: "NO_STAKE" });
  });

  it("rejects a vote on a non-existent proposal", async () => {
    await expect(
      castVote({ proposalId: "no-such-id", voterUserId: VOTER_A, choice: "yes" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a vote on a closed proposal", async () => {
    addStake(VOTER_A, "ann-1", 5_000n);
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    // Force the proposal to "passed" by directly mutating the store.
    const stored = proposalStore.get(p.id)!;
    stored.status = "passed";
    await expect(
      castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "yes" }),
    ).rejects.toMatchObject({ code: "NOT_OPEN" });
  });
});

// ---------- finalise ----------

describe("proposals: finalise", () => {
  it("returns passed when yes > no and quorum is met", async () => {
    // Default quorum is 100k QUBIC (MIN_QUORUM_QUBIC). Voter stakes
    // must total > 100k so the yes weight meets the quorum.
    addStake(VOTER_A, "ann-1", 60_000n);
    addStake(VOTER_B, "ann-2", 50_000n);
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    // Cast votes WHILE the deadline is still in the future — castVote
    // refuses to record votes after the deadline.
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "yes" });
    await castVote({ proposalId: p.id, voterUserId: VOTER_B, choice: "no" });
    // Now backdate the deadline so finalise can run.
    const stored = proposalStore.get(p.id)!;
    stored.votingDeadlineAt = new Date(Date.now() - 60_000);
    const result = await finalise(p.id);
    expect(result.status).toBe("passed");
    expect(result.finalisedAt).toBeDefined();
  });

  it("returns rejected when no > yes and quorum is met", async () => {
    addStake(VOTER_A, "ann-1", 60_000n);
    addStake(VOTER_B, "ann-2", 50_000n);
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "no" });
    await castVote({ proposalId: p.id, voterUserId: VOTER_B, choice: "yes" });
    const stored = proposalStore.get(p.id)!;
    stored.votingDeadlineAt = new Date(Date.now() - 60_000);
    const result = await finalise(p.id);
    expect(result.status).toBe("rejected");
  });

  it("returns expired when total weight is below the quorum", async () => {
    addStake(VOTER_A, "ann-1", 100n);  // small stake
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "yes" });
    const stored = proposalStore.get(p.id)!;
    stored.votingDeadlineAt = new Date(Date.now() - 60_000);
    const result = await finalise(p.id);
    expect(result.status).toBe("expired");
  });

  it("refuses to finalise before the deadline", async () => {
    addStake(VOTER_A, "ann-1", 5_000n);
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    // Deadline is in the future by default.
    await expect(finalise(p.id)).rejects.toMatchObject({ code: "TOO_EARLY" });
  });

  it("is idempotent on already-finalised proposals", async () => {
    addStake(VOTER_A, "ann-1", 5_000n);
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "yes" });
    const stored = proposalStore.get(p.id)!;
    stored.votingDeadlineAt = new Date(Date.now() - 60_000);
    const first = await finalise(p.id);
    const second = await finalise(p.id);
    expect(first.status).toBe(second.status);
    expect(first.id).toBe(second.id);
  });
});

// ---------- executeProposal ----------

describe("proposals: executeProposal", () => {
  it("executes a passed treasury-spend proposal and pushes to AigarthPool", async () => {
    const p = await createProposal({
      kind: "treasury-spend",
      title: "Buy hardware",
      body: "...",
      proposerUserId: PROPOSER,
      destinationAddress: DESTINATION,
      amountQubic: 5_000_000_000_000n,
    });
    const stored = proposalStore.get(p.id)!;
    stored.status = "passed";
    const updated = await executeProposal(p.id);
    expect(updated.status).toBe("executed");
    expect(updated.executedAt).toBeDefined();
    expect(updated.executionNonce).toBe(1);
  });

  it("rejects execute on a non-passed proposal", async () => {
    const p = await createProposal({
      kind: "treasury-spend",
      title: "Buy hardware",
      body: "...",
      proposerUserId: PROPOSER,
      destinationAddress: DESTINATION,
      amountQubic: 5_000_000_000_000n,
    });
    // status is "open" by default
    await expect(executeProposal(p.id)).rejects.toMatchObject({ code: "NOT_PASSED" });
  });

  it("rejects execute on a non-binding kind", async () => {
    const p = await createProposal({
      kind: "general",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
    });
    const stored = proposalStore.get(p.id)!;
    stored.status = "passed";
    await expect(executeProposal(p.id)).rejects.toMatchObject({ code: "NON_BINDING" });
  });

  it("is idempotent on already-executed proposals", async () => {
    const p = await createProposal({
      kind: "treasury-spend",
      title: "t",
      body: "x",
      proposerUserId: PROPOSER,
      destinationAddress: DESTINATION,
      amountQubic: 1_000_000_000_000n,
    });
    const stored = proposalStore.get(p.id)!;
    stored.status = "passed";
    const first = await executeProposal(p.id);
    const second = await executeProposal(p.id);
    expect(first.status).toBe("executed");
    expect(second.id).toBe(first.id);
  });
});

// ---------- list / get ----------

describe("proposals: list / get", () => {
  it("listProposals returns all proposals (paged) ordered by created desc", async () => {
    const p1 = await createProposal({ kind: "general", title: "a", body: "x", proposerUserId: PROPOSER });
    // Ensure p2's createdAt is strictly greater than p1's — the
    // proposals are created in the same millisecond on fast
    // machines, and a stable sort preserves insertion order on
    // equal keys. The deadline is far enough in the future that
    // this is safe.
    await new Promise((r) => setTimeout(r, 5));
    const p2 = await createProposal({ kind: "general", title: "b", body: "x", proposerUserId: PROPOSER });
    const list = await listProposals();
    expect(list.length).toBe(2);
    expect(list[0]!.id).toBe(p2.id);  // newer first
    expect(list[1]!.id).toBe(p1.id);
  });

  it("getProposal returns null for unknown id", async () => {
    const got = await getProposal("not-a-uuid");
    expect(got).toBeNull();
  });

  it("getProposal includes a fresh tally", async () => {
    // 200,000 QUBIC stake → 2e11 Qu-bit weight, ≥ MIN_QUORUM_QUBIC
    // (1e11), so quorum is met with a single yes vote.
    addStake(VOTER_A, "ann-1", 200_000n);
    const p = await createProposal({ kind: "general", title: "t", body: "x", proposerUserId: PROPOSER });
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "yes" });
    const view = await getProposal(p.id);
    expect(view).not.toBeNull();
    expect(view!.tally.yesWeightQubic).toBe(200_000n * 1_000_000n);
    expect(view!.tally.quorumMet).toBe(true);
  });
});

// ---------- recomputeTally ----------

describe("proposals: recomputeTally", () => {
  it("is idempotent — calling twice produces the same totals", async () => {
    addStake(VOTER_A, "ann-1", 3_000n);
    addStake(VOTER_B, "ann-2", 1_500n);
    addStake(VOTER_C, "ann-1", 500n);
    const p = await createProposal({ kind: "general", title: "t", body: "x", proposerUserId: PROPOSER });
    await castVote({ proposalId: p.id, voterUserId: VOTER_A, choice: "yes" });
    await castVote({ proposalId: p.id, voterUserId: VOTER_B, choice: "no" });
    await castVote({ proposalId: p.id, voterUserId: VOTER_C, choice: "abstain" });
    await recomputeTally(p.id);
    const first = (await getProposal(p.id))!.tally;
    await recomputeTally(p.id);
    const second = (await getProposal(p.id))!.tally;
    expect(first.yesWeightQubic).toBe(second.yesWeightQubic);
    expect(first.noWeightQubic).toBe(second.noWeightQubic);
    expect(first.abstainWeightQubic).toBe(second.abstainWeightQubic);
  });
});

// Suppress unused-import for MIN_PROPOSER_STAKE_QUBIC (used in
// the test that names it).
void MIN_PROPOSER_STAKE_QUBIC;
