/**
 * Postgres connection + Drizzle client.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadConfig } from "../config/index.js";
import * as schema from "./schema.js";

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const cfg = loadConfig();

  _pool = new Pool({
    connectionString: cfg.DATABASE_URL,
    max: cfg.NODE_ENV === "production" ? 20 : 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

  _db = drizzle(_pool, { schema });
  return _db;
}

export function getPool() {
  if (!_pool) getDb();
  return _pool!;
}

export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
