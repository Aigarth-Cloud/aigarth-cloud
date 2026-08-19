/**
 * Integration test harness for `services/ann` (ADR 008 F1 follow-up).
 *
 *   Goal: real-DB integration tests that run against an actual
 *   Postgres, not the in-memory mock used by the unit tests in
 *   src/tests/. The v0.2 §33 Task 1 spec lists 5 schema-level
 *   Organism tests that *cannot* be expressed against a mock (the
 *   recursive CTE in `getLineage`, the FK on `parent_id`, the slug
 *   UNIQUE index, the CHECK on `organism_memories.kind`, ...).
 *
 *   Two modes (selected via INTEGRATION_DB_MODE):
 *     - "pg-mem"    default; in-process Postgres emulator. No Docker.
 *                   Works in any environment. The CI runner uses
 *                   this mode.
 *     - "postgres"  connect to a real Postgres at $DATABASE_URL
 *                   (default: postgres://aigarth:aigarth_dev@localhost:5432/aigarth
 *                   — the existing infrastructure/docker-compose.yml
 *                   Postgres). Each test file gets its own dedicated
 *                   database, which is created at setup and dropped
 *                   at teardown. This mode is opt-in.
 *
 *   The harness exports three functions:
 *     - setupTestDb()  — fresh database + migrations, returns a teardown
 *     - getTestDb()    — the active Drizzle client (set by setupTestDb)
 *     - resetTestDb()  — truncate all tables, preserve schema
 *
 *   Why a fresh per-test-file database?
 *     The Organism + Phase 14 migrations declare 14 tables, 8 enums,
 *     and 19 indexes. Spinning that up is the most expensive part of
 *     the suite. With the per-file fresh DB, the schema is created
 *     once per file and the per-test resetTestDb() only DELETEs
 *     (no DDL).
 *
 *   Why pg-mem + Postgres (not just one)?
 *     pg-mem runs anywhere (CI on a 1-CPU laptop, no Docker daemon,
 *     no postgres binary). It supports ~95% of PG syntax. The "dev"
 *     mode hits a real Postgres to catch the small set of features
 *     pg-mem doesn't emulate (e.g. some extension behaviour, certain
 *     collation quirks). The 5 schema-level tests from v0.2 §33 all
 *     work in both modes.
 */

import { newDb, DataType, type IMemoryDb } from "pg-mem";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Client, Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import * as schema from "../../db/schema.js";

// ---------- pg-mem + Drizzle compatibility shims ----------
//
// (1) Drizzle's `node-postgres` session passes a `types:
//     { getTypeParser }` config to `client.query()` so it can
//     override the parser for TIMESTAMPTZ (and any other
//     custom-typed columns). pg-mem v3's adapter explicitly
//     rejects this:
//
//         if (query.types?.getTypeParser) {
//             throw new NotSupported('getTypeParser is not supported');
//         }
//
//     pg-mem doesn't need a custom type parser — its built-in
//     type handlers are already correct for the columns we use
//     (TIMESTAMPTZ returns ISO strings, JSONB returns parsed
//     objects, BIGINT returns numbers, ...). The shim below wraps
//     the pg-mem client's `query()` to strip the `types` property
//     from any config-style call.
//
// (2) Drizzle's `drizzle()` factory uses `isConfig(pool)`, which
//     checks `pool.constructor.name === "Object"`. A plain object
//     literal would be misidentified as a Drizzle config (which
//     then makes Drizzle build its own real `pg.Pool` from the
//     connection string — the "callback is not a function" stack
//     we hit earlier). We side-step that by giving the wrapper a
//     named class.
type PgLikeClient = {
  query: (...args: unknown[]) => unknown;
  on?: (...args: unknown[]) => unknown;
  once?: (...args: unknown[]) => unknown;
  release?: (...args: unknown[]) => unknown;
  removeListener?: (...args: unknown[]) => unknown;
  end?: (...args: unknown[]) => unknown;
  connect?: (...args: unknown[]) => unknown;
};
function isQueryConfig(
  x: unknown,
): x is { text: string; values?: unknown[]; types?: unknown; rowMode?: string } & Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return typeof o.text === "string";
}
/**
 * Convert pg-mem's row shape (object) to Drizzle's expected
 * shape (array). Drizzle's `mapResultRow` accesses values via
 * `row[columnIndex]`; pg-mem returns rows as plain objects
 * keyed by column name. We wrap pg-mem's result in a Proxy
 * that translates numeric indices into the corresponding
 * column name, derived from the first row's key order.
 *
 * Why not just convert once at the boundary?
 *   pg-mem's `find` and `select` paths return objects with
 *   different key orderings; we need a per-result wrapper to
 *   preserve each query's column order. The Proxy approach
 *   reads the keys lazily on first index access.
 */
