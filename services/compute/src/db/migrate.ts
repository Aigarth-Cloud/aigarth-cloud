import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, closeDb } from "./index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "..", "..", "drizzle");

// eslint-disable-next-line no-console
console.log(`[compute] applying migrations from ${migrationsFolder}`);

const db = getDb();
await migrate(db, { migrationsFolder });
await closeDb();
// eslint-disable-next-line no-console
console.log("[compute] migrations applied");
