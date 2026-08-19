import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, closeDb } from "./index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "..", "..", "drizzle");

const MIGRATIONS_TABLE = "marketplace_migrations";
// Co-locate the migrations table in the public schema with the rest of the
// service's tables. drizzle-orm's default is a separate `drizzle` schema.
const MIGRATIONS_SCHEMA = "public";

console.log(`[marketplace] applying migrations from ${migrationsFolder} (table: ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE})`);

const db = getDb();
try {
  await migrate(db, {
    migrationsFolder,
    migrationsTable: MIGRATIONS_TABLE,
    migrationsSchema: MIGRATIONS_SCHEMA,
  });
} catch (err) {
  console.error(`[marketplace] migration FAILED:`, err);
  await closeDb();
  process.exit(1);
}
await closeDb();
console.log("[marketplace] migrations applied");