function wrapPgMemResultAsArrayRow(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  // The pg-mem MemPg client returns `{ rows, fields }` (or
  // similar). Drizzle expects `result.rows` to be an array of
  // arrays (one per row). We re-shape only `rows`; the rest
  // of the result passes through.
  const r = result as { rows?: unknown[] } & Record<string, unknown>;
  if (Array.isArray(r.rows) && r.rows.length > 0) {
    const firstRow = r.rows[0];
    if (firstRow && typeof firstRow === "object" && !Array.isArray(firstRow)) {
      const keys = Object.keys(firstRow as Record<string, unknown>);
      r.rows = r.rows.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return row;
        const obj = row as Record<string, unknown>;
        // Build an array in the same order as `keys`, so
        // Drizzle's `row[columnIndex]` returns the right
        // value for each declared field.
        return keys.map((k) => obj[k]);
      });
    }
  }
  return result;
}
function stripTypesFromQueryCall(args: unknown[]): unknown[] {
  if (args.length === 0) return args;
  const [first, ...rest] = args;
  if (!isQueryConfig(first)) return args;
  // pg-mem's adapter explicitly rejects:
  //   - `query.types?.getTypeParser` (NotSupported)
  //   - `query.rowMode` (NotSupported, on the adaptResults path)
  // Drizzle's prepared-query path includes both. Strip them
  // here and re-shape the result to match Drizzle's
  // expected array-row layout (see `wrapPgMemResultAsArrayRow`).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { rowMode, types, ...rest2 } = first;
  const safeTypes =
    types && typeof types === "object"
      ? Object.fromEntries(
          Object.entries(types).filter(([k]) => k !== "getTypeParser"),
        )
      : types;
  const stripped =
    rowMode !== undefined ||
    (types && typeof types === "object" && "getTypeParser" in (types as object));
  if (!stripped) return args;
  return [{ ...rest2, types: safeTypes }, ...rest];
}
function wrapPgMemClient(client: PgLikeClient): PgLikeClient {
  const originalQuery = client.query.bind(client) as (...a: unknown[]) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).query = (...args: unknown[]) => {
    const result = originalQuery(...stripTypesFromQueryCall(args));
    if (result && typeof result === "object" && "then" in (result as object)) {
      return (result as Promise<unknown>).then(wrapPgMemResultAsArrayRow);
    }
    return wrapPgMemResultAsArrayRow(result);
  };
  return client;
}
class PgMemPoolShim {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly inner: any;
  constructor(inner: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.inner = inner as any;
  }
  async connect(): Promise<unknown> {
    const client = await this.inner.connect();
    return wrapPgMemClient(client);
  }
  query(...args: unknown[]): unknown {
    const result = this.inner.query(...stripTypesFromQueryCall(args));
    // pg-mem returns rows as objects; Drizzle's `mapResultRow`
    // expects arrays. Convert at the boundary.
    if (result && typeof result === "object" && "then" in (result as object)) {
      // Promise — return a wrapped promise.
      return (result as Promise<unknown>).then(wrapPgMemResultAsArrayRow);
    }
    return wrapPgMemResultAsArrayRow(result);
  }
  async end(): Promise<void> {
    if (typeof this.inner.end === "function") {
      await this.inner.end();
    }
  }
}

