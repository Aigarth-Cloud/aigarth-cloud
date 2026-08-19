import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, closeDb } from "./index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "..", "..", "drizzle");

// Per-service migrations table — see drizzle.config.json for why.
const MIGRATIONS_TABLE = "dataset_migrations";
const MIGRATIONS_SCHEMA = "public";

// eslint-disable-next-line no-console
console.log(
  `[dataset] applying migrations from ${migrationsFolder} (table: ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE})`,
);

const db = getDb();
try {
  await migrate(db, {
    migrationsFolder,
    migrationsTable: MIGRATIONS_TABLE,
    migrationsSchema: MIGRATIONS_SCHEMA,
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`[dataset] migration FAILED:`, err);
  await closeDb();
  process.exit(1);
}
await closeDb();
// eslint-disable-next-line no-console
console.log("[dataset] migrations applied");
