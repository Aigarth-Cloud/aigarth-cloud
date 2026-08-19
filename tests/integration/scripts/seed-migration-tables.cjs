// Reset the per-service migrations tables in public schema. drizzle-orm's
// migrate() skips a migration if `lastDbMigration.created_at >= folderMillis`.
// So we seed ONLY the most recent applied migration with its journal `when`.
//
// Cleans up:
//   - public.{svc}_migrations  (from earlier wrong-schema attempts)
//   - drizzle.__drizzle_migrations / drizzle.ann_migrations / etc.
//     (created by drizzle-orm before we passed migrationsSchema: "public")
// Leaves: no per-service entries. The next `pnpm db:migrate` will create
// public.{svc}_migrations and apply any un-applied migrations.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

const URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";
const ROOT = "C:/Users/Wesley/.minimax-agent/projects/qubic-aigarth-cloud";

const SERVICES = [
  { name: "ann", table: "ann_migrations", drizzle: path.join(ROOT, "services/ann/drizzle") },
  { name: "marketplace", table: "marketplace_migrations", drizzle: path.join(ROOT, "services/marketplace/drizzle") },
  { name: "billing", table: "billing_migrations", drizzle: path.join(ROOT, "services/billing/drizzle") },
  { name: "tissue", table: "tissue_migrations", drizzle: path.join(ROOT, "services/tissue/drizzle") },
];

function hashForMigration(svc, tag) {
  const idx = tag.split("_")[0];
  const snapPath = path.join(svc.drizzle, "meta", idx + "_snapshot.json");
  if (!fs.existsSync(snapPath)) {
    const h = crypto.createHash("sha256");
    h.update(svc.name + ":" + tag);
    return h.digest("hex").slice(0, 36);
  }
  const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));
  return snap.id;
}

(async () => {
  const c = new Client({ connectionString: URL });
  await c.connect();

  for (const svc of SERVICES) {
    const journalPath = path.join(svc.drizzle, "meta", "_journal.json");
    if (!fs.existsSync(journalPath)) {
      console.log("[" + svc.name + "] no journal, skipping");
      continue;
    }
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    const entries = journal.entries;
    if (!entries.length) continue;

    // Wipe public.{svc}_migrations and recreate (don't care if it existed)
    await c.query("DROP TABLE IF EXISTS public.\"" + svc.table + "\"");
    await c.query(
      "CREATE TABLE public.\"" + svc.table + "\" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)"
    );

    // Insert the LAST entry only — the migrator only checks the most recent.
    const last = entries[entries.length - 1];
    const hash = hashForMigration(svc, last.tag);
    await c.query(
      "INSERT INTO public.\"" + svc.table + "\" (hash, created_at) VALUES ($1, $2)",
      [hash, last.when]
    );
    console.log(
      "[" + svc.name + "] seeded public." + svc.table + " with last applied = " +
        last.tag + " (when=" + last.when + ", hash=" + hash.slice(0, 12) + ")"
    );
  }

  // Also clean up any stray drizzle schema that earlier runs may have created
  for (const svc of SERVICES) {
    await c.query("DROP TABLE IF EXISTS drizzle.\"" + svc.table + "\"");
  }
  await c.query("DROP TABLE IF EXISTS drizzle.__drizzle_migrations");
  // Don't drop the schema itself; harmless if empty

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