// ---------- Path resolution ----------
//
//   src/tests/integration/setup.ts
//     ^  src/tests/integration
//     ^  src/tests
//     ^  src
//     ^  services/ann
//   => 3 `..` then `drizzle`
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(__dirname, "..", "..", "..", "drizzle");

// ---------- Public types ----------

export type TestDb = NodePgDatabase<typeof schema>;
export type Mode = "pg-mem" | "postgres";

export interface TestHandle {
  db: TestDb;
  mode: Mode;
  teardown: () => Promise<void>;
}

// ---------- Module-level state ----------
//
// `_handle` is the active database. Vitest runs each test file in
// its own forked process (see vitest.config.integration.ts ->
// pool: "forks"), so module-level state is safely per-file.

let _handle: TestHandle | null = null;
let _pgMem: IMemoryDb | null = null;
let _pgMemPool: Pool | null = null;
let _pgClient: Client | null = null;
let _pgDatabaseName: string | null = null;

// ---------- Mode detection ----------

function detectMode(): Mode {
  const m = (process.env.INTEGRATION_DB_MODE ?? "pg-mem").trim().toLowerCase();
  return m === "postgres" ? "postgres" : "pg-mem";
}

// ---------- Public API ----------

/**
 * Build a fresh test database and run every migration from
 * services/ann/drizzle/ against it. Returns a teardown function
 * that drops the database (postgres mode) or the in-memory state
 * (pg-mem mode) and releases the connection.
 *
 * Idempotent per-process: a second call returns the same handle.
 * To get a fresh database, call teardown() first.
 */
export async function setupTestDb(): Promise<TestHandle> {
  if (_handle) return _handle;
  const mode = detectMode();
  if (mode === "postgres") {
    _handle = await setupPostgres();
  } else {
    _handle = await setupPgMem();
  }
  return _handle;
}

/**
 * Return the active Drizzle client. Throws if setupTestDb() has not
 * been called yet.
 */
export function getTestDb(): TestDb {
  if (!_handle) {
    throw new Error(
      "[integration/setup] getTestDb() called before setupTestDb(). " +
        "Wrap your test file with beforeAll(setupTestDb).",
    );
  }
  return _handle.db;
}

/**
 * Delete every row in the active schema, preserving the schema
 * itself. Faster than DROP + re-migrate.
 *
 * We use DELETE (not TRUNCATE) for one reason: the `organisms`
 * table has a self-referential FK (`parent_id` and `root_id` both
 * reference `organisms.id`). TRUNCATE ... CASCADE on a self-FK
 * recurses infinitely in pg-mem (the FK handler asks the foreign
 * table to truncate, which is the same table). DELETE avoids this
 * entirely.
 *
 * The schema declares ON DELETE CASCADE on the child tables
 * (organism_memories, organism_fitness_history). If we DELETE
 * from organisms last, the children are removed by the DB. We
 * still DELETE from the children explicitly first to keep the
 * test deterministic across pg-mem + real Postgres (real
 * Postgres honours the cascade; pg-mem honours it too but we
 * don't want to depend on subtle ordering).
 *
 * Order: children first, then parents. Identifiers are hard-coded
 * so there is no injection vector.
 */
export async function resetTestDb(): Promise<void> {
  if (!_handle) {
    throw new Error("[integration/setup] resetTestDb() called before setupTestDb().");
  }
  const db = _handle.db;
  const tables = [
    "ann_audit_logs",
    "ann_proposal_votes",
    "ann_proposals",
    "ann_decision_outcomes",
    "ann_decisions",
    "ann_benchmarks",
    "ann_licenses_granted",
    "ann_ratings",
    "ann_deployments",
    "ann_retrain_events",
    "ann_retrain_configs",
    "ann_idempotency_keys",
    "ann_versions",
    "anns",
    "ann_licenses",
    "ann_categories",
    "organism_fitness_history",
    "organism_memories",
    "organisms",
  ];
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.execute(sql.raw(`DELETE FROM "${t}"`));
  }
}

// ---------- pg-mem setup ----------

async function setupPgMem(): Promise<TestHandle> {
  const memdb = newDb({ autoCreateForeignKeyIndices: true });
  _pgMem = memdb;

  // Register gen_random_uuid() — the migrations use this as the
  // default for every primary key (see drizzle/0000_*.sql ...
  // 0007_*.sql — 17 occurrences). pg-mem v3 doesn't ship pgcrypto
  // by default. The function is impure because it returns a fresh
  // value per call.
  memdb.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true,
  });

  // Register pg_trgm as a no-op extension. The 0001 migration
  // does `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (for the GIN
  // trigram indexes on the marketplace search column). pg-mem
  // doesn't ship pg_trgm; without this, the migrator throws
  // "Extension does not exist: pg_trgm". The GIN trigram indexes
  // themselves are silently ignored by pg-mem (it only supports
  // btree), which is fine for our purposes — the schema-level
  // tests don't exercise full-text search; they exercise the
  // Organism + Phase 14 surface.
  memdb.registerExtension("pg_trgm", (_schema) => {
    // no-op install
  });

  const { Pool: MemPool } = memdb.adapters.createPg();
  const innerPool = new MemPool();

  const pool = new PgMemPoolShim(innerPool) as unknown as Pool;
  _pgMemPool = pool;

  const db = drizzle(pool, { schema });

  await migrate(db, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsTable: "ann_migrations",
    migrationsSchema: "public",
  });

  // Disable pg-mem's per-row FK check on the self-referential
  // Organism + Phase 14 governance tables. pg-mem's FK check
  // fires *before* the row is added, so a founder insert with
  // `root_id = self.id` is rejected (the row doesn't exist yet).
  // Real Postgres defers single-row FK checks to the end of the
  // statement, so the same insert works there. pg-mem has no
  // hook that fires *after* `MemoryTable.setBin` (the after hook
  // in `changePlan` runs before the row is stored), so we can't
  // simply re-register the check on the after hook.
  //
  // Workaround: disable the FK check on the self-referencing
  // tables. Test 4 in `organism_schema.test.ts` (the parent FK
  // case) re-implements the check in JS — it inserts the row,
  // then SELECTs the parent; if the parent doesn't exist, it
  // throws. This is the JS fallback the user allowed for in the
  // prompt ("If `pg-mem` doesn't support a feature you need,
  // document the gap and fall back to a hand-written equivalent
  // in JS. Do not skip tests; the gap is a follow-up.").
  //
  // Scope: only the self-referencing tables. The cross-table FKs
  // (organism_memories.organism_id -> organisms.id,
  // organism_fitness_history.organism_id -> organisms.id) keep
  // the default eager check, which is correct because the
  // referenced row is always inserted first by the test helper.
  //
  // Runs AFTER the migrations so the constraints actually exist.
  const SELF_REF_TABLES = new Set(["organisms", "ann_proposal_votes"]);
  for (const tableName of SELF_REF_TABLES) {
    // The cast is needed because IMemoryTable doesn't expose
    // constraintsByName in the public type, but the runtime
    // MemoryTable does.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table: any = memdb.public.getTable(tableName, true);
    if (!table || !table.constraintsByName) continue;
    for (const wrapperEntry of Array.from(table.constraintsByName.values())) {
      // pg-mem wraps every constraint in a `ConstraintWrapper`.
      // The actual constraint is in `wrapper.inner`; the wrapper
      // delegates `unsubs`, `uninstall`, `table`, `foreignTable`,
      // etc. to the inner object.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper: any = wrapperEntry;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const constraint: any = wrapper.inner ?? wrapper;
      // We only want FK constraints (ForeignKey class).
      if (!constraint.foreignTable || !Array.isArray(constraint.unsubs)) {
        continue;
      }
      // Unsubscribe the eager before-change check. Each entry in
      // `unsubs` is a `{unsubscribe: fn}` object (see
      // `MemoryTable._subChange` in pg-mem). Calling
      // `unsubscribe()` removes the hook from the changeHandlers
      // map.
      for (const sub of constraint.unsubs) sub.unsubscribe();
      constraint.unsubs = [];
    }
  }

  return {
    db,
    mode: "pg-mem",
    teardown: async () => {
      await pool.end().catch(() => {
        // pg-mem's Pool.end() can be a no-op; ignore errors.
      });
      _handle = null;
      _pgMem = null;
      _pgMemPool = null;
    },
  };
}

// ---------- Postgres setup ----------

async function setupPostgres(): Promise<TestHandle> {
  // The connection string is the admin connection (the existing
  // `aigarth` database). We use it to create a fresh database,
  // then close it and open a second connection that targets the
  // new database directly.
  const adminConn =
    process.env.INTEGRATION_TEST_ADMIN_URL ??
    process.env.DATABASE_URL ??
    "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";

  // Generate a short, memorable database name. The user must
  // have CREATEDB on the cluster. The default `aigarth` user in
  // infrastructure/docker-compose.yml is the initial superuser
  // and has this.
  const databaseName = `ann_test_${randomUUID().replace(/-/g, "").slice(0, 12).toLowerCase()}`;
  _pgDatabaseName = databaseName;

  // ----- Step 1: create the database via the admin connection. -----
  const adminClient = new Client({ connectionString: adminConn });
  await adminClient.connect();
  try {
    // Identifier-quote the database name; the random UUID hex is
    // safe but quotes are defensive.
    await adminClient.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await adminClient.end();
  }

  // ----- Step 2: open a single client to the new database. -----
  //
  // We use a single Client (not a Pool) for the duration of the
  // test file. This is intentional:
  //   - Drizzle's `drizzle(client)` works on either Client or
  //     Pool.
  //   - The integration tests run sequentially within a file.
  //   - A single connection is simpler to reason about.
  const url = new URL(adminConn);
  url.pathname = `/${databaseName}`;
  const targetConn = url.toString();
  const client = new Client({ connectionString: targetConn });
  await client.connect();
  _pgClient = client;

  // ----- Step 3: run every migration against the new database. -----
  //
  // We use the `public` schema (the default). The migration's
  // self-references ("public"."organisms") resolve correctly
  // because that's where the table was just created.
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsTable: "ann_migrations",
    migrationsSchema: "public",
  });

  return {
    db,
    mode: "postgres",
    teardown: async () => {
      try {
        await client.end();
      } catch {
        // ignore close errors during teardown
      }
      // Drop the database. We connect to the admin DB again
      // for this because the per-test DB may still have active
      // sessions if teardown races with another test file. The
      // DROP is best-effort; on failure, the operator can drop
      // it manually.
      const dropClient = new Client({ connectionString: adminConn });
      try {
        await dropClient.connect();
        // Force-disconnect any stragglers, then drop with FORCE.
        await dropClient.query(
          `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
            WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [databaseName],
        );
        await dropClient.query(
          `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[integration/setup] failed to drop test database "${databaseName}":`,
          err,
        );
      } finally {
        await dropClient.end().catch(() => {
          // ignore
        });
      }
      _handle = null;
      _pgClient = null;
      _pgDatabaseName = null;
    },
  };
}

// ---------- Diagnostic helpers (for test debugging) ----------

/**
 * The mode the harness is using. Exposed so tests can assert
 * against the active backend.
 */
export function getMode(): Mode {
  return detectMode();
}

/**
 * The name of the ephemeral database (postgres mode only).
 * Returns null in pg-mem mode.
 */
export function getDatabaseName(): string | null {
  return _pgDatabaseName;
}
